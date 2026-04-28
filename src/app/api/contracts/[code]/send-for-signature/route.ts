import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { generateContractHtml, type PreviewData } from '@/lib/contractHtml'
import { htmlToPdf } from '@/lib/htmlToPdf'
import { sendEnvelopeForSignature } from '@/lib/docusign'

export const dynamic = 'force-dynamic'

// Read the admin signature once and cache it for the process lifetime
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
    // Generate the exact same branded 3-page HTML contract
    const previewData = contract.data as PreviewData
    const html = generateContractHtml(previewData, { sigBase64: getSignatureBase64() })

    // Render to PDF using headless Chromium (identical to what the print window produces)
    const pdfBuffer = await htmlToPdf(html)

    // Send the PDF to DocuSign for e-signature
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
    console.error('[send-for-signature] failed', err)
    const message = err instanceof Error ? err.message : 'Failed to send for signature'

    if (message.includes('consent_required')) {
      return NextResponse.json(
        { error: 'DocuSign consent not yet granted. Complete the one-time consent step and try again.', consentRequired: true },
        { status: 403 },
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
