import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { generateContractHtml, type PreviewData } from '@/lib/contractHtml'
import { htmlToPdf } from '@/lib/htmlToPdf'
import { sendSignedConfirmationToClient, sendSignedNotificationToAdmin } from '@/lib/email'

export const dynamic = 'force-dynamic'

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

  if (!name) {
    return NextResponse.json({ error: 'Signed name is required.' }, { status: 400 })
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

  // Generate signed PDF with both signatures filled in
  const previewData = contract.data as PreviewData
  const html = generateContractHtml(previewData, {
    sigBase64: getSignatureBase64(),
    pdfMode: true,
    clientSignedName: name,
    clientSignedAt: signedAtFormatted,
  })
  const pdfBuffer = await htmlToPdf(html)

  // Mark contract as signed and clear the token
  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: 'SIGNED',
      signedAt,
      signerName: name,
      signerIp: ip,
      signingToken: null,
      signingTokenExpiresAt: null,
    },
  })

  // Send confirmation emails (non-blocking — don't fail the sign action if email fails)
  const clientEmail = (contract.dedicatedEmail || contract.clientEmail || '').trim()
  if (clientEmail) {
    sendSignedConfirmationToClient({
      to: clientEmail,
      clientName: contract.clientName,
      contractCode: contract.contractCode,
      projectName: contract.projectName,
      signedAt,
      pdfBuffer,
    }).catch(err => console.error('[sign] client confirmation email failed', err))
  }

  sendSignedNotificationToAdmin({
    contractCode: contract.contractCode,
    clientName: contract.clientName,
    clientEmail,
    signedAt,
    signerIp: ip,
    pdfBuffer,
  }).catch(err => console.error('[sign] admin notification email failed', err))

  return NextResponse.json({ ok: true })
}
