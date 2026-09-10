'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { fmtEuro, toCents, fromCents } from '@/lib/installments'
import {
  ContractPreview, DeliveryCard, openContractPrintWindow,
  type PastInvoice, type PreviewData,
} from '@/components/ContractWizard'
import {
  DEFAULT_TIERS, DEFAULT_FEATURES, effectiveRate, rateVerdict, RATE_FLOOR, monthlyFee,
  type CareTier, type CareFeature,
} from '@/lib/carePlan'

/**
 * Care plan builder.
 *
 * A care plan is priced per client rather than from a fixed tier card: the owner sets
 * the included hours and the hourly rate the plan is built on, and the monthly fee
 * follows. The effective rate is shown at every keystroke, because the failure mode
 * this product has is not a typo — it is quietly agreeing to 30 hours a month for
 * €389, which is €12.97 an hour, and looks perfectly reasonable until it is divided.
 */

type Client = {
  id: string
  name: string
  company: string | null
  email: string
  clientCode: string
  type: string
  contracts: number
  invoices: number
  dedicatedEmail: string | null
  phone: string | null
  kvk: string | null
  vat: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
}

type ContractSummary = {
  contractCode: string
  projectName: string | null
  phaseLabel: string
  status: string
  totalValue: number
  signedAt: string | null
  deliverables: string | null
}

const STEPS = [
  { num: 1, label: 'Client', sub: 'Who is this for?' },
  { num: 2, label: 'Plan', sub: 'Hours & rate' },
  { num: 3, label: 'Review', sub: 'Plans & pricing' },
  { num: 4, label: 'Generate', sub: 'Preview & send' },
]

export default function CarePlanWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Client | null>(null)

  const [contracts, setContracts] = useState<ContractSummary[]>([])
  const [invoices, setInvoices] = useState<PastInvoice[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)

  // Three tiers quoted side by side, one marked as the recommendation.
  const [tiers, setTiers] = useState<CareTier[]>(() => DEFAULT_TIERS.map(t => ({ ...t })))
  const [recommended, setRecommended] = useState<CareTier['key']>('business')
  // Null while this is a proposal. Set once the client has picked, and then it is the
  // tier the contract binds — the document changes from offering three to stating one.
  const [selectedTier, setSelectedTier] = useState<CareTier['key'] | null>(null)
  const [features, setFeatures] = useState<CareFeature[]>(() =>
    DEFAULT_FEATURES.map(f => ({ ...f, values: [...f.values] as [string, string, string] })),
  )

  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1, 1)
    return d.toISOString().slice(0, 10)
  })
  const [noticeDays, setNoticeDays] = useState('30')
  const [includesInfra, setIncludesInfra] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ownerReg, setOwnerReg] = useState<{ kvk: string; vat: string }>({ kvk: '', vat: '' })
  const [previewLang, setPreviewLang] = useState<'en' | 'nl'>('en')
  // Fixed once, so the code shown in the preview is the code that gets saved.
  const [contractCode] = useState(
    () => `${new Date().getFullYear()}-CARE-${String(Date.now()).slice(-6)}`,
  )

  useEffect(() => {
    fetch('/api/settings/owner', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(o => { if (o) setOwnerReg({ kvk: o.ownKvk || '', vat: o.ownVat || '' }) })
      .catch(() => {/* prints no registration line, which is the correct default */})
  }, [])

  useEffect(() => {
    fetch('/api/clients', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Client[]) => setClients(rows))
      .catch(() => setClients([]))
  }, [])

  // Everything already true about this client, so the plan is priced against reality.
  useEffect(() => {
    if (!picked) return
    let cancelled = false
    setLoadingSummary(true)
    const qs = new URLSearchParams({ name: picked.name, email: picked.email || '' })
    Promise.all([
      fetch(`/api/invoices/for-client?${qs}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : { invoices: [] })).catch(() => ({ invoices: [] })),
      fetch('/api/contracts', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : { contracts: [] })).catch(() => ({ contracts: [] })),
    ]).then(([inv, con]) => {
      if (cancelled) return
      setInvoices(inv.invoices ?? [])
      const all: ContractSummary[] = (con.contracts ?? []).filter(
        (c: ContractSummary & { clientName?: string }) =>
          (c.clientName || '').toLowerCase() === picked.name.toLowerCase(),
      )
      setContracts(all)
    }).finally(() => { if (!cancelled) setLoadingSummary(false) })
    return () => { cancelled = true }
  }, [picked])

  const chosen = tiers.find(t => t.key === (selectedTier ?? recommended)) ?? tiers[1]
  const isProposal = selectedTier === null
  const hoursNum = chosen.includedHours
  const rateNum = chosen.overageRate
  const fee = monthlyFee(chosen)
  const effective = effectiveRate(chosen)

  function setTier(key: CareTier['key'], patch: Partial<CareTier>) {
    setTiers(ts => ts.map(t => (t.key === key ? { ...t, ...patch } : t)))
  }
  function setFeature(i: number, patch: Partial<CareFeature>) {
    setFeatures(fs => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }
  function setFeatureValue(i: number, col: number, value: string) {
    setFeatures(fs => fs.map((f, idx) => {
      if (idx !== i) return f
      const values = [...f.values] as [string, string, string]
      values[col] = value
      return { ...f, values }
    }))
  }
  /**
   * Turn the plan-covers text into comparison rows.
   *
   * Everything arrives ticked on all three plans, because that is the common case and
   * unticking is faster than ticking. Rows already present are left alone rather than
   * duplicated, so the button can be pressed twice without making a mess.
   */
  function generateTiersFromNotes() {
    const lines = notes
      .split(/\r?\n/)
      .map(l => l.replace(/^[•\-–*]\s*/, '').trim())
      .filter(Boolean)
    if (lines.length === 0) return
    setFeatures(fs => {
      const seen = new Set(fs.map(f => f.label.trim().toLowerCase()))
      const added = lines
        .filter(l => !seen.has(l.toLowerCase()))
        .map(label => ({
          label,
          included: [true, true, true] as [boolean, boolean, boolean],
          values: ['', '', ''] as [string, string, string],
        }))
      return [...fs, ...added]
    })
  }

  function toggleFeature(i: number, col: number) {
    setFeatures(fs => fs.map((f, idx) => {
      if (idx !== i) return f
      const included = [...f.included] as [boolean, boolean, boolean]
      included[col] = !included[col]
      return { ...f, included }
    }))
  }

  const financial = useMemo(() => {
    const live = invoices.filter(i => i.status !== 'CANCELLED')
    const billed = fromCents(live.reduce((a, i) => a + toCents(i.grandTotal), 0))
    const received = fromCents(
      live.filter(i => i.paidAmount != null).reduce((a, i) => a + toCents(i.paidAmount as number), 0),
    )
    // Only agreements that actually stand. Summing every row counted the two
    // cancelled LHR contracts and reported €4,998 of commitment that does not exist.
    const standing = contracts.filter(c => c.status === 'PENDING' || c.status === 'SIGNED')
    const contracted = fromCents(standing.reduce((a, c) => a + toCents(c.totalValue), 0))
    return { billed, received, outstanding: fromCents(toCents(billed) - toCents(received)), contracted }
  }, [invoices, contracts])

  /**
   * The contract snapshot. Built once and used by the preview, the print window and
   * the save, so what is reviewed on screen is exactly what is stored and sent.
   * Building it separately in each place is how this app previously ended up stating
   * three different cancellation terms.
   */
  const carePlanSpec = {
    tiers,
    recommended,
    selectedTier,
    features: features.filter(f => f.label.trim()),
    startDate,
    noticeDays: parseInt(noticeDays) || 30,
    includesInfrastructure: includesInfra,
    notes: notes.trim(),
    // The agreements this plan sits alongside. Printed so the document says plainly
    // that it complements them rather than leaving the client to wonder whether a
    // second contract has replaced the first.
    complements: contracts
      .filter(c => c.status === 'PENDING' || c.status === 'SIGNED')
      .map(c => c.contractCode),
    includedHours: hoursNum,
    hourlyRate: rateNum,
    monthlyFee: fee,
    effectiveRate: Math.round(effective * 100) / 100,
  }

  const previewData: PreviewData = {
    contractId: contractCode,
    contractType: 'care',
    plan: 'custom',
    phase: 'custom',
    phaseLabel: 'Care plan — monthly support',
    projectName: 'Care plan',
    deliverables: notes.trim() || `Monthly support: ${hoursNum} hours included at €${rateNum}/hr.`,
    phaseStart: startDate,
    phaseEnd: '',
    client: {
      name: picked?.name ?? '', company: picked?.company ?? '', email: picked?.email ?? '',
      phone: picked?.phone ?? '', kvk: picked?.kvk ?? '', vat: picked?.vat ?? '',
      address: picked?.address ?? '', postalCode: picked?.postalCode ?? '',
      city: picked?.city ?? '', country: picked?.country ?? 'Netherlands',
      dedicatedEmail: picked?.dedicatedEmail ?? '',
    },
    pricing: { total: fee, initFee: 0, p1: 0, p2: 0, p3: 0, tier2Rate: rateNum },
    owner: ownerReg,
    hosting: {
      mode: includesInfra ? 'hosting' : 'none',
      domainPrice: 0, hostingPrice: 0, clientHostingNote: '',
    },
    addons: {
      seo: { on: false, price: 0 },
      logo: { on: false, price: 0, note: '' },
      support: { on: false, price: 0, months: 0 },
      supabase: { on: false, price: 0 },
      vercel: { on: false, price: 0 },
    },
    schedule: null,
    carePlan: carePlanSpec,
  }

  async function generate(targetLang?: 'en' | 'nl') {
    await openContractPrintWindow(targetLang ?? previewLang, previewData)
  }

  const filtered = clients.filter(c => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return `${c.name} ${c.company ?? ''} ${c.email}`.toLowerCase().includes(q)
  })

  async function save() {
    if (!picked || saving) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractCode,
          contractType: 'care',
          plan: 'custom',
          phase: 'custom',
          phaseLabel: 'Care plan — monthly support',
          language: previewLang,
          projectName: 'Care plan',
          deliverables: previewData.deliverables,
          phaseStart: startDate,
          phaseEnd: null,
          client: previewData.client,
          pricing: previewData.pricing,
          data: previewData,
          schedule: null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not save the care plan.')
      router.push(`/contracts/${encodeURIComponent(contractCode)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the care plan.')
      setSaving(false)
    }
  }

  return (
    <div className="wizard-wrap">
      <aside className="wizard-steps">
        {STEPS.map((s, i) => {
          const state = step === s.num ? 'active' : step > s.num ? 'done' : 'default'
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

      <div className="wizard-panel">
        {step === 1 && (
          <div>
            <h2 className="wstep-heading">Which client?</h2>
            <p className="wstep-tagline">
              Pick from clients already on file. Care plans are for work you already do.
            </p>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, company or email…"
              className="mb-4"
            />
            <div className="flex flex-col gap-2">
              {filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setPicked(c); setStep(2) }}
                  className={`text-left rounded-lg border px-4 py-3 transition-colors ${
                    picked?.id === c.id
                      ? 'border-brown-rust bg-brown-pale/40'
                      : 'border-brown-light hover:bg-brown-pale/25'
                  }`}
                >
                  <div className="font-heading font-bold text-brown-dark">{c.name}</div>
                  <div className="text-[12px] text-brown-subtle">
                    {c.company ? `${c.company} · ` : ''}{c.email || 'no email'} · {c.contracts} contract
                    {c.contracts === 1 ? '' : 's'} · {c.invoices} invoice{c.invoices === 1 ? '' : 's'}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-brown-subtle">
                  No match. <Link href="/clients" className="text-brown-rust underline">Add the client first</Link>.
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && picked && (
          <div>
            <h2 className="wstep-heading">Plan for {picked.company || picked.name}</h2>
            <p className="wstep-tagline">
              Set the hours you are committing and the rate the plan is built on.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              <div className="panel p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-brown-subtle mb-3">
                  Financial summary
                </div>
                {loadingSummary ? (
                  <p className="text-sm text-brown-subtle m-0">Loading…</p>
                ) : (
                  <dl className="text-sm flex flex-col gap-1.5 m-0">
                    <SumRow label="Contracted (signed or awaiting)" value={fmtEuro(financial.contracted)} />
                    <SumRow label="Invoiced (incl. VAT)" value={fmtEuro(financial.billed)} />
                    <SumRow label="Received" value={fmtEuro(financial.received)} />
                    <SumRow label="Outstanding" value={fmtEuro(financial.outstanding)} strong />
                  </dl>
                )}
              </div>

              <div className="panel p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-brown-subtle mb-3">
                  Project summary
                </div>
                {loadingSummary ? (
                  <p className="text-sm text-brown-subtle m-0">Loading…</p>
                ) : contracts.length === 0 ? (
                  <p className="text-sm text-brown-subtle m-0">No contracts on file for this client.</p>
                ) : (
                  <ul className="text-sm flex flex-col gap-2 m-0 p-0 list-none">
                    {contracts.slice(0, 4).map(c => (
                      <li key={c.contractCode}>
                        <Link
                          href={`/contracts/${encodeURIComponent(c.contractCode)}`}
                          target="_blank"
                          className="font-mono text-[12px] text-brown-rust hover:underline"
                        >
                          {c.contractCode}
                        </Link>
                        <span className="block text-[12px] text-brown-subtle">
                          {c.projectName || c.phaseLabel} · {c.status} · {fmtEuro(c.totalValue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Three tiers, quoted side by side. The effective rate under each is the
                number that decides whether the plan is worth running, and it is the one
                nobody computes by hand. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {tiers.map((t, col) => {
                const verdict = rateVerdict(t)
                const isRec = recommended === t.key
                return (
                  <div
                    key={t.key}
                    className={`rounded-lg border p-3 ${
                      isRec ? 'border-brown-rust bg-brown-pale/40' : 'border-brown-light bg-white'
                    }`}
                  >
                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recommended"
                        checked={isRec}
                        onChange={() => setRecommended(t.key)}
                        className="!w-4 !h-4"
                      />
                      <input
                        type="text"
                        value={t.name}
                        onChange={e => setTier(t.key, { name: e.target.value })}
                        className="!py-1 !text-[13px] !font-semibold"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-brown-subtle mb-1">Rate € / hr</span>
                        <input type="number" step="0.01" min="0" value={t.hourlyRate}
                          onChange={e => setTier(t.key, { hourlyRate: parseFloat(e.target.value) || 0 })}
                          className="!py-1.5 !text-[13px]" />
                      </label>
                      <label className="block">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-brown-subtle mb-1">Hours / month</span>
                        <input type="number" step="0.5" min="0" value={t.includedHours}
                          onChange={e => setTier(t.key, { includedHours: parseFloat(e.target.value) || 0 })}
                          className="!py-1.5 !text-[13px]" />
                      </label>
                    </div>

                    {/* Derived, never typed — the rate is the decision, the fee follows. */}
                    <div className="mt-2 rounded border border-brown-light bg-white px-2 py-1.5">
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-brown-subtle">Monthly fee</span>
                      <span className="font-heading text-lg font-black text-brown-dark tabular-nums">
                        {fmtEuro(monthlyFee(t))}
                      </span>
                      <span className="text-[11px] text-brown-subtle"> = {t.includedHours} × {fmtEuro(t.hourlyRate)}</span>
                    </div>

                    <label className="block mt-2">
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-brown-subtle mb-1">Extra hours € / hr</span>
                      <input type="number" step="1" min="0" value={t.overageRate}
                        onChange={e => setTier(t.key, { overageRate: parseFloat(e.target.value) || 0 })}
                        className="!py-1.5 !text-[13px]" />
                      <span className="block text-[10px] text-brown-subtle mt-0.5">
                        Billed beyond the included hours. Invoices read this off the contract.
                      </span>
                    </label>

                    <div
                      className={`mt-2 rounded px-2 py-1.5 text-[11px] font-semibold ${
                        verdict === 'loss' ? 'bg-danger/10 text-danger'
                          : verdict === 'thin' ? 'bg-warning/10 text-warning'
                          : 'bg-success/10 text-success'
                      }`}
                    >
                      {t.includedHours > 0
                        ? `${(t.includedHours / 8).toFixed(1)} working days/mo`
                        : 'No hours included'}
                      {verdict === 'loss' && (
                        <span className="block font-normal opacity-80">
                          €{t.hourlyRate} is under the €{RATE_FLOOR} floor
                        </span>
                      )}
                    </div>

                    <input
                      type="text"
                      value={t.blurb}
                      onChange={e => setTier(t.key, { blurb: e.target.value })}
                      placeholder="One line for the client"
                      className="!py-1 !text-[11px] mt-2"
                    />
                  </div>
                )
              })}
            </div>

            {/* The comparison the client actually reads. Included hours and the extra-hour
                rate are not rows here — they are printed from the tier figures above, so
                the table can never contradict the prices. */}
            <div className="mb-5">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brown-muted">
                  What each plan includes
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm !py-1 !text-[11px]"
                  onClick={() => setFeatures(fs => [...fs, { label: '', included: [true, true, true], values: ['', '', ''] }])}
                >
                  Add row
                </button>
              </div>

              <div className="overflow-x-auto border border-brown-light rounded-lg">
                <table className="w-full text-[12px] border-collapse min-w-[560px]">
                  <thead>
                    <tr>
                      <th className="text-left font-bold p-2 text-brown-subtle">Feature</th>
                      {tiers.map(t => (
                        <th key={t.key} className={`text-left font-bold p-2 ${recommended === t.key ? 'text-brown-rust' : 'text-brown-subtle'}`}>
                          {t.name || '—'}
                        </th>
                      ))}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((f, i) => (
                      <tr key={i} className="border-t border-brown-light/60">
                        <td className="p-1.5">
                          <input type="text" value={f.label}
                            onChange={e => setFeature(i, { label: e.target.value })}
                            className="!py-1 !text-[12px]" placeholder="Feature" />
                        </td>
                        {[0, 1, 2].map(col => (
                          <td key={col} className={`p-1.5 ${recommended === tiers[col].key ? 'bg-brown-pale/30' : ''}`}>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={f.included[col]}
                                onChange={() => toggleFeature(i, col)}
                                title={f.included[col] ? 'Included in this plan' : 'Not included'}
                                className="!w-3.5 !h-3.5 shrink-0"
                              />
                              <input
                                type="text"
                                value={f.values[col]}
                                onChange={e => setFeatureValue(i, col, e.target.value)}
                                disabled={!f.included[col]}
                                className="!py-1 !text-[12px] disabled:opacity-40"
                                placeholder={f.included[col] ? '✓' : '—'}
                              />
                            </div>
                          </td>
                        ))}
                        <td className="p-1.5 text-center">
                          <button type="button" title="Remove row"
                            onClick={() => setFeatures(fs => fs.filter((_, idx) => idx !== i))}
                            className="text-brown-subtle hover:text-danger text-sm leading-none">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-brown-subtle mt-2 mb-0">
                Included hours and the extra-hour rate are printed automatically from the tier
                figures above, so they cannot drift out of step with the prices.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-brown-muted mb-1.5">Starts</span>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-brown-muted mb-1.5">
                  Notice period (days)
                </span>
                <input type="number" min="0" value={noticeDays} onChange={e => setNoticeDays(e.target.value)} />
              </label>
            </div>

            <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
              <input type="checkbox" checked={includesInfra} onChange={e => setIncludesInfra(e.target.checked)} className="!w-4 !h-4" />
              <span className="text-sm text-brown-dark">
                Hosting, domain, database and business email are included in the fee
              </span>
            </label>

            <label className="block mb-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-brown-muted mb-1.5">
                What the plan covers
              </span>
              <textarea
                rows={6}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={'• Hosting, database and deployment\n• Backups and security patches\n• Uptime monitoring\n• Bug fixes on delivered features\n- Content and gallery updates'}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3 mb-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={generateTiersFromNotes}
                disabled={!notes.trim()}
                title="Turn each line above into a row of the comparison table"
              >
                Generate tiers from this
              </button>
              <span className="text-[11px] text-brown-subtle">
                Adds a comparison row per line, included on every plan. Untick what a plan does not cover.
              </span>
            </div>
          </div>
        )}

        {step === 3 && picked && (
          <div>
            <h2 className="wstep-heading">Plans &amp; pricing</h2>
            <p className="wstep-tagline">Pick the agreed plan, or leave it as a proposal showing all three.</p>

            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brown-muted">
                {isProposal ? 'No plan agreed yet — this sends as a proposal' : 'Agreed plan'}
              </span>
              {!isProposal && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm !py-1 !text-[11px]"
                  onClick={() => setSelectedTier(null)}
                >
                  Clear — send as a proposal
                </button>
              )}
            </div>
            <p className="text-[12px] text-brown-subtle mt-0 mb-3">
              {isProposal
                ? `Pick the plan the client agreed to and the contract will bind it. Left as a proposal, the document shows all three with ${tiers.find(t => t.key === recommended)?.name} recommended and states no fee.`
                : 'The contract binds this plan. Click it again to go back to a proposal.'}
            </p>

            {/* One table: the plan cards are its header row, so a card sits exactly
                over the column it describes. Two separate grids drifted apart by their
                own gaps, which is what the misalignment was. */}
            <div className="w-fit max-w-full overflow-x-auto border border-brown-light rounded-lg mb-5">
              {/* Fixed pixel columns, and the table is not stretched to the page.
                  Filling 1850px gave each plan a ~400px column holding one word,
                  which is what put a void between a row and its values. */}
              <table className="compare-table table-fixed border-collapse text-[12px]">
                <colgroup>
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '190px' }} />
                  <col style={{ width: '190px' }} />
                  <col style={{ width: '190px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="p-2.5 align-bottom text-left">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-brown-subtle/70 leading-snug">
                        ✓ included · — not included
                      </span>
                    </th>
                    {tiers.map(t => {
                      const agreed = selectedTier === t.key
                      const marked = (selectedTier ?? recommended) === t.key
                      return (
                        <th key={t.key} className="p-1.5 align-bottom">
                          <button
                            type="button"
                            // Clicking the agreed plan again returns the document to a
                            // proposal, so the decision is reversible from the control
                            // that made it.
                            onClick={() => setSelectedTier(agreed ? null : t.key)}
                            aria-pressed={agreed}
                            title={agreed ? 'Agreed — click again to go back to a proposal' : `Mark ${t.name} as the agreed plan`}
                            className={`w-full rounded-lg border p-2.5 text-center transition-colors cursor-pointer ${
                              agreed
                                ? 'border-brown-rust border-2 bg-brown-pale/50'
                                : marked
                                  ? 'border-brown-rust bg-brown-pale/30 hover:bg-brown-pale/50'
                                  : 'border-brown-light bg-white hover:border-brown-rust/50 hover:bg-brown-pale/20'
                            }`}
                          >
                            <span className={`block text-[10px] font-bold uppercase tracking-widest ${marked ? 'text-brown-rust' : 'text-brown-subtle'}`}>
                              {t.name}
                            </span>
                            <span className="block font-heading text-xl font-black text-brown-dark tabular-nums mt-0.5">
                              {fmtEuro(monthlyFee(t))}
                              <span className="text-[12px] font-normal text-brown-subtle">/mo</span>
                            </span>
                            <span className="block text-[11px] text-brown-rust">
                              {t.includedHours} {t.includedHours === 1 ? 'hr' : 'hrs'} · {fmtEuro(t.hourlyRate)}/hr
                            </span>
                            <span className="block text-[10px] text-brown-subtle mt-1.5 pt-1.5 border-t border-brown-dark/10 font-normal normal-case tracking-normal">
                              {t.blurb || '—'}
                            </span>
                            <span className="block text-[10px] font-bold uppercase tracking-widest mt-1.5">
                              {agreed
                                ? <span className="text-brown-rust">✓ Agreed</span>
                                : marked
                                  ? <span className="text-brown-rust">Recommended</span>
                                  : <span className="text-brown-subtle/60">Choose this plan</span>}
                            </span>
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="py-1.5 px-2.5 text-left font-normal leading-snug text-brown-dark align-middle">Included hours per month</th>
                    {tiers.map(t => (
                      <td key={t.key} className={`py-1.5 px-2.5 text-center align-middle tabular-nums ${(selectedTier ?? recommended) === t.key ? 'bg-brown-pale/30 border-x border-brown-rust/25 font-semibold' : ''}`}>
                        {t.includedHours} {t.includedHours === 1 ? 'hr' : 'hrs'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="py-1.5 px-2.5 text-left font-normal leading-snug text-brown-dark align-middle">Hours beyond the included total</th>
                    {tiers.map(t => (
                      <td key={t.key} className={`py-1.5 px-2.5 text-center align-middle tabular-nums ${(selectedTier ?? recommended) === t.key ? 'bg-brown-pale/30 border-x border-brown-rust/25 font-semibold' : ''}`}>
                        {fmtEuro(t.overageRate)}/hr
                      </td>
                    ))}
                  </tr>
                  {features.filter(f => f.label.trim()).map((f, i) => (
                    <tr key={i}>
                      <th scope="row" className="py-1.5 px-2.5 text-left font-normal leading-snug text-brown-dark align-middle">
                        {f.label}
                      </th>
                      {[0, 1, 2].map(col => {
                        const isSel = (selectedTier ?? recommended) === tiers[col].key
                        const val = f.values[col].trim()
                        return (
                          <td
                            key={col}
                            className={`py-1.5 px-2.5 text-center align-middle ${
                              isSel ? 'bg-brown-pale/30 border-x border-brown-rust/25' : ''
                            }`}
                          >
                            {f.included[col] ? (
                              val ? (
                                // Plain text, not rust: rust means selection here, and
                                // spending it on ordinary values dilutes that.
                                <span className="text-brown-dark">{val}</span>
                              ) : (
                                <>
                                  <span className="sr-only">Included</span>
                                  <span aria-hidden="true" className="text-[15px] font-bold text-success leading-none">✓</span>
                                </>
                              )
                            ) : (
                              <>
                                <span className="sr-only">Not included</span>
                                <span aria-hidden="true" className="text-[13px] text-brown-subtle/35">—</span>
                              </>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel p-4 text-sm text-brown-dark">
              <p className="m-0 mb-2"><strong>{picked.company || picked.name}</strong></p>
              <p className="m-0 text-brown-subtle">
                Starts {startDate}. {noticeDays} days&rsquo; notice either side.
                Hours beyond the included allowance are agreed in advance and billed at €{rateNum}/hr.
                {includesInfra ? ' Hosting, domain, database and business email are included.' : ''}
              </p>
              {notes.trim() && (
                <p className="mt-3 mb-0 whitespace-pre-line text-brown-dark">{notes}</p>
              )}
            </div>
            {error && (
              <div className="mt-4 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {step === 4 && picked && (
          <div>
            <h2 className="wstep-heading">Generate {isProposal ? 'proposal' : 'agreement'}</h2>
            <p className="wstep-tagline">
              Review the document, choose a language, then download or send for signature.
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

            <div className="contract-preview">
              <ContractPreview lang={previewLang} data={previewData} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <DeliveryCard icon="↓" label="Download EN" sub="PDF · English version" onClick={() => generate('en')} />
              <DeliveryCard icon="↓" label="Download NL" sub="PDF · Dutch version" onClick={() => generate('nl')} />
              <DeliveryCard icon="✍" label="Send for signature" sub="Save first, then send from the contract page" onClick={save} />
            </div>

            {error && (
              <div className="mt-4 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-7 pt-5 border-t border-brown-light">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
            ← Back
          </button>
          {step < 4 ? (
            <button type="button" className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!picked}>
              Continue →
            </button>
          ) : (
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={save} disabled={saving || !picked}>
                {saving ? 'Saving…' : isProposal ? 'Save proposal' : 'Save agreement'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => generate()}>
                Generate {isProposal ? 'proposal' : 'contract'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brown-dark/10 bg-brown-pale/30 p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle">{label}</div>
      <div className="font-heading text-lg font-black text-brown-dark tabular-nums mt-0.5">{value}</div>
    </div>
  )
}
