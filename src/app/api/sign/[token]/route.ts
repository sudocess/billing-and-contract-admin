import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { createHash, randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { generateContractHtml, type PreviewData } from '@/lib/contractHtml'
import { htmlToPdf } from '@/lib/htmlToPdf'
import { sendSignedConfirmationToClient, sendSignedNotificationToAdmin } from '@/lib/email'
import { requestOrigin } from '@/lib/appUrl'
import { recordEvent } from '@/lib/contractEvents'

export const dynamic = 'force-dynamic'
/* This request launches Chromium to render the signed PDF, and on a cold start it
   first downloads and unpacks the browser. The platform default is far too short for
   that, and running out of time here means the client cannot sign at all. */
export const maxDuration = 60

let _sigBase64: string | null = null
function getSignatureBase64(): string {
  if (_sigBase64 !== null) return _sigBase64
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'cess-signature.png'))
    _sigBase64 = `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    _sigBase64 = ''
  }
  return _sigBase64
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const body = await req.json().catch(() => ({}))
  const name: string = (body.name || '').trim()
  const agreed: boolean = body.agreed === true

  if (!name) {
    return NextResponse.json({ error: 'Signed name is required.' }, { status: 400 })
  }

  // The generated PDF states that the signer "checked the consent checkbox". Until
  // now that flag lived only in the browser and was never sent, so the document
  // asserted a consent step the server had no record of — and a direct API call
  // produced an identical contract having never shown the checkbox at all.
  if (!agreed) {
    return NextResponse.json(
      { error: 'You must confirm you have read and agree to the terms.' },
      { status: 400 },
    )
  }

  const contract = await prisma.contract.findUnique({
    where: { signingToken: token },
  })

  if (!contract) {
    return NextResponse.json({ error: 'Invalid or expired signing link.' }, { status: 404 })
  }
  if (contract.status === 'SIGNED') {
    return NextResponse.json({ error: 'This contract has already been signed.' }, { status: 400 })
  }
  if (contract.status === 'CANCELLED') {
    return NextResponse.json({ error: 'This contract has been cancelled.' }, { status: 400 })
  }
  if (contract.signingTokenExpiresAt && contract.signingTokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This signing link has expired. Please contact Engaging UX Design for a new one.' },
      { status: 400 },
    )
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  const signedAt = new Date()
  const signedAtFormatted = signedAt.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const signingReference = randomUUID().toUpperCase()

  // Generate signed PDF with both signatures filled in
  const previewData = contract.data as PreviewData
  const html = generateContractHtml(previewData, {
    sigBase64: getSignatureBase64(),
    pdfMode: true,
    clientSignedName: name,
    clientSignedAt: signedAtFormatted,
    signingReference,
    signerIp: ip,
    signerTimestampIso: signedAt.toISOString(),
  })
  const pdfBuffer = await htmlToPdf(html)

  // Mark contract as signed, clear the token, and keep the document itself.
  //
  // This PDF used to be generated, emailed and dropped. That is how two of Leemar's
  // signed agreements became unrecoverable: the contract row was later edited, and
  // nothing anywhere still held what had actually been signed. Storing it alongside
  // the audit fields means the record survives any later edit to the contract.
  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: 'SIGNED',
      signedAt,
      signerName: name,
      signerIp: ip,
      consentConfirmed: true,
      signingToken: null,
      signingTokenExpiresAt: null,
      // Copied into a plain Uint8Array: Prisma's Bytes expects one backed by an
      // ArrayBuffer, which Node's Buffer does not guarantee.
      signedPdf: new Uint8Array(pdfBuffer),
      signedPdfSha256: createHash('sha256').update(pdfBuffer).digest('hex'),
      signedPdfSize: pdfBuffer.length,
      signingReference,
    },
  })

  await recordEvent(contract.id, 'signed', `Signed by ${name} from ${ip}`, name)

  // Signing a revision is what retires the version it replaces. Until this moment the
  // previous version was the agreement in force, so that a revision drafted and then
  // abandoned never leaves the client under no contract at all.
  if (contract.supersedesId) {
    const replaced = await prisma.contract.update({
      where: { id: contract.supersedesId },
      data: { status: 'SUPERSEDED', archivedAt: new Date() },
    }).catch(err => {
      console.error('[sign] could not retire the superseded version', err)
      return null
    })
    if (replaced) {
      // Recorded on both: each contract's own trail should explain its own fate
      // without needing the other one open beside it.
      await recordEvent(replaced.id, 'superseded',
        `No longer in force — replaced by ${contract.contractCode}, signed by ${name}`, name)
      await recordEvent(contract.id, 'replaced',
        `Replaces ${replaced.contractCode}, which is no longer in force`, name)
    }
  }

  /* The client's own copy of what they just signed, PDF attached.
     Non-blocking, because a signature must not fail because a mail server did, but
     every outcome is written to the contract's trail. The silent case was the worst
     of the three: a contract with no email address on it sent nothing at all and
     said nothing about it, so the client simply never received their copy and the
     record showed no reason why. */
  const clientEmail = (contract.dedicatedEmail || contract.clientEmail || '').trim()
  if (clientEmail) {
    sendSignedConfirmationToClient({
      to: clientEmail,
      clientName: contract.clientName,
      contractCode: contract.contractCode,
      projectName: contract.projectName,
      signedAt,
      pdfBuffer,
    })
      .then(() =>
        recordEvent(contract.id, 'signed',
          `Signed copy emailed to ${clientEmail}`, 'system'),
      )
      .catch(err => {
        console.error('[sign] client confirmation email failed', err)
        return recordEvent(contract.id, 'signed',
          `Signed copy could NOT be emailed to ${clientEmail}: ${err instanceof Error ? err.message : 'unknown mail error'}`,
          'system')
      })
  } else {
    await recordEvent(contract.id, 'signed',
      'No email address on this contract, so the client was not sent their signed copy',
      'system')
  }

  /* Tell the owner, at the address they actually read.
     Still non-blocking, because a signature must never fail because a notification
     did. But a failure is now written to the contract's own trail rather than only
     to a server log nobody opens, so "did I get told about this" has an answer on
     the contract page. */
  const notifyTo = await prisma.ownerSettings
    .findUnique({ where: { id: 'singleton' }, select: { notifyEmail: true } })
    .then(s => (s?.notifyEmail || '').trim())
    .catch(() => '')

  const origin = requestOrigin(req)

  sendSignedNotificationToAdmin({
    contractCode: contract.contractCode,
    clientName: contract.clientName,
    clientEmail,
    signedAt,
    signerIp: ip,
    pdfBuffer,
    to: notifyTo,
    contractUrl: origin
      ? `${origin}/contracts/${encodeURIComponent(contract.contractCode)}`
      : undefined,
  })
    .then(() =>
      recordEvent(contract.id, 'signed',
        `Signing notification emailed to ${notifyTo || 'the sending mailbox'}`, 'system'),
    )
    .catch(err => {
      console.error('[sign] admin notification email failed', err)
      return recordEvent(contract.id, 'signed',
        `Signing notification could NOT be emailed: ${err instanceof Error ? err.message : 'unknown mail error'}`,
        'system')
    })

  return NextResponse.json({ ok: true })
}
