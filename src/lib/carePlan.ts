/**
 * Care plan tiers and the comparison table that goes in front of the client.
 *
 * A care plan is quoted as three options with one recommended, not as a single price:
 * the middle option is chosen far more often when there is something either side of
 * it, and the comparison is what makes the recommended tier look like a judgement
 * rather than an ask.
 *
 * Tiers are per client. The defaults below are a starting point that survives full
 * utilisation — at 4 included hours, €349 is €87.25/hr — and every number is editable.
 * That direction matters: a default that loses money is a default that gets sent.
 */

export interface CareTier {
  key: 'basic' | 'business' | 'enterprise'
  name: string
  /** The rate the plan is built on. With hours, this is what sets the monthly fee. */
  hourlyRate: number
  includedHours: number
  /**
   * Rate for hours beyond the included allowance. Kept separate and stored, because
   * an invoice raised later for extra hours reads it off the contract rather than
   * asking anyone to remember what was agreed.
   */
  overageRate: number
  blurb: string
}

/**
 * The monthly fee is derived, never typed.
 *
 * When the fee and the hours were both editable it was possible to set €349 against
 * 30 hours and quietly agree to €11.63 an hour. Deriving it means the rate is the
 * thing chosen and the fee simply follows, so that number cannot drift out of view.
 */
export const monthlyFee = (t: CareTier): number =>
  Math.round(t.hourlyRate * t.includedHours * 100) / 100

/**
 * One row of the comparison table.
 *
 * `included` is what the row means; `values` is the detail when a tick is not enough
 * ("Daily", "Within 24 hrs"). An excluded cell prints a dash whatever text it holds,
 * so unticking something is unambiguous rather than depending on the wording left
 * behind in the box.
 */
export interface CareFeature {
  label: string
  included: [boolean, boolean, boolean]
  values: [string, string, string]
}

/** What a cell prints: a dash when excluded, its detail when it has one, else a tick. */
export function cellText(f: CareFeature, col: number): string {
  if (!f.included[col]) return '—'
  return f.values[col]?.trim() || '✓'
}

export interface CarePlanSpec {
  tiers: [CareTier, CareTier, CareTier]
  /** The tier put forward. Advisory — it is what the proposal highlights. */
  recommended: CareTier['key']
  /**
   * The tier actually agreed. Null while this is still a proposal.
   *
   * This is the difference between a document offering three options and a document
   * binding one: until a tier is chosen the contract has no single fee to state, and
   * printing one anyway would assert an agreement that has not been reached.
   */
  selectedTier: CareTier['key'] | null
  features: CareFeature[]
  startDate: string
  noticeDays: number
  includesInfrastructure: boolean
  notes: string
  /** Mirrors of the recommended tier, so the billing sections need no tier logic. */
  includedHours: number
  hourlyRate: number
  monthlyFee: number
  effectiveRate: number
}

export const DEFAULT_TIERS: [CareTier, CareTier, CareTier] = [
  {
    key: 'basic',
    name: 'Basic',
    hourlyRate: 149,
    includedHours: 1,
    overageRate: 75,
    blurb: 'Online and protected, with a small monthly allocation',
  },
  {
    key: 'business',
    name: 'Business',
    hourlyRate: 87.25,
    includedHours: 4,
    overageRate: 75,
    blurb: 'Everything in Basic, plus campaign work and a 24-hour response',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    hourlyRate: 68.75,
    includedHours: 8,
    overageRate: 75,
    blurb: 'Largest allocation, same-day response, priority scheduling',
  },
]

/**
 * Default comparison rows.
 *
 * Included hours and the overage rate are deliberately absent: both are rendered from
 * the tier figures themselves, so the table can never contradict the prices printed
 * above it. A row that repeats a number is a row that eventually disagrees with it.
 */
export const DEFAULT_FEATURES: CareFeature[] = [
  f('Hosting, database & deployment', [true, true, true]),
  f('Domain, SSL & business email renewals', [true, true, true]),
  f('Backups', [true, true, true], ['Weekly', 'Daily', 'Daily + restore test']),
  f('Security patches & dependency updates', [true, true, true], ['Monthly', 'Monthly', 'Monthly']),
  f('Uptime monitoring', [true, true, true]),
  f('Bug fixes on delivered features', [true, true, true]),
  f('Content & gallery update turnaround', [true, true, true], ['Within 2 working days', 'Within 24 hrs', 'Same day']),
  f('Response time to new requests', [true, true, true], ['Within 2 working days', 'Within 24 hrs', 'Same day']),
  f('Urgent site-down response', [true, true, true], ['Same working day', 'Same working day', 'Priority, same day']),
  f('Seasonal campaign page', [false, true, true], ['', 'One per quarter', 'One per quarter + priority slot']),
]

function f(
  label: string,
  included: [boolean, boolean, boolean],
  values: [string, string, string] = ['', '', ''],
): CareFeature {
  return { label, included, values }
}

export const effectiveRate = (t: CareTier): number =>
  t.includedHours > 0 ? monthlyFee(t) / t.includedHours : 0

/** Below this an included hour is worth less than it costs to work. */
export const RATE_FLOOR = 50

export type RateVerdict = 'good' | 'thin' | 'loss'

/**
 * Judged on the rate itself, not against the overage rate.
 *
 * A larger plan is meant to carry a lower rate than ad-hoc hours — comparing the two
 * would have flagged every top tier amber for doing exactly what it is designed to do.
 * What matters is whether an hour is still worth working.
 */
export function rateVerdict(t: CareTier): RateVerdict {
  if (t.includedHours === 0) return 'good'
  if (t.hourlyRate < RATE_FLOOR) return 'loss'
  if (t.hourlyRate < RATE_FLOOR * 1.3) return 'thin'
  return 'good'
}

export function findTier(spec: { tiers: CareTier[]; recommended: string }): CareTier {
  return spec.tiers.find(t => t.key === spec.recommended) ?? spec.tiers[0]
}

/** Narrow stored JSON into a spec, tolerating plans saved before tiers existed. */
export function parseCarePlan(value: unknown): CarePlanSpec | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.monthlyFee !== 'number' && !Array.isArray(v.tiers)) return null

  const healTier = (t: Record<string, unknown>, fallback: CareTier): CareTier => {
    const hours = Number(t.includedHours) || 0
    // Tiers written when the fee was typed carry no hourlyRate; derive it back out so
    // the stored fee is preserved exactly rather than recomputed from a guess.
    const rate = Number.isFinite(Number(t.hourlyRate)) && Number(t.hourlyRate) > 0
      ? Number(t.hourlyRate)
      : hours > 0 ? (Number(t.monthlyFee) || 0) / hours : 0
    return {
      key: (t.key as CareTier['key']) ?? fallback.key,
      name: String(t.name ?? fallback.name),
      hourlyRate: Math.round(rate * 100) / 100,
      includedHours: hours,
      overageRate: Number(t.overageRate) || 0,
      blurb: String(t.blurb ?? ''),
    }
  }

  const tiers = Array.isArray(v.tiers) && v.tiers.length === 3
    ? (v.tiers as Record<string, unknown>[]).map((t, i) => healTier(t, DEFAULT_TIERS[i]))
    // A plan saved with a single fee still renders: it becomes its own middle tier,
    // with the other two left off rather than invented.
    : ([
        { ...DEFAULT_TIERS[0], hourlyRate: 0, includedHours: 0 },
        {
          ...DEFAULT_TIERS[1],
          includedHours: Number(v.includedHours) || 0,
          hourlyRate: Number(v.includedHours) ? (Number(v.monthlyFee) || 0) / Number(v.includedHours) : 0,
          overageRate: Number(v.hourlyRate) || 0,
        },
        { ...DEFAULT_TIERS[2], hourlyRate: 0, includedHours: 0 },
      ] as [CareTier, CareTier, CareTier])

  const recommended = (['basic', 'business', 'enterprise'] as const).includes(v.recommended as never)
    ? (v.recommended as CareTier['key'])
    : 'business'

  const selected = (['basic', 'business', 'enterprise'] as const).includes(v.selectedTier as never)
    ? (v.selectedTier as CareTier['key'])
    : null
  // Once a tier is agreed it governs; until then the recommendation stands in.
  const chosen = tiers.find(t => t.key === (selected ?? recommended)) ?? tiers[1]

  return {
    tiers: tiers as [CareTier, CareTier, CareTier],
    recommended,
    features: Array.isArray(v.features)
      ? (v.features as CareFeature[]).map(row => ({
          label: String(row.label ?? ''),
          // Rows written before `included` existed are treated as included wherever
          // they carried any text at all, which is what they meant at the time.
          included: Array.isArray(row.included)
            ? (row.included.map(Boolean) as [boolean, boolean, boolean])
            : ((row.values ?? ['', '', '']).map(x => !!String(x ?? '').trim()) as [boolean, boolean, boolean]),
          values: ((row.values ?? ['', '', '']) as [string, string, string]),
        }))
      : DEFAULT_FEATURES,
    selectedTier: (['basic', 'business', 'enterprise'] as const).includes(v.selectedTier as never)
      ? (v.selectedTier as CareTier['key'])
      : null,
    startDate: typeof v.startDate === 'string' ? v.startDate : '',
    noticeDays: Number(v.noticeDays) || 30,
    includesInfrastructure: v.includesInfrastructure !== false,
    notes: typeof v.notes === 'string' ? v.notes : '',
    includedHours: chosen.includedHours,
    hourlyRate: chosen.overageRate,
    monthlyFee: monthlyFee(chosen),
    effectiveRate: Math.round(effectiveRate(chosen) * 100) / 100,
  }
}
