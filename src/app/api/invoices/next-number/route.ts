import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { nextInvoiceNumber } from '@/lib/invoiceNumber'

export const dynamic = 'force-dynamic'

/**
 * GET /api/invoices/next-number — the next number in this year's series.
 *
 * A proposal, not a reservation: nothing is consumed by asking, so opening the new
 * invoice form and closing it again leaves no gap. The number is only fixed when an
 * invoice is actually saved with it.
 */
export async function GET() {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ invoiceNumber: await nextInvoiceNumber(prisma) })
}
