/**
 * The invoice numbering series.
 *
 * One format, one series per year: `YYYY-NNN`, counting from 001.
 *
 * The number is derived from the invoices that actually exist rather than held in a
 * counter. A counter has to be incremented before the invoice is written, so every
 * abandoned draft burns a number and punches a gap in the series — and a gapless
 * series is precisely what the bookkeeping requires. Deriving it means an abandoned
 * draft costs nothing and the next number is always the obvious one.
 *
 * Only strictly conforming numbers are counted. The series already contains
 * `2026-001-143` and `2026-00105`, typed by hand back when the form seeded every new
 * invoice with `-001`; reading those as sequence 143 and 105 would jump the series a
 * hundred numbers forward on the strength of two typos. They are left alone — both
 * are issued, and an issued invoice's number is a fixed record — but they no longer
 * steer what comes next.
 */

import type { PrismaClient } from '@prisma/client'

/** `2026-003` and nothing else: four digits, a hyphen, exactly three digits. */
const CONFORMING = /^(\d{4})-(\d{3})$/

export function formatInvoiceNumber(year: number, seq: number): string {
  return `${year}-${String(seq).padStart(3, '0')}`
}

/** Sequence number if `n` is in the canonical format for `year`, else null. */
export function conformingSeq(n: string, year: number): number | null {
  const m = CONFORMING.exec(n.trim())
  if (!m || Number(m[1]) !== year) return null
  return Number(m[2])
}

/**
 * Highest sequence in canonical format for `year`, or 0.
 *
 * Exported so the historical oddities stay pinned by a test: given the three numbers
 * actually in the books, this must return 2 — not 143, and not 105.
 */
export function highestConformingSeq(numbers: string[], year: number): number {
  return numbers.reduce((max, n) => {
    const seq = conformingSeq(n, year)
    return seq !== null && seq > max ? seq : max
  }, 0)
}

async function numbersForYear(prisma: PrismaClient, year: number): Promise<string[]> {
  const rows = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: `${year}-` } },
    select: { invoiceNumber: true },
  })
  return rows.map((r) => r.invoiceNumber)
}

/**
 * The next number in the series.
 *
 * Skips forward over anything already taken, so a number typed by hand into the form
 * cannot be handed out a second time and trip the unique constraint mid-save.
 */
export async function nextInvoiceNumber(
  prisma: PrismaClient,
  year = new Date().getFullYear(),
): Promise<string> {
  const existing = await numbersForYear(prisma, year)
  const taken = new Set(existing)

  let seq = highestConformingSeq(existing, year) + 1
  while (taken.has(formatInvoiceNumber(year, seq))) seq += 1

  return formatInvoiceNumber(year, seq)
}
