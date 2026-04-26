import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/invoices — list all invoices
export async function GET() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  })
  return NextResponse.json(invoices)
}

// POST /api/invoices — create new invoice
export async function POST(req: NextRequest) {
  const body = await req.json()

  const {
    clientName, clientEmail, clientContact, clientPhone, clientAddress, clientCity,
    clientCountry, clientVat, clientKvk, invoiceNumber, invoiceDate, dueDate,
    reference, paymentTerms, currency, language, internalNotes, iban, bic,
    bankName, accountHolder, paymentRef, ownVat, ownKvk, lateFee, vatTreatment,
    notes, subtotal, vatTotal, grandTotal, items,
  } = body

  if (!clientName || !clientEmail || !invoiceNumber) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Check for duplicate invoice number
  const existing = await prisma.invoice.findUnique({ where: { invoiceNumber } })
  if (existing) {
    return NextResponse.json({ error: 'Invoice number already exists' }, { status: 409 })
  }

  const invoice = await prisma.invoice.create({
    data: {
      clientName, clientEmail,
      clientContact: clientContact || null,
      clientPhone: clientPhone || null,
      clientAddress: clientAddress || null,
      clientCity: clientCity || null,
      clientCountry: clientCountry || 'Netherlands',
      clientVat: clientVat || null,
      clientKvk: clientKvk || null,
      invoiceNumber,
      invoiceDate: new Date(invoiceDate),
      dueDate: new Date(dueDate),
      reference: reference || null,
      paymentTerms: paymentTerms || '30 days',
      currency: currency || '€',
      language: language || 'en',
      internalNotes: internalNotes || null,
      iban: iban || null,
      bic: bic || null,
      bankName: bankName || null,
      accountHolder: accountHolder || 'Engaging UX Design',
      paymentRef: paymentRef || null,
      ownVat: ownVat || null,
      ownKvk: ownKvk || null,
      lateFee: lateFee || null,
      vatTreatment: vatTreatment || 'standard',
      notes: notes || null,
      subtotal: subtotal || 0,
      vatTotal: vatTotal || 0,
      grandTotal: grandTotal || 0,
      items: {
        create: (items || []).map((item: { description: string; quantity: number; unitPrice: number; vatRate: number; amount: number }) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          amount: item.amount || item.quantity * item.unitPrice,
        })),
      },
    },
    include: { items: true },
  })

  return NextResponse.json(invoice, { status: 201 })
}
