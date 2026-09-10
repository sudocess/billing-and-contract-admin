'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { fmtEuro, toCents, fromCents } from '@/lib/installments'
import type { PastInvoice } from '@/components/ContractWizard'

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
  { num: 3, label: 'Review', sub: 'Preview & save' },
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

  // The two numbers the owner actually decides.
  const [hours, setHours] = useState('4')
  const [rate, setRate] = useState('75')
  // Derived by default, overridable — a round number is easier to sell than 4 × 75.
  const [feeOverride, setFeeOverride] = useState('')

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

  const hoursNum = parseFloat(hours) || 0
  const rateNum = parseFloat(rate) || 0
  const derivedFee = fromCents(Math.round(toCents(hoursNum * rateNum)))
  const fee = feeOverride.trim() === '' ? derivedFee : (parseFloat(feeOverride) || 0)
  const effective = hoursNum > 0 ? fee / hoursNum : 0
  // Below this the plan is losing money once a realistic cost floor is applied.
  const FLOOR = 50
  const effectiveTone =
    hoursNum === 0 ? 'neutral' : effective >= rateNum ? 'good' : effective >= FLOOR ? 'warn' : 'bad'

  const financial = useMemo(() => {
    const live = invoices.filter(i => i.status !== 'CANCELLED')
    const billed = fromCents(live.reduce((a, i) => a + toCents(i.grandTotal), 0))
    const received = fromCents(
      live.filter(i => i.paidAmount != null).reduce((a, i) => a + toCents(i.paidAmount as number), 0),
    )
    const contracted = fromCents(contracts.reduce((a, c) => a + toCents(c.totalValue), 0))
    return { billed, received, outstanding: fromCents(toCents(billed) - toCents(received)), contracted }
  }, [invoices, contracts])

  const filtered = clients.filter(c => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return `${c.name} ${c.company ?? ''} ${c.email}`.toLowerCase().includes(q)
  })

  async function save() {
    if (!picked || saving) return
    setSaving(true); setError('')
    try {
      const code = `${new Date().getFullYear()}-${picked.clientCode}-CARE${String(Date.now()).slice(-4)}`
      const carePlan = {
        includedHours: hoursNum,
        hourlyRate: rateNum,
        monthlyFee: fee,
        effectiveRate: Math.round(effective * 100) / 100,
        startDate,
        noticeDays: parseInt(noticeDays) || 30,
        includesInfrastructure: includesInfra,
        notes: notes.trim(),
      }
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractCode: code,
          contractType: 'care',
          plan: 'custom',
          phase: 'custom',
          phaseLabel: 'Care plan — monthly support',
          language: 'en',
          projectName: 'Care plan',
          deliverables: notes.trim() || `Monthly support: ${hoursNum} hours included at €${rateNum}/hr.`,
          phaseStart: startDate,
          phaseEnd: null,
          client: {
            name: picked.name, company: picked.company ?? '', email: picked.email,
            phone: picked.phone ?? '', kvk: picked.kvk ?? '', vat: picked.vat ?? '',
            address: picked.address ?? '', postalCode: picked.postalCode ?? '',
            city: picked.city ?? '', country: picked.country ?? 'Netherlands',
            dedicatedEmail: picked.dedicatedEmail ?? '',
          },
          pricing: { total: fee, initFee: 0, p1: 0, p2: 0, p3: 0, tier2Rate: rateNum },
          data: { carePlan, kind: 'care_plan' },
          schedule: null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not save the care plan.')
      router.push(`/contracts/${encodeURIComponent(code)}`)
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
                    <SumRow label="Contracted to date" value={fmtEuro(financial.contracted)} />
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-brown-muted mb-1.5">
                  Included hours / month
                </span>
                <input type="number" step="0.5" min="0" value={hours} onChange={e => setHours(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-brown-muted mb-1.5">
                  Rate the plan is built on (€/hr)
                </span>
                <input type="number" step="1" min="0" value={rate} onChange={e => setRate(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-brown-muted mb-1.5">
                  Monthly fee (€)
                </span>
                <input
                  type="number" step="0.01" min="0"
                  value={feeOverride === '' ? derivedFee.toFixed(2) : feeOverride}
                  onChange={e => setFeeOverride(e.target.value)}
                />
                <span className="block text-[11px] text-brown-subtle mt-1">
                  {feeOverride.trim() === '' ? `${hoursNum} × €${rateNum} — edit to round it` : 'Overridden'}
                </span>
              </label>
            </div>

            {/* The number that matters, and the one nobody computes by hand. */}
            <div
              className={`rounded-lg border p-4 mb-5 ${
                effectiveTone === 'bad'
                  ? 'border-danger/40 bg-danger/5'
                  : effectiveTone === 'warn'
                    ? 'border-warning/40 bg-warning/5'
                    : 'border-success/40 bg-success/5'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-sm text-brown-dark">
                  If the client uses every included hour, you are working for
                </span>
                <span className="font-heading text-2xl font-black text-brown-dark tabular-nums">
                  {hoursNum > 0 ? `${fmtEuro(effective)}/hr` : '—'}
                </span>
              </div>
              {hoursNum > 0 && (
                <p className="text-[13px] text-brown-subtle mt-1.5 mb-0">
                  {effectiveTone === 'bad' && (
                    <>That is below a €{FLOOR}/hr floor. {hoursNum} hrs at €{rateNum} is {fmtEuro(hoursNum * rateNum)} of work for {fmtEuro(fee)}.</>
                  )}
                  {effectiveTone === 'warn' && (
                    <>Above the floor but below the €{rateNum} rate this plan is built on — a {Math.round((1 - effective / rateNum) * 100)}% discount.</>
                  )}
                  {effectiveTone === 'good' && (
                    <>At or above the €{rateNum} rate this plan is built on.</>
                  )}
                  {' '}That is {(hoursNum / 8).toFixed(1)} working days a month.
                </p>
              )}
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
          </div>
        )}

        {step === 3 && picked && (
          <div>
            <h2 className="wstep-heading">Review</h2>
            <p className="wstep-tagline">Check the figures before this becomes a contract.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <Stat label="Monthly fee" value={fmtEuro(fee)} />
              <Stat label="Included hours" value={`${hoursNum} / month`} />
              <Stat label="Effective rate" value={hoursNum > 0 ? `${fmtEuro(effective)}/hr` : '—'} />
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

        <div className="flex items-center justify-between mt-7 pt-5 border-t border-brown-light">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
            ← Back
          </button>
          {step < 3 ? (
            <button type="button" className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!picked}>
              Continue →
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !picked}>
              {saving ? 'Saving…' : 'Save care plan'}
            </button>
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
