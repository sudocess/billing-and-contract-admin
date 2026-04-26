import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/invoices/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(invoice)
}

// PUT /api/invoices/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const existing = await prisma.invoice.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Build update data — only include fields that are present
  const updateData: Record<string, unknown> = {}

  const stringFields = [
    'clientName', 'clientEmail', 'clientContact', 'clientPhone', 'clientAddress',
    'clientCity', 'clientCountry', 'clientVat', 'clientKvk', 'invoiceNumber',
    'reference', 'paymentTerms', 'currency', 'language', 'internalNotes',
    'iban', 'bic', 'bankName', 'accountHolder', 'paymentRef', 'ownVat', 'ownKvk',
    'lateFee', 'vatTreatment', 'notes', 'status',
  ]

  for (const field of stringFields) {
    if (body[field] !== undefined) updateData[field] = body[field] || null
  }

  // Ensure required fields stay non-null
  if (body.clientName) updateData.clientName = body.clientName
  if (body.clientEmail) updateData.clientEmail = body.clientEmail
  if (body.invoiceNumber) updateData.invoiceNumber = body.invoiceNumber
  if (body.clientCountry) updateData.clientCountry = body.clientCountry

  if (body.invoiceDate) updateData.invoiceDate = new Date(body.invoiceDate)
  if (body.dueDate) updateData.dueDate = new Date(body.dueDate)
  if (body.paidAt) updateData.paidAt = new Date(body.paidAt)
  if (body.sentAt) updateData.sentAt = new Date(body.sentAt)

  if (body.subtotal !== undefined) updateData.subtotal = body.subtotal
  if (body.vatTotal !== undefined) updateData.vatTotal = body.vatTotal
  if (body.grandTotal !== undefined) updateData.grandTotal = body.grandTotal

  // Update items if provided
  if (body.items) {
    // Delete old items, create new
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } })
    updateData.items = {
      create: body.items.map((item: { description: string; quantity: number; unitPrice: number; vatRate: number; amount?: number }) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        amount: item.amount || item.quantity * item.unitPrice,
      })),
    }
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: updateData,
    include: { items: true },
  })

  return NextResponse.json(invoice)
}

// DELETE /api/invoices/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const existing = await prisma.invoice.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.invoice.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
