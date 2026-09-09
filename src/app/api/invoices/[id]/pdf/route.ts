import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { generateInvoicePdf } from '@/lib/pdf'

// GET /api/invoices/[id]/pdf — download invoice as PDF
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // The proxy gates this route, but only on the JWT signature; readSession also
  // honours the revoke-all watermark so a revoked session is genuinely dead here.
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  try {
    const pdfBuffer = await generateInvoicePdf(invoice)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (error) {
    console.error('Failed to generate PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
