import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { buildContractSignaturePdf } from '@/lib/contractPdf'
import { sendEnvelopeForSignature } from '@/lib/docusign'

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

  try {
    const pdfBuffer = await buildContractSignaturePdf({
      contractCode: contract.contractCode,
      clientName: contract.clientName,
      clientCompany: contract.clientCompany,
      clientEmail: contract.clientEmail,
      clientAddress: contract.clientAddress,
      clientCity: contract.clientCity,
      clientCountry: contract.clientCountry,
      projectName: contract.projectName,
      phaseLabel: contract.phaseLabel,
      phaseStart: contract.phaseStart,
      phaseEnd: contract.phaseEnd,
      deliverables: contract.deliverables,
      totalValue: contract.totalValue,
      initFee: contract.initFee,
      p1: contract.p1,
      p2: contract.p2,
      p3: contract.p3,
    })

    const envelopeId = await sendEnvelopeForSignature({
      contractCode: contract.contractCode,
      clientName: contract.clientName,
      clientEmail,
      pdfBuffer,
    })

    const updated = await prisma.contract.update({
      where: { contractCode: contract.contractCode },
      data: {
        docusignEnvelopeId: envelopeId,
        sentAt: contract.sentAt ?? new Date(),
        status: contract.status === 'DRAFT' ? 'PENDING' : contract.status,
      },
    })

    return NextResponse.json({
      ok: true,
      envelopeId,
      sentTo: clientEmail,
      status: updated.status,
    })
  } catch (err) {
    console.error('[docusign] send-for-signature failed', err)
    const message = err instanceof Error ? err.message : 'Failed to send for signature'

    // Consent not yet granted — give a useful hint
    if (message.includes('consent_required')) {
      return NextResponse.json(
        {
          error:
            'DocuSign consent not yet granted. Complete the one-time consent step and try again.',
          consentRequired: true,
        },
        { status: 403 },
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
