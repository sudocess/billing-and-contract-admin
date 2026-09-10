import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { recordEvent } from '@/lib/contractEvents'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  const contract = await prisma.contract.findUnique({
    where: { contractCode: code },
    include: {
      // The schedule panel needs these to show what each term has been billed and
      // paid, so they travel with the contract rather than in a second round trip.
      invoices: {
        select: {
          id: true, invoiceNumber: true, status: true, grandTotal: true,
          paidAmount: true, paidAt: true, sentAt: true, invoiceDate: true,
          paymentLinkUrl: true, paymentLinkAt: true, scheduleTermId: true,
        },
        orderBy: { invoiceDate: 'asc' },
      },
      events: { orderBy: { at: 'asc' } },
    },
  })
  if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ contract })
}

const VALID_STATUSES = ['DRAFT', 'PENDING', 'SIGNED', 'CANCELLED'] as const
type Status = (typeof VALID_STATUSES)[number]

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const status = body.status as Status | undefined
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    const updated = await prisma.contract.update({
      where: { contractCode: code },
      data: {
        status,
        signedAt: status === 'SIGNED' ? new Date() : undefined,
        /* Cancelling recorded an event but stamped no date, so the timeline had
           nothing to place and a cancelled contract showed no sign of it. Reactivating
           clears it again, otherwise a contract that came back would still carry the
           date it was cancelled on. */
        archivedAt: status === 'CANCELLED' ? new Date() : status === 'PENDING' ? null : undefined,
      },
    })

    if (status === 'CANCELLED') await recordEvent(updated.id, 'cancelled', null, session.email)
    else if (status === 'PENDING') await recordEvent(updated.id, 'reactivated', 'Status set to awaiting signature', session.email)
    else if (status === 'SIGNED') await recordEvent(updated.id, 'signed', 'Marked signed by hand', session.email)
    return NextResponse.json({ ok: true, status: updated.status })
  } catch (err) {
    console.error('[contracts] PATCH failed', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  try {
    await prisma.contract.delete({ where: { contractCode: code } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contracts] DELETE failed', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
