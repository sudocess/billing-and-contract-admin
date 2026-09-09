/**
 * What a payment-schedule term still owes, given the invoices raised against it.
 *
 * A term is not simply "invoiced or not". An invoice can be sent for the full term and
 * come back short, and the shortfall has to become billable again without disturbing
 * the term itself or the invoice already settled. So the term is the obligation, and
 * invoices are attempts to collect it.
 *
 * The rule, per term:
 *
 *   accountedFor = (invoices still awaiting payment, at their face value)
 *                + (invoices whose payment has been confirmed, at what actually arrived)
 *   remaining    = term gross - accountedFor
 *
 * Face value is used only while an invoice is open, because that is the amount the
 * client has been asked for and is expected to pay. The moment a payment is confirmed
 * the invoice stops being a claim on the future and becomes a fact, so it counts for
 * what was received. Any difference falls back into `remaining` and can be re-invoiced.
 *
 * Worked through, on a €312.38 term:
 *
 *   no invoices                      remaining €312.38   → issue
 *   invoice €312.38, unpaid          remaining €0.00     → awaiting payment
 *   payment confirmed at €200.00     remaining €112.38   → issue remainder
 *   invoice €112.38, unpaid          remaining €0.00     → awaiting payment
 *   payment confirmed at €112.38     remaining €0.00     → settled
 *
 * Cancelled invoices are ignored throughout: a cancelled claim was never owed and must
 * not hold a term open, nor count towards what has been collected.
 */

import { toCents, fromCents, type ComputedRow } from './installments'

/** The invoice fields this calculation needs. Kept narrow so tests need no database. */
export interface TermInvoice {
  id: string
  invoiceNumber: string
  status: string
  grandTotal: number
  /** Null until a payment has actually been confirmed by hand. */
  paidAmount: number | null
  paidAt: Date | string | null
  sentAt: Date | string | null
  invoiceDate: Date | string
  paymentLinkUrl: string | null
  paymentLinkAt: Date | string | null
  scheduleTermId: string | null
}

export type TermState =
  /** Nothing billed yet. */
  | 'unbilled'
  /** Every cent of the term sits on an invoice that has not been settled. */
  | 'awaiting'
  /** Something was collected, but the term is not covered. */
  | 'partial'
  /** Collected in full. */
  | 'settled'

export interface TermBilling {
  termId: string
  /** Gross value of the term — what the client is actually asked to transfer. */
  gross: number
  /** Face value of invoices still awaiting a confirmed payment. */
  openBilled: number
  /** What has actually been received against this term. */
  received: number
  /** Still to be put on an invoice. Never negative. */
  remaining: number
  /** Received beyond the term's value. Normally zero; surfaced rather than hidden. */
  overpaid: number
  state: TermState
  invoices: TermInvoice[]
}

const isCancelled = (i: TermInvoice) => i.status === 'CANCELLED'

/** True once a payment has been recorded by hand, whatever the amount. */
export const isSettled = (i: TermInvoice): boolean => i.paidAmount !== null && i.paidAmount !== undefined

/**
 * Work out the billing position of one term.
 *
 * `row` carries the gross, which already has the schedule's VAT rate applied — so a
 * 0% schedule bills its net and a 21% one bills net plus VAT, without this function
 * needing to know which.
 */
export function computeTermBilling(row: ComputedRow, invoices: TermInvoice[]): TermBilling {
  const live = invoices.filter((i) => !isCancelled(i))

  const openBilledCents = live
    .filter((i) => !isSettled(i))
    .reduce((a, i) => a + toCents(i.grandTotal), 0)

  const receivedCents = live
    .filter(isSettled)
    .reduce((a, i) => a + toCents(i.paidAmount as number), 0)

  const grossCents = toCents(row.gross)
  const remainingCents = grossCents - openBilledCents - receivedCents

  let state: TermState
  if (live.length === 0) state = 'unbilled'
  else if (receivedCents >= grossCents) state = 'settled'
  else if (remainingCents > 0) state = 'partial'
  else state = 'awaiting'

  return {
    termId: row.id ?? '',
    gross: row.gross,
    openBilled: fromCents(openBilledCents),
    received: fromCents(receivedCents),
    remaining: fromCents(Math.max(0, remainingCents)),
    overpaid: fromCents(Math.max(0, receivedCents - grossCents)),
    state,
    invoices: live,
  }
}

/** Index invoices by the term they bill, so each row is matched in one pass. */
export function groupInvoicesByTerm(invoices: TermInvoice[]): Map<string, TermInvoice[]> {
  const out = new Map<string, TermInvoice[]>()
  for (const inv of invoices) {
    if (!inv.scheduleTermId) continue
    const list = out.get(inv.scheduleTermId)
    if (list) list.push(inv)
    else out.set(inv.scheduleTermId, [inv])
  }
  return out
}

/**
 * Whether a term can be invoiced, and for how much.
 *
 * Credits are never billable — they record money already invoiced before the schedule
 * began, so offering to invoice one would bill the client a second time for it.
 */
export function issuableAmount(row: ComputedRow, billing: TermBilling): number {
  if (row.kind === 'credit') return 0
  return billing.remaining
}
