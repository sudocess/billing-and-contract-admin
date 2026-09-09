import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/invoices/[id]/confirm-payment
 *
 * Record what actually arrived against this invoice.
 *
 * The amount is entered by hand rather than assumed from the invoice total, because
 * the whole point is to catch the case where they differ. A short payment leaves the
 * term owing a remainder, which the contract's schedule then offers to invoice.
 *
 * `paidAt` is likewise the date the money landed, not the date this button was
 * pressed — bank transfers clear days after they are sent, and stamping "now" makes
 * the books disagree with the statement.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: { amount?: unknown; paidAt?: unknown; reference?: unknown; method?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: 'Enter the amount that was received.' }, { status: 400 })
  }

  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const paidAt = typeof body.paidAt === 'string' && body.paidAt
    ? new Date(`${body.paidAt}T00:00:00.000Z`)
    : new Date()
  if (Number.isNaN(paidAt.getTime())) {
    return NextResponse.json({ error: 'That payment date is not a real date.' }, { status: 400 })
  }

  // Short payments stay SENT: the invoice is still owed in part, and marking it PAID
  // would hide the shortfall from every list that filters on status.
  const covered = Math.round(amount * 100) >= Math.round(invoice.grandTotal * 100)

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      paidAmount: amount,
      paidAt,
      paidReference: typeof body.reference === 'string' && body.reference.trim()
        ? body.reference.trim()
        : null,
      paidMethod: typeof body.method === 'string' && body.method.trim() ? body.method.trim() : null,
      status: covered ? 'PAID' : 'SENT',
    },
    select: { id: true, paidAmount: true, paidAt: true, status: true, grandTotal: true },
  })

  return NextResponse.json({
    ok: true,
    invoice: updated,
    shortfall: covered ? 0 : Math.round((invoice.grandTotal - amount) * 100) / 100,
  })
}
