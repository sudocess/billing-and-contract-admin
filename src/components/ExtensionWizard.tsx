'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  fmtEuro, fmtDueDate, toCents, fromCents,
  computeSchedule, buildMonthlyInstalments, allocateCents, newRowId,
  MAX_INSTALMENTS, DEFAULT_VAT_RATE,
  type PaymentSchedule, type ScheduleRow, type DateAnchor,
} from '@/lib/installments'
import {
  DeliveryCard, openContractPrintWindow, type PreviewData,
} from '@/components/ContractWizard'
import ContractDocPreview from '@/components/ContractDocPreview'
import WizardHeaderActions from '@/components/WizardHeaderActions'
import { newChildContractCode } from '@/lib/contracts'

/**
 * Scope extension builder.
 *
 * A scope extension is new work outside an agreement that has already been signed. It
 * gets its own number, its own price and its own signature, and it never edits the
 * agreement it adds to. Two things follow from that and shape this whole flow:
 *
 *   - Only a SIGNED agreement can be extended. A draft is still being negotiated and a
 *     contract awaiting signature can still be revised, so for both of those the right
 *     move is to change that document, not to bolt a second one onto it.
 *   - The client comes with the agreement rather than being chosen separately, so
 *     picking the parent is also picking the client, and the details carry across.
 */

type ParentContract = {
  id: string
  contractCode: string
  status: string
  contractType: string
  projectName: string | null
  phaseLabel: string
  totalValue: number
  signedAt: string | null
  createdAt: string
  parentContractId: string | null
  clientId: string | null
  clientName: string
  clientCompany: string | null
  clientEmail: string | null
  clientPhone: string | null
  clientKvk: string | null
  clientVat: string | null
  clientAddress: string | null
  clientPostalCode: string | null
  clientCity: string | null
  clientCountry: string | null
  dedicatedEmail: string | null
}

type ClientDetails = PreviewData['client']

export type ExtensionPrefill = {
  contractCode: string
  extendsCode: string
  parentContractId: string | null
  projectName: string | null
  deliverables: string | null
  exclusions: string | null
  phaseStart: string | null
  phaseEnd: string | null
  language: string
  total: number
  client: ClientDetails
  schedule: PaymentSchedule | null
}

/** How the extension is paid for. Each builds real rows; none is a special case later. */
type PayMode = 'full' | 'terms' | 'phases'

const STEPS = [
  { num: 1, label: 'Agreement', sub: 'What is being extended' },
  { num: 2, label: 'Feature', sub: 'Scope & value' },
  { num: 3, label: 'Payment', sub: 'Terms & VAT' },
  { num: 4, label: 'Generate', sub: 'Preview & send' },
]

const PHASE_PLAN: { label: string; pct: number; note: string }[] = [
  { label: 'Payment 1 (30%)', pct: 30, note: 'Due before work on this extension begins' },
  { label: 'Payment 2 (40%)', pct: 40, note: 'Due at the agreed midpoint' },
  { label: 'Payment 3 (30%)', pct: 30, note: 'Due before final delivery' },
]

/** Up to two initials for the avatar, from whatever name the row actually carries. */
function initials(name: string): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

/** The family segment of an extension code, so E1 reads as E1 and not as the full code. */
function extLabel(code: string): string {
  return /-((?:E|C)\d+)-\d{4}$/.exec(code)?.[1] ?? code
}

/* Colour carries the phase and nothing else. The kind of agreement stays on the
   neutral badge: two independent colour systems on one card means neither is read. */
function phaseBadge(r: { contractType: string; phaseLabel: string }): string {
  if (r.contractType === 'care') return 'badge-neutral'
  const n = /Phase\s*(\d)/.exec(r.phaseLabel)?.[1]
  return n === '1' ? 'badge-phase1'
    : n === '2' ? 'badge-phase2'
    : n === '3' ? 'badge-phase3'
    : 'badge-custom'
}

function shortPhase(r: { contractType: string; phaseLabel: string }): string {
  if (r.contractType === 'care') return 'Care plan'
  const n = /Phase\s*(\d)/.exec(r.phaseLabel)?.[1]
  return n ? `Phase ${n}` : 'Project'
}

const todayIso = () => new Date().toISOString().slice(0, 10)

/** Split a total across fixed percentages, to the cent, with no drift on the last row. */
function splitByPercent(total: number, pcts: number[]): number[] {
  const cents = toCents(total)
  const out: number[] = []
  let used = 0
  for (let i = 0; i < pcts.length - 1; i++) {
    const part = Math.round((cents * pcts[i]) / 100)
    out.push(part)
    used += part
  }
  out.push(cents - used)
  return out.map(fromCents)
}

export default function ExtensionWizard({ prefill }: { prefill?: ExtensionPrefill } = {}) {
  const router = useRouter()
  const editing = !!prefill
  const [step, setStep] = useState(editing ? 2 : 1)

  /* ── Step 1: which agreement ─────────────────────────────────────────── */
  const [rows, setRows] = useState<ParentContract[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [parent, setParent] = useState<ParentContract | null>(null)
  const [allCodes, setAllCodes] = useState<string[]>([])
  const [contractCode, setContractCode] = useState(prefill?.contractCode ?? '')
  const [extendsCode, setExtendsCode] = useState(prefill?.extendsCode ?? '')
  const [parentId, setParentId] = useState<string | null>(prefill?.parentContractId ?? null)
  const [client, setClient] = useState<ClientDetails>(
    prefill?.client ?? {
      name: '', company: '', email: '', phone: '', kvk: '', vat: '',
      address: '', postalCode: '', city: '', country: 'Netherlands', dedicatedEmail: '',
    },
  )

  /* ── Step 2: the feature ─────────────────────────────────────────────── */
  const [featureName, setFeatureName] = useState(prefill?.projectName ?? '')
  const [startDate, setStartDate] = useState(prefill?.phaseStart ?? todayIso())
  const [endDate, setEndDate] = useState(prefill?.phaseEnd ?? '')
  const [deliverables, setDeliverables] = useState(prefill?.deliverables ?? '')
  const [exclusions, setExclusions] = useState(prefill?.exclusions ?? '')
  const [totalVal, setTotalVal] = useState(prefill ? String(prefill.total || '') : '')

  /* ── Step 3: payment ─────────────────────────────────────────────────── */
  const [payMode, setPayMode] = useState<PayMode>(() => {
    const n = prefill?.schedule?.instalments.length ?? 0
    if (n === 1) return 'full'
    if (n === 3 && prefill?.schedule?.mode === 'phases') return 'phases'
    return n > 1 ? 'terms' : 'full'
  })
  const [vatRate, setVatRate] = useState(String(prefill?.schedule?.vatRate ?? DEFAULT_VAT_RATE))
  const [termCount, setTermCount] = useState(
    String(Math.max(2, prefill?.schedule?.instalments.length ?? 3)),
  )
  const [firstDue, setFirstDue] = useState(
    prefill?.schedule?.instalments[0]?.dueDate ?? prefill?.phaseStart ?? todayIso(),
  )
  const [anchor, setAnchor] = useState<DateAnchor>('end-of-month')
  const [terms, setTerms] = useState<ScheduleRow[]>(prefill?.schedule?.instalments ?? [])
  const [amountDraft, setAmountDraft] = useState<{ key: string; value: string } | null>(null)
  // Set the moment rows are rebuilt from the inputs above, cleared when a row is typed
  // into. Without it, correcting a due date silently threw away every hand-set amount.
  const [autoBuilt, setAutoBuilt] = useState(!prefill)

  /* ── Step 4 ──────────────────────────────────────────────────────────── */
  const [previewLang, setPreviewLang] = useState<'en' | 'nl'>(
    prefill?.language === 'nl' ? 'nl' : 'en',
  )
  const [ownerReg, setOwnerReg] = useState<{ kvk: string; vat: string }>({ kvk: '', vat: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const total = parseFloat(totalVal) || 0

  useEffect(() => {
    fetch('/api/settings/owner', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(o => { if (o) setOwnerReg({ kvk: o.ownKvk || '', vat: o.ownVat || '' }) })
      .catch(() => {/* prints no registration line, which is the correct default */})
  }, [])

  useEffect(() => {
    fetch('/api/contracts', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { contracts: [] }))
      .then((j: { contracts: ParentContract[] }) => {
        const all = j.contracts ?? []
        setRows(all)
        setAllCodes(all.map(c => c.contractCode))
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  /* Only signed agreements can be extended, and only the client's own signature
     counts. A contract sitting at PENDING has been sent but not agreed, so there is
     nothing yet to extend, and revising it is both cheaper and more honest. */
  const signed = useMemo(
    () => rows.filter(r => r.status === 'SIGNED' && !!r.signedAt),
    [rows],
  )

  /** Extensions already hanging off each agreement, so a third one is not a surprise. */
  const extensionsByParent = useMemo(() => {
    const map = new Map<string, ParentContract[]>()
    for (const r of rows) {
      if (r.contractType !== 'extension' || !r.parentContractId) continue
      const list = map.get(r.parentContractId)
      if (list) list.push(r)
      else map.set(r.parentContractId, [r])
    }
    return map
  }, [rows])

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const map = new Map<string, ParentContract[]>()
    for (const r of signed) {
      const hay = `${r.contractCode} ${r.clientName} ${r.clientCompany ?? ''} ${r.projectName ?? ''} ${r.phaseLabel}`.toLowerCase()
      if (q && !hay.includes(q)) continue
      const key = (r.clientCompany || r.clientName || 'Unknown').trim()
      const list = map.get(key)
      if (list) list.push(r)
      else map.set(key, [r])
    }
    return [...map.entries()]
      .map(([name, list]) => ({
        name,
        list: list.sort((a, b) => (a.signedAt ?? '') < (b.signedAt ?? '') ? 1 : -1),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [signed, search])

  function choose(r: ParentContract) {
    setParent(r)
    setExtendsCode(r.contractCode)
    setParentId(r.id)
    setClient({
      name: r.clientName ?? '',
      company: r.clientCompany ?? '',
      email: r.clientEmail ?? '',
      phone: r.clientPhone ?? '',
      kvk: r.clientKvk ?? '',
      vat: r.clientVat ?? '',
      address: r.clientAddress ?? '',
      postalCode: r.clientPostalCode ?? '',
      city: r.clientCity ?? '',
      country: r.clientCountry ?? 'Netherlands',
      dedicatedEmail: r.dedicatedEmail ?? '',
    })
    // The client segment of the parent's code, so the extension joins the same family
    // even where the client row itself has drifted.
    const clientCode = /^\d{4}-([A-Za-z0-9]+)-/.exec(r.contractCode)?.[1] ?? '0000000'
    setContractCode(newChildContractCode(clientCode, 'extension', allCodes))
    const n = (extensionsByParent.get(r.id)?.length ?? 0) + 1
    setFeatureName(prev => prev || (r.projectName ? `${r.projectName}, extension ${n}` : ''))
  }

  /* ── The schedule ────────────────────────────────────────────────────── */

  const buildRows = useCallback((): ScheduleRow[] => {
    if (payMode === 'full') {
      return [{
        id: newRowId(),
        label: 'Full payment',
        note: 'Due on signature of this extension',
        amount: total,
        dueDate: firstDue || null,
      }]
    }
    if (payMode === 'phases') {
      const parts = splitByPercent(total, PHASE_PLAN.map(p => p.pct))
      return PHASE_PLAN.map((p, i) => ({
        id: newRowId(),
        label: p.label,
        note: p.note,
        amount: parts[i],
        // Only the first is dated by default. The midpoint is a milestone, not a
        // calendar date, and inventing one would put a date in a signed contract
        // that nobody agreed to.
        dueDate: i === 0 ? (firstDue || null) : i === 2 ? (endDate || null) : null,
      }))
    }
    const n = Math.max(1, Math.min(MAX_INSTALMENTS, parseInt(termCount) || 1))
    return buildMonthlyInstalments(total, n, firstDue || null, 1, anchor)
  }, [payMode, total, firstDue, endDate, termCount, anchor])

  useEffect(() => {
    if (!autoBuilt) return
    setTerms(buildRows())
  }, [autoBuilt, buildRows])

  function recalculate() {
    setTerms(buildRows())
    setAutoBuilt(true)
  }

  function updateTerm(i: number, patch: Partial<ScheduleRow>) {
    setAutoBuilt(false)
    setTerms(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function removeTerm(i: number) {
    setAutoBuilt(false)
    setTerms(rs => rs.filter((_, idx) => idx !== i))
  }

  const amountValue = (key: string, amount: number) =>
    amountDraft?.key === key ? amountDraft.value : amount ? amount.toFixed(2) : ''

  const schedule: PaymentSchedule = useMemo(() => ({
    mode: payMode === 'phases' ? 'phases' : 'monthly',
    vatRate: parseFloat(vatRate) || 0,
    intervalMonths: 1,
    credits: [],
    instalments: terms,
  }), [payMode, vatRate, terms])

  const computed = useMemo(() => computeSchedule(schedule), [schedule])
  const scheduleBalanced = toCents(computed.scheduledNet) === toCents(total)
  const shortfall = fromCents(toCents(total) - toCents(computed.scheduledNet))

  /** One-line shape of each option at the current total, so the choice is informed. */
  const optionPreview = useMemo(() => {
    const vat = parseFloat(vatRate) || 0
    const gross = (net: number) => fromCents(toCents(net) + Math.round((toCents(net) * vat) / 100))
    const n = Math.max(1, Math.min(MAX_INSTALMENTS, parseInt(termCount) || 1))
    const per = allocateCents(toCents(total), n).map(fromCents)
    const phases = splitByPercent(total, PHASE_PLAN.map(p => p.pct))
    return {
      full: total > 0 ? `${fmtEuro(gross(total))} once` : 'One payment',
      terms: total > 0
        ? `${n} × ${fmtEuro(gross(per[0]))}${per.some(p => toCents(p) !== toCents(per[0])) ? ' approx.' : ''}`
        : 'Fixed monthly terms',
      phases: total > 0
        ? phases.map(p => fmtEuro(gross(p))).join(' · ')
        : '30 / 40 / 30',
    }
  }, [total, vatRate, termCount])

  /* ── The document ────────────────────────────────────────────────────── */

  const previewData: PreviewData = {
    contractId: contractCode || 'Not assigned yet',
    contractType: 'extension',
    plan: 'custom',
    phase: 'custom',
    phaseLabel: 'Scope extension',
    projectName: featureName.trim() || 'Scope extension',
    deliverables,
    exclusions,
    extendsCode: extendsCode || null,
    phaseStart: startDate,
    phaseEnd: endDate,
    client,
    pricing: { total, initFee: 0, p1: 0, p2: 0, p3: 0, tier2Rate: 0 },
    owner: ownerReg,
    // Section 6 defers to the parent agreement on an extension, so none of this is
    // printed. Kept structurally valid because the shared template still reads it.
    hosting: { mode: 'none', domainPrice: 0, hostingPrice: 0, clientHostingNote: '' },
    addons: {
      seo: { on: false, price: 0 },
      logo: { on: false, price: 0, note: '' },
      support: { on: false, price: 0, months: 0 },
      supabase: { on: false, price: 0 },
      vercel: { on: false, price: 0 },
    },
    schedule,
    carePlan: null,
  }

  async function generate(targetLang?: 'en' | 'nl') {
    await openContractPrintWindow(targetLang ?? previewLang, previewData)
  }

  async function save() {
    if (saving || !contractCode || !client.name) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractCode,
          contractType: 'extension',
          plan: 'custom',
          phase: 'custom',
          phaseLabel: 'Scope extension',
          language: previewLang,
          projectName: featureName.trim() || 'Scope extension',
          deliverables,
          phaseStart: startDate || null,
          phaseEnd: endDate || null,
          parentContractId: parentId,
          client,
          pricing: { total, initFee: 0, p1: 0, p2: 0, p3: 0, tier2Rate: 0 },
          data: previewData,
          schedule,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not save the scope extension.')
      router.push(`/contracts/${encodeURIComponent(contractCode)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the scope extension.')
      setSaving(false)
    }
  }

  const blocked =
    (step === 1 && !parent && !editing)
    || (step === 2 && (!deliverables.trim() || total <= 0))
    || (step === 3 && !scheduleBalanced)

  const blockedWhy =
    step === 2 && !deliverables.trim() ? 'Describe the work, this becomes section 3 of the extension'
      : step === 2 && total <= 0 ? 'Set what this extension is worth'
      : step === 3 && !scheduleBalanced ? 'The payment rows have to account for the full value of the extension'
      : undefined

  return (
    <div className="wizard-wrap">
      <aside className="wizard-steps">
        {STEPS.map((s, i) => {
          const state =
            step === s.num ? 'active'
              : step > s.num || (editing && s.num === 1) ? 'done'
              : 'default'
          return (
            <div key={s.num}>
              <div className={`wstep wstep-${state}`}>
                <div className="wstep-circle">{state === 'done' ? '✓' : s.num}</div>
                <div className="wstep-text">
                  <div className="wstep-label">{s.label}</div>
                  <div className="wstep-sub">{s.sub}</div>
                </div>
              </div>
              {i < STEPS.length - 1 && <div className="wstep-divider" />}
            </div>
          )
        })}
      </aside>

      <div className="wizard-form">
        {/* ───────────── Step 1: agreement + client ───────────── */}
        {step === 1 && (
          <div className="max-w-2xl">
            <h2 className="wstep-heading">Which agreement?</h2>
            <p className="wstep-tagline">
              Only signed agreements can be extended. Pick one and its client comes with it.
            </p>

            {signed.length > 3 && (
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by client, project or contract code"
                className="mb-5"
              />
            )}

            <p className="sr-only" role="status">
              {loading ? 'Loading agreements.' : `${signed.length} signed agreements available.`}
            </p>

            {loading && (
              <div className="flex flex-col gap-6" aria-hidden="true">
                {Array.from({ length: 2 }).map((_, g) => (
                  <div key={g}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="skeleton w-[38px] h-[38px] rounded-full" />
                      <div className="skeleton h-4 w-40 rounded" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="type-card">
                          <div className="skeleton h-3 w-24 rounded mb-2" />
                          <div className="skeleton h-4 w-40 rounded mb-3" />
                          <div className="skeleton h-5 w-24 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Two different situations, two different fixes. "No contracts at all" wants
                a new contract; "contracts exist, none signed" wants the signature chased.
                Collapsing them into one message sends the owner to the wrong place. */}
            {!loading && signed.length === 0 && rows.length === 0 && (
              <div className="panel p-8 text-center max-w-md mx-auto">
                <p className="font-heading font-bold text-brown-dark text-base mb-2">No signed agreements yet</p>
                <p className="text-sm text-brown-subtle leading-relaxed mb-5">
                  A scope extension attaches to a signed agreement, so there is nothing to
                  extend until one exists. Start a project contract, get it signed, then come
                  back here.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link href="/contracts/new/project" className="btn btn-primary btn-sm">New contract</Link>
                  <Link href="/contracts" className="btn btn-ghost btn-sm">View all contracts</Link>
                </div>
              </div>
            )}

            {!loading && signed.length === 0 && rows.length > 0 && (
              <div className="panel p-8 text-center max-w-md mx-auto">
                <p className="font-heading font-bold text-brown-dark text-base mb-2">Nothing signed yet</p>
                <p className="text-sm text-brown-subtle leading-relaxed mb-5">
                  {rows.length} contract{rows.length === 1 ? '' : 's'} on file, still waiting on a
                  signature. A scope extension needs a signed agreement to attach to.
                </p>
                <Link href="/contracts" className="btn btn-primary btn-sm">View all contracts</Link>
              </div>
            )}

            {!loading && signed.length > 0 && groups.length === 0 && (
              <p className="text-sm text-brown-subtle">No match. Try a different name, project or code.</p>
            )}

            <div className="flex flex-col gap-7">
              {groups.map(g => (
                <div key={g.name}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="client-avatar">{initials(g.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-bold text-brown-dark text-[15px] truncate">{g.name}</div>
                      {g.list[0]?.clientCompany && g.list[0].clientCompany !== g.name && (
                        <div className="text-xs text-brown-subtle truncate">{g.list[0].clientCompany}</div>
                      )}
                    </div>
                    <span className="badge badge-neutral shrink-0">
                      {g.list.length} signed agreement{g.list.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {g.list.map(r => {
                      const active = parent?.id === r.id
                      // Only extensions that still stand. A cancelled attempt should not
                      // make a project look more extended than it is.
                      const exts = (extensionsByParent.get(r.id) ?? [])
                        .filter(e => e.status === 'SIGNED' || e.status === 'PENDING')
                      return (
                        <div
                          key={r.id}
                          className={`type-card !cursor-default flex flex-col ${active ? 'type-card-active' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/contracts/${encodeURIComponent(r.contractCode)}`}
                              target="_blank"
                              className="font-mono text-[11px] text-brown-rust hover:underline"
                            >
                              {r.contractCode}
                            </Link>
                            <span className={`badge ${phaseBadge(r)} shrink-0`}>{shortPhase(r)}</span>
                          </div>

                          <div className="font-heading font-bold text-brown-dark text-[15px] leading-snug mt-1.5">
                            {r.projectName || r.phaseLabel}
                          </div>

                          <div className="flex items-baseline justify-between gap-2 mt-2">
                            <span className="font-heading text-lg font-black text-brown-dark tabular-nums">
                              {fmtEuro(r.totalValue)}
                              {r.contractType === 'care' && (
                                <span className="text-[11px] font-normal text-brown-subtle">/mo</span>
                              )}
                            </span>
                            <span className="text-[11px] text-brown-subtle">
                              Signed {r.signedAt ? fmtDueDate(r.signedAt.slice(0, 10)) : ''}
                            </span>
                          </div>

                          {exts.length > 0 && (
                            <div className="text-[11px] text-brown-subtle mt-2 pt-2 border-t border-brown-dark/10">
                              {exts.length === 1 ? 'Already extended once: ' : `Already extended ${exts.length} times: `}
                              {exts.map((e, i) => (
                                <span key={e.contractCode}>
                                  {i > 0 && ', '}
                                  <Link
                                    href={`/contracts/${encodeURIComponent(e.contractCode)}`}
                                    target="_blank"
                                    className="font-mono text-brown-rust hover:underline"
                                  >
                                    {extLabel(e.contractCode)}
                                  </Link>
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-brown-dark/10 flex flex-wrap items-center justify-between gap-2">
                            <Link
                              href={`/contracts/${encodeURIComponent(r.contractCode)}`}
                              target="_blank"
                              className="text-[11px] text-brown-subtle hover:text-brown-rust hover:underline"
                            >
                              View contract ↗
                            </Link>
                            <button
                              type="button"
                              onClick={() => choose(r)}
                              aria-pressed={active}
                              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
                            >
                              {active ? '✓ Selected' : 'Select this agreement'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {parent && (
              <div className="mt-7">
                <div className="form-field-label mb-1.5">Client on this agreement</div>
                <div className="client-match-card toast-enter">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="client-avatar">{initials(client.name)}</div>
                    <div className="min-w-0">
                      <div className="font-bold text-brown-dark text-sm truncate">{client.name}</div>
                      <div className="text-xs text-brown-subtle truncate">
                        {client.company ? `${client.company}, ` : ''}{client.email || 'no email on file'}
                      </div>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-3 border-t border-brown-dark/10 m-0">
                    {client.phone && (<><dt className="text-brown-subtle m-0">Phone</dt><dd className="m-0 text-brown-dark">{client.phone}</dd></>)}
                    {client.city && (<><dt className="text-brown-subtle m-0">City</dt><dd className="m-0 text-brown-dark">{client.city}</dd></>)}
                    {client.kvk && (<><dt className="text-brown-subtle m-0">KvK</dt><dd className="m-0 text-brown-dark">{client.kvk}</dd></>)}
                    {client.vat && (<><dt className="text-brown-subtle m-0">BTW</dt><dd className="m-0 text-brown-dark">{client.vat}</dd></>)}
                    <dt className="text-brown-subtle m-0">New number</dt>
                    <dd className="m-0 font-mono font-semibold text-brown-dark">{contractCode}</dd>
                  </dl>

                  <p className="text-xs text-brown-muted mt-3 mb-0">
                    This is the client stored on {parent.contractCode}. If something here is
                    wrong, fix it on the client record, not on this contract.
                  </p>
                  <Link href="/clients" className="link-action mt-2">Edit client record</Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ───────────── Step 2: the feature ───────────── */}
        {step === 2 && (
          <div>
            <h2 className="wstep-heading">What is being added?</h2>
            <p className="wstep-tagline">
              This becomes section 3 of the extension. Write the boundary as carefully as
              the work: an extension exists because a scope was read wider than it was written.
            </p>

            {extendsCode && (
              <div className="rounded-lg border border-brown-light bg-brown-pale/30 px-4 py-3 mb-5 text-[13px] text-brown-dark">
                Extending <span className="font-mono font-semibold">{extendsCode}</span> for{' '}
                <strong>{client.company || client.name}</strong>. That agreement stays in
                force unchanged, this one is priced and signed on its own.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div className="sm:col-span-3">
                <Field label="Feature or work being added">
                  <input
                    value={featureName}
                    onChange={e => setFeatureName(e.target.value)}
                    placeholder="Online booking system"
                  />
                </Field>
              </div>
              <Field label="Start date">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </Field>
              <Field label="Agreed completion">
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </Field>
              <Field label="Value of this extension (€, excl. VAT)">
                <input
                  type="number" step="0.01" min={0} value={totalVal}
                  onChange={e => setTotalVal(e.target.value)}
                  onWheel={e => (e.target as HTMLInputElement).blur()}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Field label="What this extension covers">
                  <textarea
                    rows={10}
                    value={deliverables}
                    onChange={e => setDeliverables(e.target.value)}
                    placeholder={'Booking system\n• Availability calendar synced to the existing admin\n- Blocks dates already booked\n• Client-facing booking form\n• Confirmation email on booking'}
                  />
                </Field>
                <p className="text-[11px] text-brown-subtle mt-1">
                  Start a line with • for a point and with - for a detail under it. A plain
                  line becomes a heading.
                </p>
              </div>

              <div>
                <Field label="Not included (the limitation)">
                  <textarea
                    rows={10}
                    value={exclusions}
                    onChange={e => setExclusions(e.target.value)}
                    placeholder={'• Payment handling or a payment provider\n• Changes to the existing gallery pages\n• Migration of past bookings\n• Native mobile apps'}
                  />
                </Field>
                <p className="text-[11px] text-brown-subtle mt-1">
                  Printed as its own block under the scope, so the boundary is stated rather
                  than implied. Leave it empty to omit it.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ───────────── Step 3: payment ───────────── */}
        {step === 3 && (
          <div>
            <h2 className="wstep-heading">How is this paid?</h2>
            <p className="wstep-tagline">
              Every option produces real rows with real dates, so each one can be invoiced
              on its own from the contract page later.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {([
                { key: 'full' as const, title: 'One payment', desc: 'Paid in full on signature', line: optionPreview.full },
                { key: 'terms' as const, title: 'Monthly terms', desc: 'Split across fixed instalments', line: optionPreview.terms },
                { key: 'phases' as const, title: 'By phase', desc: 'Start, midpoint, delivery', line: optionPreview.phases },
              ]).map(opt => {
                const on = payMode === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { setPayMode(opt.key); setAutoBuilt(true) }}
                    aria-pressed={on}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      on
                        ? 'border-brown-rust border-2 bg-brown-pale/40'
                        : 'border-brown-light bg-white hover:border-brown-rust/50 hover:bg-brown-pale/20'
                    }`}
                  >
                    <span className={`block font-heading font-bold ${on ? 'text-brown-rust' : 'text-brown-dark'}`}>
                      {opt.title}
                    </span>
                    <span className="block text-[11px] text-brown-subtle leading-snug mt-0.5">{opt.desc}</span>
                    <span className="block text-[12px] font-semibold text-brown-dark tabular-nums mt-2 pt-2 border-t border-brown-dark/10">
                      {opt.line}
                    </span>
                    <span className="block text-[10px] text-brown-subtle mt-0.5">incl. VAT</span>
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end mb-5">
              {payMode === 'terms' && (
                <Field label="Terms">
                  <input
                    type="number" min={1} max={MAX_INSTALMENTS} value={termCount}
                    onChange={e => { setTermCount(e.target.value); setAutoBuilt(true) }}
                    onWheel={e => (e.target as HTMLInputElement).blur()}
                  />
                </Field>
              )}
              <Field label={payMode === 'full' ? 'Due' : 'First due'}>
                <input
                  type="date" value={firstDue}
                  onChange={e => { setFirstDue(e.target.value); setAutoBuilt(true) }}
                />
              </Field>
              {payMode === 'terms' && (
                <Field label="Then">
                  <select value={anchor} onChange={e => { setAnchor(e.target.value as DateAnchor); setAutoBuilt(true) }}>
                    <option value="end-of-month">End of month</option>
                    <option value="same-day">Same day monthly</option>
                  </select>
                </Field>
              )}
              <Field label="VAT %">
                <input
                  type="number" step="0.1" min={0} value={vatRate}
                  onChange={e => setVatRate(e.target.value)}
                  onWheel={e => (e.target as HTMLInputElement).blur()}
                />
              </Field>
              <button
                type="button"
                onClick={recalculate}
                className="btn btn-ghost btn-sm h-[38px]"
                title="Rebuild the rows from the value of this extension"
              >
                Recalculate
              </button>
            </div>

            {/* Cards on a phone, table above it. A six-column editable table inside a
                horizontal scroller hides the amount you are editing behind the label. */}
            <div className="sm:hidden space-y-3">
              {terms.map((r, i) => {
                const c = computed.instalments[i]
                return (
                  <div key={r.id ?? i} className="rounded-xl border border-brown-light bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-brown-dark">{r.label}</span>
                      {terms.length > 1 && (
                        <button
                          type="button" onClick={() => removeTerm(i)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-brown-subtle hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label={`Remove ${r.label}`}
                        >✕</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-brown-muted mb-1">Due</span>
                        <input
                          type="date" className="!px-2 !py-1.5 text-sm"
                          value={r.dueDate ?? ''}
                          onChange={e => updateTerm(i, { dueDate: e.target.value || null })}
                          aria-label={`Due date for ${r.label}`}
                        />
                      </label>
                      <label className="block">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-brown-muted mb-1">Net (€)</span>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-brown-subtle">€</span>
                          <input
                            type="text" inputMode="decimal"
                            className="!pl-5 !pr-2 !py-1.5 text-right tabular-nums text-sm"
                            value={amountValue(`t-${i}`, r.amount)}
                            onFocus={() => setAmountDraft({ key: `t-${i}`, value: r.amount ? String(r.amount) : '' })}
                            onChange={e => {
                              setAmountDraft({ key: `t-${i}`, value: e.target.value })
                              updateTerm(i, { amount: parseFloat(e.target.value.replace(',', '.')) || 0 })
                            }}
                            onBlur={() => setAmountDraft(null)}
                            aria-label={`Net amount for ${r.label}`}
                          />
                        </div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-brown-light/60 text-xs tabular-nums">
                      <span className="text-brown-muted">VAT {fmtEuro(c?.vat ?? 0)}</span>
                      <span className="text-brown-dark font-semibold">Gross {fmtEuro(c?.gross ?? 0)}</span>
                    </div>
                    <input
                      className="term-condition-input !mt-2 !px-2 !py-1.5 text-sm"
                      placeholder="Condition"
                      value={r.note}
                      onChange={e => updateTerm(i, { note: e.target.value })}
                      aria-label={`Condition for ${r.label}`}
                    />
                  </div>
                )
              })}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full table-fixed text-sm min-w-[720px]">
                <colgroup>
                  <col className="w-36" />
                  <col />
                  <col className="w-40" />
                  <col className="w-28" />
                  <col className="w-20" />
                  <col className="w-24" />
                  <col className="w-10" />
                </colgroup>
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-brown-muted border-b border-brown-light">
                    <th className="text-left py-2 font-bold">Payment</th>
                    <th className="text-left py-2 font-bold">Condition</th>
                    <th className="text-left py-2 font-bold">Due</th>
                    <th className="text-right py-2 font-bold border-l border-brown-light pl-2">Net (€)</th>
                    <th className="text-right py-2 font-bold">VAT</th>
                    <th className="text-right py-2 font-bold">Gross</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {terms.map((r, i) => {
                    const c = computed.instalments[i]
                    return (
                      <tr key={r.id ?? i} className="border-b border-brown-light/60">
                        <td className="py-1.5 pr-2 text-brown-dark">{r.label}</td>
                        <td className="py-1.5 pr-2">
                          <input
                            className="term-condition-input !w-full !max-w-[280px]"
                            placeholder="Condition"
                            value={r.note}
                            onChange={e => updateTerm(i, { note: e.target.value })}
                            aria-label={`Condition for ${r.label}`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="date" className="!w-36 !px-2 !py-1.5 text-sm"
                            value={r.dueDate ?? ''}
                            onChange={e => updateTerm(i, { dueDate: e.target.value || null })}
                            aria-label={`Due date for ${r.label}`}
                          />
                        </td>
                        <td className="py-1.5 pr-2 border-l border-brown-light/60 pl-2">
                          <div className="relative">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-brown-subtle">€</span>
                            <input
                              type="text" inputMode="decimal"
                              className="!w-full !pl-5 !pr-2 !py-1.5 text-right tabular-nums text-sm"
                              value={amountValue(`t-${i}`, r.amount)}
                              onFocus={() => setAmountDraft({ key: `t-${i}`, value: r.amount ? String(r.amount) : '' })}
                              onChange={e => {
                                setAmountDraft({ key: `t-${i}`, value: e.target.value })
                                updateTerm(i, { amount: parseFloat(e.target.value.replace(',', '.')) || 0 })
                              }}
                              onBlur={() => setAmountDraft(null)}
                              aria-label={`Net amount for ${r.label}`}
                            />
                          </div>
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-brown-muted whitespace-nowrap">{fmtEuro(c?.vat ?? 0)}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-brown-dark font-semibold whitespace-nowrap">{fmtEuro(c?.gross ?? 0)}</td>
                        <td className="py-1.5 text-right">
                          {terms.length > 1 && (
                            <button
                              type="button" onClick={() => removeTerm(i)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-brown-subtle hover:text-red-600 hover:bg-red-50 transition-colors"
                              aria-label={`Remove ${r.label}`}
                            >✕</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* The summary for whichever option is selected. Gross is the number that
                actually leaves the client's account, so it is the one set in bold. */}
            <div className="panel p-4 mt-5">
              <div className="text-xs font-bold uppercase tracking-wider text-brown-subtle mb-3">
                Financial summary,{' '}
                {payMode === 'full' ? 'one payment' : payMode === 'terms' ? `${terms.length} monthly terms` : 'by phase'}
              </div>
              <dl className="text-sm flex flex-col gap-1.5 m-0">
                <SumRow label="Value of this extension (excl. VAT)" value={fmtEuro(computed.scheduledNet)} />
                <SumRow label={`VAT at ${computed.vatRate}%`} value={fmtEuro(computed.totalVat)} />
                <SumRow label="Total payable (incl. VAT)" value={fmtEuro(computed.totalGross)} strong />
                <SumRow
                  label="Payments"
                  value={`${terms.length} ${terms.length === 1 ? 'payment' : 'payments'}${
                    terms.length > 1 ? `, first ${fmtEuro(computed.instalments[0]?.gross ?? 0)}` : ''
                  }`}
                />
                {(() => {
                  const first = terms.find(t => t.dueDate)?.dueDate ?? null
                  const last = [...terms].reverse().find(t => t.dueDate)?.dueDate ?? null
                  if (!first) return null
                  // One payment, or several falling on one day, is a date rather than
                  // a range. "Runs 31 Oct to 31 Oct" reads like a bug.
                  return (
                    <SumRow
                      label={first === last ? 'Due' : 'Runs'}
                      value={first === last ? fmtDueDate(first) : `${fmtDueDate(first)} to ${fmtDueDate(last)}`}
                    />
                  )
                })()}
              </dl>
            </div>

            <div className={`mt-4 px-3 py-2 rounded-md text-sm border ${
              scheduleBalanced
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                : 'bg-red-500/10 border-red-500/30 text-red-700'
            }`}>
              {scheduleBalanced ? (
                <>The rows total {fmtEuro(total)}, matching the value of this extension.</>
              ) : (
                <>
                  The rows total {fmtEuro(computed.scheduledNet)} against a value of {fmtEuro(total)},{' '}
                  {shortfall > 0 ? `${fmtEuro(shortfall)} unaccounted for.` : `${fmtEuro(-shortfall)} over.`}
                  {' Press Recalculate or adjust a row.'}
                </>
              )}
            </div>
          </div>
        )}

        {/* ───────────── Step 4: generate ───────────── */}
        {step === 4 && (
          <div>
            <WizardHeaderActions
              lang={previewLang}
              onLang={setPreviewLang}
              onSave={save}
              onGenerate={() => generate()}
              saving={saving}
              saveLabel={editing ? 'Save & republish' : 'Save extension'}
            />

            <h2 className="wstep-heading">Generate extension</h2>
            <p className="wstep-tagline">
              Review the document, choose a language, then download or save and send for signature.
            </p>

            <div className="flex gap-1 mb-3">
              <button
                type="button"
                className={`lang-tab ${previewLang === 'en' ? 'lang-tab-active' : ''}`}
                onClick={() => setPreviewLang('en')}
              >English</button>
              <button
                type="button"
                className={`lang-tab ${previewLang === 'nl' ? 'lang-tab-active' : ''}`}
                onClick={() => setPreviewLang('nl')}
              >Nederlands</button>
            </div>

            <ContractDocPreview data={previewData} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <DeliveryCard icon="↓" label="Download EN" sub="PDF · English version" onClick={() => generate('en')} />
              <DeliveryCard icon="↓" label="Download NL" sub="PDF · Dutch version" onClick={() => generate('nl')} />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="wizard-footer">
          <button
            type="button" className="btn btn-ghost"
            onClick={() => setStep(s => Math.max(editing ? 2 : 1, s - 1))}
            disabled={step === (editing ? 2 : 1)}
          >← Back</button>

          {step < 4 ? (
            <button
              type="button" className="btn btn-primary"
              onClick={() => setStep(s => s + 1)}
              disabled={blocked}
              title={blockedWhy}
            >{step === 1 && parent ? 'Confirm and continue →' : 'Continue →'}</button>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save & republish' : 'Save extension'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => generate()}>
                Generate contract
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-brown-muted mb-1">{label}</span>
      {children}
    </label>
  )
}

function SumRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-brown-subtle m-0">{label}</dt>
      <dd className={`m-0 tabular-nums ${strong ? 'font-bold text-brown-dark' : 'text-brown-dark'}`}>{value}</dd>
    </div>
  )
}
