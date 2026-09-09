import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { checkPaymentLink } from '@/lib/paymentLink'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/invoices/[id]/payment-link — attach or replace the payment request link.
 * DELETE — remove it.
 *
 * The paste is stamped with the time it was saved, because these requests expire and
 * a link that has been sitting on an invoice for weeks should be visibly old rather
 * than quietly resent.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: { url?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const check = checkPaymentLink(typeof body.url === 'string' ? body.url : '')
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { id: true } })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const updated = await prisma.invoice.update({
    where: { id },
    data: { paymentLinkUrl: check.url, paymentLinkAt: new Date() },
    select: { paymentLinkUrl: true, paymentLinkAt: true },
  })

  return NextResponse.json({ ok: true, ...updated })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.invoice.update({
    where: { id },
    data: { paymentLinkUrl: null, paymentLinkAt: null },
  })
  return NextResponse.json({ ok: true })
}
