import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateInvoicePdf } from '@/lib/pdf'
import { sendInvoiceEmail, buildInvoiceSummaryHTML } from '@/lib/email'

// POST /api/invoices/[id]/send — send invoice email with PDF attachment
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Send email
    await sendInvoiceEmail({
      to,
      subject: subject || `Invoice ${invoice.invoiceNumber} — Engaging UX Design`,
      message: message || '',
      invoiceHtml: summaryHtml,
      pdfBuffer,
      pdfFilename: `invoice-${invoice.invoiceNumber}.pdf`,
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
