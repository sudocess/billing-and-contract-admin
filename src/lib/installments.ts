/**
 * Payment schedules.
 *
 * Two modes:
 *   - 'phases'  — the original 30/40/30 milestone split, tied to project phases.
 *   - 'monthly' — N monthly terms with real due dates.
 *
 * The legacy `p1/p2/p3` columns are left untouched, so contracts written before this
 * change keep rendering exactly as they did.
 *
 * A schedule carries two kinds of row:
 *   - credits     — already paid or already invoiced before the schedule starts
 *   - instalments — still to be billed
 *
 * Credits are printed as their own rows rather than silently netted off. That is what
 * stops a repeat of the old table, where three rows summing to €2,389 sat under a
 * stated total of €2,499 with the €110 difference explained only in a footnote.
 *
 * All stored amounts are NET (excl. VAT), matching how contract totals are stated.
 * VAT is derived at render time so a rate change never leaves stale numbers behind.
 */

export type ScheduleMode = 'phases' | 'monthly'

export interface ScheduleRow {
  /** Short label, e.g. "Term 3 of 5" or "Paid — invoice 2026-00105". */
  label: string
  /** Condition or explanation, e.g. "Due on signing" or "Logo + pre-draft". */
  note: string
  /** Net amount in euros, excl. VAT. */
  amount: number
  /** ISO yyyy-mm-dd, or null for milestone rows with no fixed date. */
  dueDate: string | null
}

export interface PaymentSchedule {
  mode: ScheduleMode
  /** Percentage, e.g. 21. Zero for reverse-charge or intra-EU supplies. */
  vatRate: number
  /** Months between terms — 1 for monthly. Ignored in 'phases' mode. */
  intervalMonths: number
  credits: ScheduleRow[]
  instalments: ScheduleRow[]
}

export const MAX_INSTALMENTS = 24
export const DEFAULT_VAT_RATE = 21

export const toCents = (amount: number): number => Math.round(amount * 100)
export const fromCents = (cents: number): number => cents / 100

/**
 * Split `totalCents` into `n` parts that sum back to exactly `totalCents`.
 *
 * The indivisible remainder is spread one cent at a time across the earliest parts,
 * rather than dumped on the final one. €2,039.00 over 5 gives five clean €407.80;
 * €1,000 over 3 gives €333.34, €333.33, €333.33 — and either way the column adds up.
 */
export function allocateCents(totalCents: number, n: number): number[] {
  const sign = totalCents < 0 ? -1 : 1
  const abs = Math.abs(totalCents)
  const base = Math.floor(abs / n)
  const remainder = abs - base * n
  return Array.from({ length: n }, (_, i) => sign * (base + (i < remainder ? 1 : 0)))
}

export function sumRows(rows: ScheduleRow[]): number {
  return fromCents(rows.reduce((acc, r) => acc + toCents(r.amount), 0))
}

/** Credits + instalments. Should equal the contract's total project value. */
export function scheduleTotal(schedule: PaymentSchedule): number {
  return fromCents(toCents(sumRows(schedule.credits)) + toCents(sumRows(schedule.instalments)))
}

export function scheduleBalances(schedule: PaymentSchedule, contractTotal: number): boolean {
  return toCents(scheduleTotal(schedule)) === toCents(contractTotal)
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const probe = new Date(Date.UTC(y, m - 1 + months, 1))
  // Clamp to the last day of the target month, so 31 Jan + 1 month is 28/29 Feb
  // rather than silently rolling into March.
  const lastDay = new Date(Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth() + 1, 0)).getUTCDate()
  probe.setUTCDate(Math.min(d, lastDay))
  return probe.toISOString().slice(0, 10)
}

/** Last calendar day of the month containing `iso`. */
export function endOfMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

/**
 * How successive due dates are derived from the first one.
 *   'same-day'     — 30 Sep, 30 Oct, 30 Nov, 30 Dec, 30 Jan
 *   'end-of-month' — 30 Sep, 31 Oct, 30 Nov, 31 Dec, 31 Jan
 *
 * These diverge whenever the start date is the last day of a short month, so the
 * contract has to commit to one rather than leave it to be inferred.
 */
export type DateAnchor = 'same-day' | 'end-of-month'

/** Build N monthly terms covering `remaining`, dated from `startDate`. */
export function buildMonthlyInstalments(
  remaining: number,
  months: number,
  startDate: string | null,
  intervalMonths = 1,
  anchor: DateAnchor = 'same-day'
): ScheduleRow[] {
  const n = Math.max(1, Math.min(MAX_INSTALMENTS, Math.floor(months)))
  const parts = allocateCents(toCents(remaining), n)

  return parts.map((cents, i) => {
    let dueDate: string | null = null
    if (startDate) {
      const stepped = addMonths(startDate, i * intervalMonths)
      dueDate = anchor === 'end-of-month' ? endOfMonth(stepped) : stepped
    }
    return {
      label: `Term ${i + 1} of ${n}`,
      note: '',
      amount: fromCents(cents),
      dueDate,
    }
  })
}

/** Re-label rows after one is added or removed, so "Term 2 of 5" stays truthful. */
export function relabel(rows: ScheduleRow[]): ScheduleRow[] {
  return rows.map((r, i) => ({ ...r, label: `Term ${i + 1} of ${rows.length}` }))
}

/* ────────────────────────────────────────────────────────────────────────────
   Rendering — one computation shared by the wizard, the contract HTML and the PDF,
   so all three can never disagree about a cent.
   ──────────────────────────────────────────────────────────────────────────── */

export interface ComputedRow extends ScheduleRow {
  kind: 'credit' | 'instalment'
  vat: number
  gross: number
  /** Net still outstanding after this row. Credits reduce it too. */
  balance: number
}

export interface ComputedSchedule {
  rows: ComputedRow[]
  credits: ComputedRow[]
  instalments: ComputedRow[]
  vatRate: number
  creditsNet: number
  scheduledNet: number
  totalNet: number
  totalVat: number
  totalGross: number
}

/**
 * Expand a schedule into printable rows with VAT and a running balance.
 *
 * VAT is computed on the schedule total first, then allocated across the instalment
 * rows so the per-row VAT column sums to exactly 21% of the scheduled net. Rounding
 * each row independently would drift — five rows of €407.80 each rounding to €85.64
 * would total €428.20 against a true €428.19.
 */
export function computeSchedule(schedule: PaymentSchedule): ComputedSchedule {
  const vatRate = Number.isFinite(schedule.vatRate) ? schedule.vatRate : DEFAULT_VAT_RATE

  const creditsNetCents = schedule.credits.reduce((a, r) => a + toCents(r.amount), 0)
  const scheduledNetCents = schedule.instalments.reduce((a, r) => a + toCents(r.amount), 0)

  // Total VAT first, then distribute — never round row by row.
  const totalVatCents = Math.round((scheduledNetCents * vatRate) / 100)
  const vatParts =
    schedule.instalments.length > 0
      ? allocateVatProportionally(schedule.instalments, totalVatCents)
      : []

  let balanceCents = creditsNetCents + scheduledNetCents

  const credits: ComputedRow[] = schedule.credits.map((r) => {
    balanceCents -= toCents(r.amount)
    return {
      ...r,
      kind: 'credit' as const,
      vat: 0,
      gross: r.amount,
      balance: fromCents(balanceCents),
    }
  })

  const instalments: ComputedRow[] = schedule.instalments.map((r, i) => {
    const netCents = toCents(r.amount)
    const vatCents = vatParts[i] ?? 0
    balanceCents -= netCents
    return {
      ...r,
      kind: 'instalment' as const,
      vat: fromCents(vatCents),
      gross: fromCents(netCents + vatCents),
      balance: fromCents(balanceCents),
    }
  })

  return {
    rows: [...credits, ...instalments],
    credits,
    instalments,
    vatRate,
    creditsNet: fromCents(creditsNetCents),
    scheduledNet: fromCents(scheduledNetCents),
    totalNet: fromCents(creditsNetCents + scheduledNetCents),
    totalVat: fromCents(totalVatCents),
    totalGross: fromCents(scheduledNetCents + totalVatCents),
  }
}

/**
 * Share `totalVatCents` across rows in proportion to their net amount, giving any
 * leftover cents to the earliest rows. Guarantees the parts sum to the total.
 */
function allocateVatProportionally(rows: ScheduleRow[], totalVatCents: number): number[] {
  const nets = rows.map((r) => toCents(r.amount))
  const netSum = nets.reduce((a, b) => a + b, 0)
  if (netSum === 0) return rows.map(() => 0)

  const exact = nets.map((n) => (n * totalVatCents) / netSum)
  const floored = exact.map(Math.floor)
  let leftover = totalVatCents - floored.reduce((a, b) => a + b, 0)

  // Hand the spare cents to the rows with the largest fractional part first.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)

  const out = [...floored]
  for (const { i } of order) {
    if (leftover <= 0) break
    out[i] += 1
    leftover -= 1
  }
  return out
}

const EUR = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

export const fmtEuro = (amount: number): string => EUR.format(amount)

// Fixed abbreviations. Intl's en-GB "short" month renders September as "Sept",
// which is the only four-letter entry and looks like a typo in a column of dates.
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDueDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${String(d).padStart(2, '0')} ${MONTHS_SHORT[m - 1]} ${y}`
}

/** Narrow unknown JSON from the database into a schedule, or null if it isn't one. */
export function parseSchedule(value: unknown): PaymentSchedule | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<PaymentSchedule>
  if (!Array.isArray(v.instalments)) return null

  const clean = (rows: unknown[]): ScheduleRow[] =>
    rows
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        label: String(r.label ?? ''),
        note: String(r.note ?? ''),
        amount: Number(r.amount) || 0,
        dueDate: typeof r.dueDate === 'string' && r.dueDate ? r.dueDate : null,
      }))

  return {
    mode: v.mode === 'monthly' ? 'monthly' : 'phases',
    vatRate: Number.isFinite(v.vatRate) ? Number(v.vatRate) : DEFAULT_VAT_RATE,
    intervalMonths: Number.isFinite(v.intervalMonths) ? Number(v.intervalMonths) : 1,
    credits: clean(Array.isArray(v.credits) ? v.credits : []),
    instalments: clean(v.instalments),
  }
}
