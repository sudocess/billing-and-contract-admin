import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { buildContractSummaryHTML, sendContractEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: Request,
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

  // Generate a cryptographically random token, valid for 14 days
  const signingToken = crypto.randomBytes(32).toString('hex')
  const signingTokenExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  await prisma.contract.update({
    where: { contractCode: contract.contractCode },
    data: {
      signingToken,
      signingTokenExpiresAt,
      sentAt: contract.sentAt ?? new Date(),
      status: contract.status === 'DRAFT' ? 'PENDING' : contract.status,
    },
  })

  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  const signingUrl = `${appUrl}/sign/${signingToken}`

  const summaryHtml = buildContractSummaryHTML({
    contractCode: contract.contractCode,
    projectName: contract.projectName,
    clientName: contract.clientName,
    totalValue: contract.totalValue,
    initFee: contract.initFee,
    phaseLabel: contract.phaseLabel,
    language: contract.language,
  })

  await sendContractEmail({
    to: clientEmail,
    subject: `Please sign your service agreement — ${contract.contractCode}`,
    message: `Hi ${contract.clientName.split(' ')[0]},\n\nPlease review and sign your service agreement from Engaging UX Design. The link below is valid for 14 days.`,
    contractSummaryHtml: summaryHtml,
    viewUrl: signingUrl,
  })

  return NextResponse.json({ ok: true, sentTo: clientEmail })
}
