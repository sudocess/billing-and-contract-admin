import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateInvoicePdf } from '@/lib/pdf'
import { sendInvoiceEmail, buildInvoiceSummaryHTML, buildPaymentLinkHTML } from '@/lib/email'
import { readSession } from '@/lib/auth'
import { checkPaymentLink } from '@/lib/paymentLink'

// POST /api/invoices/[id]/send — send invoice email with PDF attachment
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // The proxy already refuses anonymous requests, but it only verifies the JWT
  // signature. readSession additionally honours the revoke-all watermark, so a
  // session revoked from Settings cannot still trigger outbound mail from here.
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { to, subject, message, language } = body

  if (!to) {
    return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Update language if provided
  if (language && language !== invoice.language) {
    await prisma.invoice.update({ where: { id }, data: { language } })
    invoice.language = language
  }

  try {
    // Generate PDF
    const pdfBuffer = await generateInvoicePdf(invoice)

    // Build email body HTML
    const summaryHtml = buildInvoiceSummaryHTML({
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      grandTotal: invoice.grandTotal,
      currency: invoice.currency,
      language: invoice.language,
    })

    // Payment request block. Re-validated at send time rather than trusted from
    // storage: the allowlist may have tightened since the link was pasted, and this
    // is the last point before it reaches a client.
    let paymentHtml: string | undefined
    if (invoice.paymentLinkUrl) {
      const check = checkPaymentLink(invoice.paymentLinkUrl)
      if (!check.ok) {
        return NextResponse.json(
          { error: `The payment link on this invoice is no longer acceptable: ${check.error}` },
          { status: 400 },
        )
      }
      paymentHtml = buildPaymentLinkHTML({
        url: check.url!,
        // The amount still outstanding, not the face value — a part-paid invoice must
        // not ask again for the whole sum.
        amount: invoice.paidAmount != null
          ? Math.max(0, Math.round((invoice.grandTotal - invoice.paidAmount) * 100) / 100)
          : invoice.grandTotal,
        currency: invoice.currency,
        language: invoice.language,
      })
    }

    // Send email
    await sendInvoiceEmail({
      to,
      subject: subject || `Invoice ${invoice.invoiceNumber} — Engaging UX Design`,
      message: message || '',
      invoiceHtml: summaryHtml,
      pdfBuffer,
      pdfFilename: `invoice-${invoice.invoiceNumber}.pdf`,
      paymentHtml,
    })

    // Update invoice status
    await prisma.invoice.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to send invoice:', error)
    return NextResponse.json(
      { error: 'Failed to send invoice email' },
      { status: 500 }
    )
  }
}
