/**
 * Next invoice number in the yearly series.
 *
 * The existing numbers are not a clean sequence — 2026-002, 2026-00105 and
 * 2026-001-143 all coexist — so this reads the highest first number group used this
 * year and adds one, rather than counting rows. Counting would re-issue a number
 * already in use the moment anything is cancelled or deleted.
 *
 * The result is a proposal, not a commitment: an invoice is raised as a draft and the
 * number stays editable until it is sent, because the bookkeeping series is the
 * accountant's call and not something this app should decide unilaterally.
 */

import type { PrismaClient } from '@prisma/client'

const YEAR_PREFIX = /^(\d{4})-(\d+)/

export function parseInvoiceNumber(n: string): { year: number; seq: number } | null {
  const m = YEAR_PREFIX.exec(n.trim())
  if (!m) return null
  return { year: Number(m[1]), seq: Number(m[2]) }
}

/**
 * Highest sequence used in `year`, or 0. Exported for the tests that pin the odd
 * historical formats above.
 */
export function highestSeq(numbers: string[], year: number): number {
  return numbers.reduce((max, n) => {
    const p = parseInvoiceNumber(n)
    return p && p.year === year && p.seq > max ? p.seq : max
  }, 0)
}

export async function nextInvoiceNumber(
  prisma: PrismaClient,
  year = new Date().getFullYear()
): Promise<string> {
  const rows = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: `${year}-` } },
    select: { invoiceNumber: true },
  })
  const seq = highestSeq(rows.map((r) => r.invoiceNumber), year) + 1
  return `${year}-${String(seq).padStart(3, '0')}`
}
