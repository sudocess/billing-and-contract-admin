import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/invoices/for-client?name=&email=&clientId=
 *
 * Everything already invoiced to this client, so a new contract can be priced against
 * what has actually been billed rather than from memory.
 *
 * Matching is deliberately by name OR email OR id, not by `clientId` alone. The same
 * person can own several `Client` rows, so an id-only lookup would silently miss
 * invoices raised against a different row and quietly overstate what is still owed —
 * which is the exact arithmetic this endpoint exists to get right.
 *
 * Cancelled invoices are excluded: a withdrawn claim was never owed and must not
 * offset anything.
 */
export async function GET(req: Request) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const name = (searchParams.get('name') || '').trim()
  const email = (searchParams.get('email') || '').trim()
  const clientId = (searchParams.get('clientId') || '').trim()

  if (!name && !email && !clientId) {
    return NextResponse.json({ invoices: [] })
  }

  const or: object[] = []
  if (clientId) or.push({ clientId })
  if (email) or.push({ clientEmail: { equals: email, mode: 'insensitive' } })
  if (name) {
    or.push({ clientName: { equals: name, mode: 'insensitive' } })
    // The invoice may carry the company name while the contract carries the person's,
    // or the reverse — both are stored as free text at the time of issue.
    or.push({ clientContact: { equals: name, mode: 'insensitive' } })
  }

  const invoices = await prisma.invoice.findMany({
    where: { AND: [{ OR: or }, { status: { not: 'CANCELLED' } }] },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      invoiceDate: true,
      grandTotal: true,
      subtotal: true,
      paidAmount: true,
      paidAt: true,
      clientName: true,
      reference: true,
      contractId: true,
    },
    orderBy: { invoiceDate: 'asc' },
  })

  return NextResponse.json({ invoices })
}
