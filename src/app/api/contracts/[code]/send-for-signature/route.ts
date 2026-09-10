import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { recordEvent } from '@/lib/contractEvents'
import { buildContractSummaryHTML, sendContractEmail } from '@/lib/email'
import { emailOrigin } from '@/lib/appUrl'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  const contract = await prisma.contract.findUnique({
    where: { contractCode: decodeURIComponent(code) },
  })

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  const clientEmail = (contract.dedicatedEmail || contract.clientEmail || '').trim()
  if (!clientEmail) {
    return NextResponse.json(
      { error: 'No client email on this contract. Add one before sending for signature.' },
      { status: 400 },
    )
  }

  if (contract.status === 'SIGNED') {
    return NextResponse.json({ error: 'Contract is already signed.' }, { status: 400 })
  }
  if (contract.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Cannot send a cancelled contract.' }, { status: 400 })
  }

  // Refuse before anything is written. A link the client cannot open is worse than a
  // send that did not happen, because only the second one is visible from here.
  const { origin, error: originError } = emailOrigin(req)
  if (originError) {
    return NextResponse.json({ error: originError }, { status: 500 })
  }

  // Generated here but NOT persisted yet. Writing the token and flipping the contract
  // to PENDING before the email was accepted left contracts that looked sent, carrying
  // a live 14-day signing link nobody ever received, with nothing in the trail to say
  // so. Nothing is recorded until the message has actually left.
  const signingToken = crypto.randomBytes(32).toString('hex')
  const signingTokenExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const signingUrl = `${origin}/sign/${signingToken}`

  const summaryHtml = buildContractSummaryHTML({
    contractCode: contract.contractCode,
    projectName: contract.projectName,
    clientName: contract.clientName,
    totalValue: contract.totalValue,
    initFee: contract.initFee,
    phaseLabel: contract.phaseLabel,
    language: contract.language,
  })

  try {
    await sendContractEmail({
      to: clientEmail,
      subject: `Please sign your service agreement, ${contract.contractCode}`,
      message: `Hi ${contract.clientName.split(' ')[0]},\n\nPlease review and sign your service agreement from Engaging UX Design. The link below is valid for 14 days.`,
      contractSummaryHtml: summaryHtml,
      viewUrl: signingUrl,
      ctaLabel: 'Review & sign your contract',
    })
  } catch (err) {
    console.error('[contracts] send-for-signature failed', err)
    return NextResponse.json(
      {
        error: `The email could not be sent, so nothing was changed on this contract. ${
          err instanceof Error ? err.message : 'Unknown mail error'
        }`,
      },
      { status: 502 },
    )
  }

  await prisma.contract.update({
    where: { contractCode: contract.contractCode },
    data: {
      signingToken,
      signingTokenExpiresAt,
      sentAt: contract.sentAt ?? new Date(),
      status: contract.status === 'DRAFT' ? 'PENDING' : contract.status,
    },
  })

  await recordEvent(contract.id, 'signature_requested', `Signing link emailed to ${clientEmail}`, session.email)

  return NextResponse.json({ ok: true, sentTo: clientEmail })
}
