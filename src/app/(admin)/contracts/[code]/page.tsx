'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { openContractPrintWindow, type PreviewData } from '@/components/ContractWizard'
import ContractDetailActions from './ContractDetailActions'

type ContractRow = {
  id: string
  contractCode: string
  contractType: string
  plan: string | null
  phase: string
  phaseLabel: string
  language: string
  projectName: string | null
  deliverables: string | null
  phaseStart: string | null
  phaseEnd: string | null
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
  totalValue: number
  initFee: number
  p1: number
  p2: number
  p3: number
  tier2Rate: number
  status: 'DRAFT' | 'PENDING' | 'SIGNED' | 'CANCELLED'
  createdAt: string
  updatedAt: string
  signedAt: string | null
  sentAt: string | null
  data: PreviewData | null
}

const fmtEur = (n: number) => '€' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const typeLabel = (t: string) => {
  switch (t) {
    case 'custom': return 'Custom Agreement'
    case 'standard': return 'Standard Agreement'
    case 'phase': return 'Phase Agreement'
    default: return t.charAt(0).toUpperCase() + t.slice(1)
  }
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: 'Draft',             cls: 'bg-brown-pale text-brown-dark' },
  PENDING:   { label: 'Awaiting signature', cls: 'bg-warning/15 text-warning' },
  SIGNED:    { label: 'Signed',            cls: 'bg-success/15 text-success' },
  CANCELLED: { label: 'Cancelled',         cls: 'bg-brown-dark/10 text-brown-subtle' },
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ViewContractPage() {
  const router = useRouter()
  const params = useParams<{ code: string }>()
  const code = params?.code
  const [contract, setContract] = useState<ContractRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/contracts/${encodeURIComponent(code)}`, { cache: 'no-store' })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || `Failed to load (${res.status})`)
        }
        const { contract } = await res.json()
        if (!cancelled) setContract(contract)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load contract')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [code])

  const addressLines = useMemo(() => {
    if (!contract) return [] as string[]
    const out: string[] = []
    if (contract.clientAddress) out.push(contract.clientAddress)
    const cityLine = [contract.clientPostalCode, contract.clientCity].filter(Boolean).join(' ')
    if (cityLine) out.push(cityLine)
    if (contract.clientCountry) out.push(contract.clientCountry)
    return out
  }, [contract])

  function handleOpenPdf() {
    if (!contract?.data) {
      alert('This contract has no preview snapshot saved.')
      return
    }
    openContractPrintWindow((contract.language as 'en' | 'nl') || 'en', contract.data)
  }

  async function copyId() {
    if (!contract) return
    try {
      await navigator.clipboard.writeText(contract.contractCode)
    } catch {/* noop */}
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-brown-subtle">Loading contract…</div>
    )
  }

  if (error || !contract) {
    return (
      <div className="p-8">
        <div className="panel p-6 max-w-xl">
          <h2 className="font-heading text-base font-extrabold text-brown-dark mb-2">Could not open contract</h2>
          <p className="text-sm text-brown-subtle mb-4">{error || 'Unknown error'}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.replace('/contracts')}>
            Back to history
          </button>
        </div>
      </div>
    )
  }

  const status = STATUS_BADGE[contract.status] || STATUS_BADGE.DRAFT
  const addons = contract.data?.addons
  const hosting = contract.data?.hosting

  return (
    <>
      {/* Top bar */}
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/contracts" className="btn btn-ghost btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span>Back</span>
          </Link>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle">Contract</div>
            <h1 className="font-heading text-lg font-extrabold text-brown-dark truncate">
              {contract.projectName || typeLabel(contract.contractType)}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyId} title="Copy contract ID">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span className="font-mono text-xs">{contract.contractCode}</span>
          </button>
          <ContractDetailActions contractCode={contract.contractCode} status={contract.status} />
          <button type="button" className="btn btn-primary" onClick={handleOpenPdf} disabled={!contract.data}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>Open PDF preview</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-7 flex-1 space-y-5">
        {/* Hero */}
        <div className="panel p-6 bg-gradient-to-br from-white to-brown-pale/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`badge ${status.cls}`}>{status.label}</span>
                <span className="badge badge-info">{contract.phaseLabel}</span>
                <span className="badge bg-brown-dark/5 text-brown-dark">{typeLabel(contract.contractType)}</span>
                {contract.plan && (
                  <span className="badge bg-brown-pale text-brown-dark capitalize">Plan: {contract.plan}</span>
                )}
              </div>
              <div className="font-heading text-2xl font-black text-brown-dark mb-1">
                {contract.clientCompany || contract.clientName}
              </div>
              <div className="text-sm text-brown-subtle">
                {contract.clientCompany ? `Signed to ${contract.clientName}` : 'Individual client'}
                {contract.clientEmail && <> · <a href={`mailto:${contract.clientEmail}`} className="text-brown-rust hover:underline">{contract.clientEmail}</a></>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle">Total value</div>
              <div className="font-heading text-3xl font-black text-brown-dark tabular-nums">{fmtEur(contract.totalValue)}</div>
              {contract.initFee > 0 && (
                <div className="text-xs text-brown-subtle mt-0.5">Initial fee {fmtEur(contract.initFee)}</div>
              )}
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Project details */}
            <div className="panel p-5">
              <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-4">Project</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Field label="Project name" value={contract.projectName || '—'} />
                <Field label="Phase" value={contract.phaseLabel} />
                <Field label="Phase start" value={fmtDate(contract.phaseStart)} />
                <Field label="Phase end" value={fmtDate(contract.phaseEnd)} />
              </div>
              {contract.deliverables && (
                <div className="mt-5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle mb-1.5">Deliverables</div>
                  <p className="text-sm text-brown-dark whitespace-pre-wrap leading-relaxed">{contract.deliverables}</p>
                </div>
              )}
            </div>

            {/* Payment schedule */}
            <div className="panel p-5">
              <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-4">Payment schedule</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <PayCard label="Payment 1" sub="Before work begins" amount={contract.p1} />
                <PayCard label="Payment 2" sub="At agreed midpoint" amount={contract.p2} />
                <PayCard label="Payment 3" sub="On final delivery" amount={contract.p3} />
              </div>
              {contract.tier2Rate > 0 && (
                <div className="mt-4 text-xs text-brown-subtle">
                  Tier-2 hourly rate: <span className="text-brown-dark font-semibold">{fmtEur(contract.tier2Rate)}/hr</span>
                </div>
              )}
            </div>

            {/* Add-ons & hosting (only if present in data snapshot) */}
            {(addons || hosting) && (
              <div className="panel p-5">
                <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-4">Add-ons & hosting</div>
                <div className="space-y-2 text-sm">
                  {hosting && (
                    <Row label={`Hosting — ${hosting.mode}`} amount={hosting.hostingPrice + hosting.domainPrice} note={hosting.domainPrice ? `incl. domain ${fmtEur(hosting.domainPrice)}` : undefined} />
                  )}
                  {addons?.seo?.on && <Row label="SEO setup" amount={addons.seo.price} />}
                  {addons?.logo?.on && <Row label="Logo design" amount={addons.logo.price} note={addons.logo.note} />}
                  {addons?.support?.on && <Row label={`Ongoing support (${addons.support.months} months)`} amount={addons.support.price} />}
                  {addons?.supabase?.on && <Row label="Supabase (pass-through)" amount={addons.supabase.price} muted />}
                  {addons?.vercel?.on && <Row label="Vercel (pass-through)" amount={addons.vercel.price} muted />}
                  {!hosting && !addons?.seo?.on && !addons?.logo?.on && !addons?.support?.on && !addons?.supabase?.on && !addons?.vercel?.on && (
                    <div className="text-sm text-brown-subtle italic">No add-ons selected.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Client */}
            <div className="panel p-5">
              <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-4">Client</div>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-heading font-bold text-brown-dark">{contract.clientName}</div>
                  {contract.clientCompany && <div className="text-brown-subtle text-xs">{contract.clientCompany}</div>}
                </div>
                {contract.clientEmail && (
                  <ContactLine icon="mail" href={`mailto:${contract.clientEmail}`}>{contract.clientEmail}</ContactLine>
                )}
                {contract.dedicatedEmail && contract.dedicatedEmail !== contract.clientEmail && (
                  <ContactLine icon="mail" href={`mailto:${contract.dedicatedEmail}`} muted>{contract.dedicatedEmail}</ContactLine>
                )}
                {contract.clientPhone && (
                  <ContactLine icon="phone" href={`tel:${contract.clientPhone}`}>{contract.clientPhone}</ContactLine>
                )}
                {addressLines.length > 0 && (
                  <div className="flex gap-2 text-brown-dark">
                    <Icon name="pin" />
                    <div className="text-xs leading-relaxed">
                      {addressLines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  </div>
                )}
                {(contract.clientKvk || contract.clientVat) && (
                  <div className="pt-3 border-t border-brown-dark/10 text-xs text-brown-subtle space-y-1">
                    {contract.clientKvk && <div>KVK: <span className="text-brown-dark font-mono">{contract.clientKvk}</span></div>}
                    {contract.clientVat && <div>VAT: <span className="text-brown-dark font-mono">{contract.clientVat}</span></div>}
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="panel p-5">
              <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-4">Timeline</div>
              <ul className="space-y-3 text-sm">
                <TimelineItem label="Created" value={fmtDateTime(contract.createdAt)} dotClass="bg-brown-rust" />
                <TimelineItem label="Last updated" value={fmtDateTime(contract.updatedAt)} dotClass="bg-brown-pale" />
                {contract.sentAt && <TimelineItem label="Sent to client" value={fmtDateTime(contract.sentAt)} dotClass="bg-warning" />}
                {contract.signedAt && <TimelineItem label="Signed" value={fmtDateTime(contract.signedAt)} dotClass="bg-success" />}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ── Small presentational helpers ── */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle mb-1">{label}</div>
      <div className="text-brown-dark">{value}</div>
    </div>
  )
}

function PayCard({ label, sub, amount }: { label: string; sub: string; amount: number }) {
  return (
    <div className="rounded-lg border border-brown-dark/10 bg-brown-pale/30 p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle">{label}</div>
      <div className="font-heading text-lg font-black text-brown-dark tabular-nums mt-0.5">{fmtEur(amount)}</div>
      <div className="text-[11px] text-brown-subtle mt-0.5">{sub}</div>
    </div>
  )
}

function Row({ label, amount, note, muted }: { label: string; amount: number; note?: string; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-brown-dark/5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-brown-dark">{label}</div>
        {note && <div className="text-[11px] text-brown-subtle mt-0.5">{note}</div>}
      </div>
      <div className={`font-semibold tabular-nums ${muted ? 'text-brown-subtle italic' : 'text-brown-dark'}`}>
        {fmtEur(amount)}
      </div>
    </div>
  )
}

function ContactLine({ icon, href, children, muted }: { icon: 'mail' | 'phone'; href: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <a href={href} className={`flex items-center gap-2 hover:underline ${muted ? 'text-brown-subtle' : 'text-brown-rust'}`}>
      <Icon name={icon} />
      <span className="text-xs">{children}</span>
    </a>
  )
}

function TimelineItem({ label, value, dotClass }: { label: string; value: string; dotClass: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-1.5 inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle">{label}</div>
        <div className="text-brown-dark text-xs">{value}</div>
      </div>
    </li>
  )
}

function Icon({ name }: { name: 'mail' | 'phone' | 'pin' }) {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'mail') return (
    <svg {...common}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
  )
  if (name === 'phone') return (
    <svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
  )
  return (
    <svg {...common}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  )
}
