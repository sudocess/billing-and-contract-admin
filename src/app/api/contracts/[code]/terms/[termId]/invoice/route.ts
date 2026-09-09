import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { nextInvoiceNumber } from '@/lib/invoiceNumber'
import {
  computeSchedule,
  ensureRowIds,
  parseSchedule,
  toCents,
  fromCents,
} from '@/lib/installments'
import { computeTermBilling, groupInvoicesByTerm, issuableAmount, type TermInvoice } from '@/lib/termBilling'

export const dynamic = 'force-dynamic'

/**
 * POST /api/contracts/[code]/terms/[termId]/invoice
 *
 * Raise a draft invoice for one term of the payment schedule, for whatever that term
 * still has outstanding. Called again after a short payment, it bills the remainder.
 *
 * The invoice is always created as a DRAFT. Nothing is emailed here — the amounts and
 * the VAT treatment are reviewed on the invoice itself before anything leaves.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string; termId: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code, termId } = await params
  const contractCode = decodeURIComponent(code)

  const contract = await prisma.contract.findUnique({
    where: { contractCode },
    include: { invoices: true },
  })
  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  // Invoicing against a withdrawn agreement is an accounting error, not a workflow
  // step. Reactivate or supersede the contract first.
  if (contract.status === 'CANCELLED') {
    return NextResponse.json(
      { error: 'This contract is cancelled. Reactivate it before issuing invoices.' },
      { status: 409 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshot = (contract.data as any)?.schedule
  const parsed = parseSchedule(contract.installments) ?? parseSchedule(snapshot)
  if (!parsed || parsed.instalments.length === 0) {
    return NextResponse.json({ error: 'This contract has no payment schedule.' }, { status: 400 })
  }

  // Rows written before ids existed get them now, once, and are persisted before any
  // invoice points at one — otherwise the link would be to an id that only ever lived
  // in this request's memory.
  const { schedule, changed } = ensureRowIds(parsed)
  if (changed || !contract.installments) {
    await prisma.contract.update({
      where: { id: contract.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { installments: schedule as any },
    })
  }

  const computed = computeSchedule(schedule)
  const row = computed.rows.find((r) => r.id === termId)
  if (!row) return NextResponse.json({ error: 'Term not found in this schedule.' }, { status: 404 })

  if (row.kind === 'credit') {
    return NextResponse.json(
      { error: 'This row records money already invoiced. Billing it again would charge the client twice.' },
      { status: 409 },
    )
  }

  const byTerm = groupInvoicesByTerm(contract.invoices as unknown as TermInvoice[])
  const billing = computeTermBilling(row, byTerm.get(termId) ?? [])
  const amountGross = issuableAmount(row, billing)

  if (toCents(amountGross) <= 0) {
    return NextResponse.json(
      {
        error:
          billing.state === 'settled'
            ? 'This term is already paid in full.'
            : 'This term is already fully invoiced. Confirm the payment before billing a remainder.',
      },
      { status: 409 },
    )
  }

  const settings = await prisma.ownerSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })

  // The schedule's rate governs, not the InvoiceItem default of 21%. A 0% schedule
  // that silently acquired VAT here would overcharge the client by a fifth.
  const vatRate = schedule.vatRate
  const netCents = Math.round(toCents(amountGross) / (1 + vatRate / 100))
  const net = fromCents(netCents)
  const vat = fromCents(toCents(amountGross) - netCents)

  const isRemainder = billing.received > 0 || billing.openBilled > 0
  const description = [
    contract.projectName || contract.phaseLabel,
    row.label,
    isRemainder ? '(remainder)' : '',
  ]
    .filter(Boolean)
    .join(' — ')

  const invoiceDate = new Date()
  const dueDate = row.dueDate ? new Date(`${row.dueDate}T00:00:00.000Z`) : addDays(invoiceDate, 30)

  const invoiceNumber = await nextInvoiceNumber(prisma)

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      status: 'DRAFT',
      clientId: contract.clientId,
      contractId: contract.id,
      scheduleTermId: termId,

      clientName: contract.clientCompany || contract.clientName,
      clientEmail: contract.dedicatedEmail || contract.clientEmail || '',
      clientContact: contract.clientName,
      clientPhone: contract.clientPhone,
      clientAddress: contract.clientAddress,
      clientCity: [contract.clientPostalCode, contract.clientCity].filter(Boolean).join(' ') || null,
      clientCountry: contract.clientCountry || 'Netherlands',
      clientVat: contract.clientVat,
      clientKvk: contract.clientKvk,

      invoiceDate,
      dueDate,
      reference: `${contract.contractCode} · ${row.label}`,
      language: contract.language || 'en',

      subtotal: net,
      vatTotal: vat,
      grandTotal: amountGross,
      // 0% here is a real VAT position, not a missing value, so it is named as one.
      vatTreatment: vatRate === 0 ? 'none' : 'standard',

      iban: settings.iban || null,
      bic: settings.bic || null,
      bankName: settings.bankName || null,
      accountHolder: settings.accountHolder || 'Engaging UX Design',
      // Registration numbers are printed only when they genuinely exist; an empty
      // string here would otherwise render as a blank "VAT:" line on the invoice.
      ownVat: settings.ownVat || null,
      ownKvk: settings.ownKvk || null,

      items: {
        create: [{ description, quantity: 1, unitPrice: net, vatRate, amount: net }],
      },
    },
  })

  return NextResponse.json({ ok: true, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber })
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}