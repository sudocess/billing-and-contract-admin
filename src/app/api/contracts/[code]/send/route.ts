import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { sendContractEmail, buildContractSummaryHTML } from '@/lib/email'

export const dynamic = 'force-dynamic'

interface SendBody {
  to?: string
  subject?: string
  message?: string
}

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

  let body: SendBody = {}
  try {
    body = await req.json()
  } catch {/* allow empty body */}

  const to = (body.to || contract.dedicatedEmail || contract.clientEmail || '').trim()
  if (!to) {
    return NextResponse.json(
      { error: 'No recipient email found. Add a client email or pass `to` in the request body.' },
      { status: 400 },
    )
  }

  const subject =
    body.subject?.trim() ||
    `Your contract ${contract.contractCode} — Engaging UX Design`

  const message =
    body.message?.trim() ||
    `Hi ${contract.clientName.split(' ')[0]},\n\nPlease find your service agreement below. Click the button to review the full contract.\n\nLet me know if you have any questions or change requests.\n\nBest,\nCess Garcia - de Laat — Engaging UX Design`

  const origin =
    req.headers.get('origin') ||
    (req.headers.get('host') ? `https://${req.headers.get('host')}` : '')
  const viewUrl = `${origin}/contract-view/${encodeURIComponent(contract.contractCode)}`

  try {
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
      to,
      subject,
      message,
      contractSummaryHtml: summaryHtml,
      viewUrl,
    })

    const updated = await prisma.contract.update({
      where: { contractCode: contract.contractCode },
      data: {
        sentAt: new Date(),
        status: contract.status === 'DRAFT' ? 'PENDING' : contract.status,
      },
    })

    return NextResponse.json({
      ok: true,
      to,
      sentAt: updated.sentAt,
      status: updated.status,
      viewUrl,
    })
  } catch (err) {
    console.error('[contracts] send failed', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send contract email' },
      { status: 500 },
    )
  }
}
