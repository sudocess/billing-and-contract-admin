import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { recordEvent } from '@/lib/contractEvents'
import { sendContractEmail, buildContractSummaryHTML } from '@/lib/email'
import { emailOrigin } from '@/lib/appUrl'

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
    `Your contract ${contract.contractCode}, Engaging UX Design`

  const message =
    body.message?.trim() ||
    `Hi ${contract.clientName.split(' ')[0]},\n\nPlease find your service agreement below. Click the button to review the full contract.\n\nLet me know if you have any questions or change requests.\n\nBest,\nCess Garcia - de Laat, Engaging UX Design`

  // An empty origin used to produce `/contract-view/CODE`, a relative path, which is
  // not a link once it is inside an email client.
  const { origin, error: originError } = emailOrigin(req)
  if (originError) {
    return NextResponse.json({ error: originError }, { status: 500 })
  }
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
      // This link goes to the read-only preview. Signing happens through Send for
      // signature, which is a different button and a different page.
      ctaLabel: 'Review your contract',
    })

    const updated = await prisma.contract.update({
      where: { contractCode: contract.contractCode },
      data: {
        sentAt: new Date(),
        status: contract.status === 'DRAFT' ? 'PENDING' : contract.status,
      },
    })

    await recordEvent(contract.id, 'sent', `Contract emailed to ${to}`, session.email)

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
