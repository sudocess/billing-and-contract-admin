// Shared data/types for the Contract module.
// No database model exists yet — these mocks power the UI until a Prisma model is added.

export type PlanKey = 'basic' | 'business' | 'enterprise' | 'custom'
export type ContractType = 'standard' | 'phase' | 'extension' | 'custom'
export type PhaseKey = 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'custom'
export type LanguageKey = 'bilingual' | 'en' | 'nl'

export const PLANS: Record<PlanKey, { label: string; price: number; initFee: number; rate: number; description: string }> = {
  basic:      { label: 'Basic',      price: 799,  initFee: 50,  rate: 50, description: '5 pages, static, no apps' },
  business:   { label: 'Business',   price: 2499, initFee: 100, rate: 75, description: '8 pages, dynamic, 1 app' },
  enterprise: { label: 'Enterprise', price: 4999, initFee: 200, rate: 95, description: 'Custom scope, multi-app' },
  custom:     { label: 'Custom',     price: 0,    initFee: 0,   rate: 75, description: 'Special pricing / friend rate' },
}

export const ADDON_PRICES: Record<PlanKey, { seo: number; logo: number; support: number; domain: number }> = {
  basic:      { seo: 200, logo: 200, support: 100, domain: 20 },
  business:   { seo: 500, logo: 200, support: 500, domain: 50 },
  enterprise: { seo: 800, logo: 200, support: 900, domain: 100 },
  custom:     { seo: 500, logo: 200, support: 350, domain: 20 },
}

export const PHASE_LABELS: Record<PhaseKey, string> = {
  phase1: 'Phase 1 — Strategy & Structure',
  phase2: 'Phase 2 — Design & Prototype',
  phase3: 'Phase 3 — Build & Launch',
  phase4: 'Phase 4 — Handover & Acceptance',
  custom: 'Custom phase',
}

export type ClientPhaseStatus = 'signed' | 'active' | 'upcoming'

export type KnownClient = {
  name: string
  initials: string
  email: string
  type: string
  phases: { label: string; status: ClientPhaseStatus }[]
  currentPhase: number
  clientCode: string
  // Optional contact / legal details (Dutch B2B contract requirements)
  company?: string
  phone?: string
  kvk?: string
  vat?: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
  // Optional client-portal credentials
  dedicatedEmail?: string
  password?: string
}

export const KNOWN_CLIENTS: KnownClient[] = [
  {
    name: 'Joey de Laat',
    initials: 'JL',
    email: 'joey@example.com',
    type: 'Business Website',
    phases: [
      { label: 'Phase 1', status: 'signed' },
      { label: 'Phase 2', status: 'active' },
      { label: 'Phase 3', status: 'upcoming' },
    ],
    currentPhase: 2,
    clientCode: '8832104',
    company: 'De Laat Studio',
    phone: '+31 6 12 34 56 78',
    kvk: '88321040',
    city: 'Eindhoven',
    country: 'Netherlands',
  },
  {
    name: 'Marco Visser',
    initials: 'MV',
    email: 'marco@photographer.nl',
    type: 'Custom Agreement',
    phases: [{ label: 'Phase 1', status: 'signed' }],
    currentPhase: 1,
    clientCode: '5541290',
    phone: '+31 6 87 65 43 21',
    city: 'Den Bosch',
    country: 'Netherlands',
  },
]

export type ContractRow = {
  id: string
  client: string
  type: string
  phase: 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'custom'
  value: number
  status: 'signed' | 'pending'
}

export const MOCK_CONTRACTS: ContractRow[] = []

export function findKnownClient(name: string): KnownClient | undefined {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return undefined
  return KNOWN_CLIENTS.find(c => c.name.toLowerCase() === normalized)
}

/**
 * Save (merge) details for an existing matched client back into the in-memory
 * KNOWN_CLIENTS list. Empty fields in `updates` are ignored so we never
 * overwrite a stored value with a blank one.
 *
 * NOTE: This is in-memory only — until a `clients` table is added to Prisma,
 * the saved data is lost on page reload.
 */
export function upsertKnownClient(updates: Partial<KnownClient> & { name: string }): KnownClient {
  const idx = KNOWN_CLIENTS.findIndex(c => c.name.toLowerCase() === updates.name.toLowerCase())
  const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v)
  const cleaned: Partial<KnownClient> = {}
  for (const [k, v] of Object.entries(updates)) {
    const t = trim(v)
    if (t !== '' && t != null) (cleaned as Record<string, unknown>)[k] = t
  }
  if (idx >= 0) {
    KNOWN_CLIENTS[idx] = { ...KNOWN_CLIENTS[idx], ...cleaned }
    return KNOWN_CLIENTS[idx]
  }
  // Create a new client entry with sensible defaults
  const initials = updates.name
    .split(/\s+/)
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const created: KnownClient = {
    name: updates.name,
    initials: initials || '?',
    email: '',
    type: 'New client',
    phases: [],
    currentPhase: 0,
    clientCode: String(Math.floor(1000000 + Math.random() * 9000000)),
    ...cleaned,
  }
  KNOWN_CLIENTS.push(created)
  return created
}

/**
 * Contract codes are `YYYY-<client>-<NNNN>`, and the last segment is the VERSION.
 *
 * `2026-9025467-0001` is the original agreement; `2026-9025467-0002` is the revision
 * that replaces it. Keeping the middle segment identical is what makes a family of
 * revisions recognisable at a glance, in a filename, or read down the phone.
 *
 * The previous scheme appended `-v2`, which produced `...-0001-v2` and then
 * `...-0001-v2-v2` on the next revision — the code stopped being parseable at exactly
 * the point a contract had been revised more than once.
 */
const CODE_SHAPE = /^(\d{4})-([A-Za-z0-9]+)-(\d{4})$/

export function parseContractCode(code: string): { year: string; client: string; version: number } | null {
  const m = CODE_SHAPE.exec(code.trim())
  if (!m) return null
  return { year: m[1], client: m[2], version: Number(m[3]) }
}

/**
 * The next version in the same family, e.g. `2026-9025467-0001` -> `2026-9025467-0002`.
 *
 * `taken` lets the caller skip codes already in the database, so a gap left by an
 * earlier revision can never produce a duplicate.
 */
export function nextContractVersion(code: string, taken: Iterable<string> = []): string {
  const parsed = parseContractCode(code)
  // Codes that predate this shape keep the old suffix behaviour rather than being
  // silently renamed — renaming an issued contract is never worth the tidiness.
  if (!parsed) return `${code}-v2`

  const used = new Set(taken)
  let next = parsed.version + 1
  let candidate = `${parsed.year}-${parsed.client}-${String(next).padStart(4, '0')}`
  while (used.has(candidate)) {
    next += 1
    candidate = `${parsed.year}-${parsed.client}-${String(next).padStart(4, '0')}`
  }
  return candidate
}

export function nextContractId(clientCode: string, phaseIndex: number): string {
  const year = new Date().getFullYear()
  const padded = String(phaseIndex).padStart(4, '0')
  return `${year}-${clientCode || '0000000'}-${padded}`
}
