'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PLANS,
  ADDON_PRICES,
  PHASE_LABELS,
  KNOWN_CLIENTS,
  findKnownClient,
  upsertKnownClient,
  nextContractId,
  type PlanKey,
  type ContractType,
  type PhaseKey,
  type LanguageKey,
  type KnownClient,
} from '@/lib/contracts'
import { generateContractHtml, type PreviewData, type Hosting } from '@/lib/contractHtml'
// Re-export PreviewData so other files can continue importing it from here
export type { PreviewData } from '@/lib/contractHtml'

const STEPS: { num: number; label: string; sub: string }[] = [
  { num: 1, label: 'Client details',   sub: 'Who is this for?' },
  { num: 2, label: 'Contract type',    sub: 'Plan & phase' },
  { num: 3, label: 'Project details',  sub: 'Scope & timeline' },
  { num: 4, label: 'Pricing',          sub: 'Payments & fees' },
  { num: 5, label: 'Revisions',        sub: 'Scope & tiers' },
  { num: 6, label: 'Add-ons',          sub: 'Extras & hosting' },
  { num: 7, label: 'Generate',         sub: 'Preview & send' },
]

const STEP_PROGRESS: Record<number, number> = { 1: 14, 2: 28, 3: 42, 4: 56, 5: 70, 6: 84, 7: 100 }

const TYPE_OPTIONS: { key: ContractType; title: string; desc: string }[] = [
  { key: 'standard',  title: 'Standard project',  desc: 'Full project across all 3 phases. Requires plan selection.' },
  { key: 'phase',     title: 'Phase contract',    desc: 'A single phase for an existing client.' },
  { key: 'extension', title: 'Scope extension',   desc: 'Add-on or new feature for an active project.' },
  { key: 'custom',    title: 'Custom agreement',  desc: 'Special pricing, friend rate or non-standard terms.' },
]

// Hosting type is imported from @/lib/contractHtml

const fmtEur = (v: number) => v > 0 ? '€' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '—'
const fmtPlain = (v: number) => v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/**
 * Service Provider details — Engaging UX Design.
 * These appear on every contract preview as the legally-required party block.
 * Update here if business details change.
 */
const PROVIDER = {
  legalName: 'Engaging UX Design',
  legalForm: 'Eenmanszaak (sole proprietorship)',
  address: 'Eindhoven',
  postalCode: '',
  city: 'Eindhoven',
  country: 'Netherlands',
  email: 'info@engaginguxdesign.com',
  legalEmail: 'legal@engaginguxdesign.com',
  phone: '+31 6 17 60 24 41',
  website: 'engaginguxdesign.com',
  kvk: 'KvK registered',
  vat: 'VAT-registered (NL)',
  termsUrl: 'https://engaginguxdesign.com/service-terms-and-conditions',
}

export type WizardPrefill = {
  contractCode: string
  contractType: ContractType
  plan: PlanKey | null
  phase: PhaseKey
  language: LanguageKey | string | null
  projectName: string | null
  deliverables: string | null
  phaseStart: string | null
  phaseEnd: string | null
  client: {
    name: string
    company?: string | null
    email?: string | null
    phone?: string | null
    kvk?: string | null
    vat?: string | null
    address?: string | null
    postalCode?: string | null
    city?: string | null
    country?: string | null
    dedicatedEmail?: string | null
  }
  pricing: { total: number; initFee: number; tier2Rate: number }
  data: PreviewData | null
}

export default function ContractWizard({ prefill, mode = 'new' }: { prefill?: WizardPrefill; mode?: 'new' | 'edit' } = {}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const editingCode = mode === 'edit' && prefill ? prefill.contractCode : null

  // ── Step 1: client details ──
  const [clientName, setClientName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [kvk, setKvk] = useState('')
  const [vat, setVat] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('Netherlands')
  // Track the previously matched client name so we only auto-fill ONCE per match
  const lastAutofilledRef = useRef<string>('')

  // ── Step 2: type / plan ──
  const [contractType, setContractType] = useState<ContractType>('standard')
  const [plan, setPlan] = useState<PlanKey>('business')
  const [phase, setPhase] = useState<PhaseKey>('phase1')
  const [language, setLanguage] = useState<LanguageKey>('bilingual')

  // ── Step 3 ──
  const [projectName, setProjectName] = useState('')
  const [deliverables, setDeliverables] = useState('')
  const [phaseStart, setPhaseStart] = useState('')
  const [phaseEnd, setPhaseEnd] = useState('')

  // ── Step 4 ──
  const [totalVal, setTotalVal] = useState<string>('')
  const [initFee, setInitFee] = useState<string>('')

  // ── Step 5 ──
  const [tier2Rate, setTier2Rate] = useState<string>('')

  // ── Step 6: hosting + add-ons (custom-aware editable prices) ──
  const [hosting, setHosting] = useState<Hosting>('hosting')
  const [clientHostingNote, setClientHostingNote] = useState('')
  const [domainPrice, setDomainPrice] = useState<string>('') // €/yr
  const [hostingPrice, setHostingPrice] = useState<string>('') // €/yr

  type AddonState = {
    on: boolean
    price: string // numeric string
    note?: string
  }
  const [seoAddon, setSeoAddon] = useState<AddonState>({ on: false, price: '' })
  const [logoAddon, setLogoAddon] = useState<AddonState>({ on: false, price: '', note: '' })
  const [supportAddon, setSupportAddon] = useState<AddonState & { months: string }>({ on: false, price: '', months: '12' })
  const [supabaseAddon, setSupabaseAddon] = useState<AddonState>({ on: true, price: '' })
  const [vercelAddon, setVercelAddon] = useState<AddonState>({ on: false, price: '' })

  // ── Step 7 ──
  const [previewLang, setPreviewLang] = useState<'en' | 'nl'>('en')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Custom autocomplete for client name ──
  const [nameFocused, setNameFocused] = useState(false)
  const clientNameRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (clientNameRef.current && !clientNameRef.current.contains(e.target as Node)) {
        setNameFocused(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // ─────────── Prefill on mount (edit mode) ───────────
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!prefill || hydratedRef.current) return
    hydratedRef.current = true
    // Mark client name as "already auto-filled" so the matched-client effect
    // doesn't overwrite the saved values.
    lastAutofilledRef.current = prefill.client.name || ''

    setClientName(prefill.client.name || '')
    setCompany(prefill.client.company || '')
    setEmail(prefill.client.email || '')
    setPhone(prefill.client.phone || '')
    setKvk(prefill.client.kvk || '')
    setVat(prefill.client.vat || '')
    setAddress(prefill.client.address || '')
    setPostalCode(prefill.client.postalCode || '')
    setCity(prefill.client.city || '')
    setCountry(prefill.client.country || 'Netherlands')

    setContractType((prefill.contractType as ContractType) || 'standard')
    if (prefill.plan && prefill.plan !== 'custom') setPlan(prefill.plan as PlanKey)
    setPhase((prefill.phase as PhaseKey) || 'phase1')
    if (prefill.language === 'en' || prefill.language === 'nl' || prefill.language === 'bilingual') {
      setLanguage(prefill.language as LanguageKey)
    }

    setProjectName(prefill.projectName || '')
    setDeliverables(prefill.deliverables || '')
    setPhaseStart(prefill.phaseStart || '')
    setPhaseEnd(prefill.phaseEnd || '')

    setTotalVal(prefill.pricing.total ? String(prefill.pricing.total) : '')
    setInitFee(prefill.pricing.initFee ? String(prefill.pricing.initFee) : '')
    setTier2Rate(prefill.pricing.tier2Rate ? String(prefill.pricing.tier2Rate) : '')

    if (prefill.data) {
      const d = prefill.data
      if (d.hosting) {
        setHosting(d.hosting.mode || 'hosting')
        setDomainPrice(d.hosting.domainPrice ? String(d.hosting.domainPrice) : '')
        setHostingPrice(d.hosting.hostingPrice ? String(d.hosting.hostingPrice) : '')
        if (d.hosting.clientHostingNote) setClientHostingNote(d.hosting.clientHostingNote)
      }
      if (d.addons) {
        setSeoAddon({ on: !!d.addons.seo?.on, price: d.addons.seo?.price ? String(d.addons.seo.price) : '' })
        setLogoAddon({ on: !!d.addons.logo?.on, price: d.addons.logo?.price ? String(d.addons.logo.price) : '', note: d.addons.logo?.note || '' })
        setSupportAddon({ on: !!d.addons.support?.on, price: d.addons.support?.price ? String(d.addons.support.price) : '', months: String(d.addons.support?.months ?? 12) })
        setSupabaseAddon({ on: !!d.addons.supabase?.on, price: d.addons.supabase?.price ? String(d.addons.supabase.price) : '' })
        setVercelAddon({ on: !!d.addons.vercel?.on, price: d.addons.vercel?.price ? String(d.addons.vercel.price) : '' })
      }
    }
  }, [prefill])

  const matchedClient = useMemo(() => findKnownClient(clientName), [clientName])
  const nameSuggestions = useMemo(() => {
    const q = clientName.trim().toLowerCase()
    if (!q) return KNOWN_CLIENTS.slice(0, 8)
    return KNOWN_CLIENTS.filter(c =>
      c.name.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q),
    ).slice(0, 8)
  }, [clientName])
  const planMeta = PLANS[plan]
  const effectivePlan: PlanKey = contractType === 'custom' ? 'custom' : plan

  const contractId = useMemo(() => {
    if (editingCode) return editingCode
    const code = matchedClient?.clientCode ?? '0000000'
    const phaseIndex = matchedClient ? matchedClient.contracts + 1 : 1
    return nextContractId(code, phaseIndex)
  }, [matchedClient, editingCode])

  // ─────────── Step 1 autofill on match ───────────
  // When a matched client is detected, fill any blank fields with the stored
  // values. We only run once per matched name so manual edits aren't overwritten.
  useEffect(() => {
    if (!matchedClient) {
      lastAutofilledRef.current = ''
      return
    }
    if (lastAutofilledRef.current === matchedClient.name) return
    lastAutofilledRef.current = matchedClient.name
    setEmail(prev => prev || matchedClient.email || '')
    setCompany(prev => prev || matchedClient.company || '')
    setPhone(prev => prev || matchedClient.phone || '')
    setKvk(prev => prev || matchedClient.kvk || '')
    setVat(prev => prev || matchedClient.vat || '')
    setAddress(prev => prev || matchedClient.address || '')
    setPostalCode(prev => prev || matchedClient.postalCode || '')
    setCity(prev => prev || matchedClient.city || '')
    setCountry(prev => prev || matchedClient.country || 'Netherlands')
  }, [matchedClient])

  // ─────────── Step 4 pre-fill on entering ───────────
  useEffect(() => {
    if (step === 4) {
      const meta = contractType === 'custom' ? PLANS.custom : PLANS[plan]
      if (totalVal === '') setTotalVal(meta.price ? String(meta.price) : '')
      if (initFee === '') setInitFee(meta.initFee ? String(meta.initFee) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ─────────── Step 5 default tier 2 rate by plan ───────────
  useEffect(() => {
    if (step === 5 && tier2Rate === '') {
      setTier2Rate(String(PLANS[effectivePlan].rate))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, effectivePlan])

  // ─────────── Step 6 pre-fill prices when entering / type changes ───────────
  // For non-custom contracts we use plan defaults; for custom we leave blank
  // so the admin can enter the negotiated amount manually.
  useEffect(() => {
    if (step !== 6) return
    const isCustom = contractType === 'custom'
    const defaults = ADDON_PRICES[effectivePlan]
    setSeoAddon(s => ({ ...s, price: s.price === '' ? (isCustom ? '' : String(defaults.seo)) : s.price }))
    setLogoAddon(s => ({ ...s, price: s.price === '' ? (isCustom ? '' : String(defaults.logo)) : s.price }))
    setSupportAddon(s => ({ ...s, price: s.price === '' ? (isCustom ? '' : String(defaults.support)) : s.price }))
    setDomainPrice(p => p === '' ? (isCustom ? '' : String(defaults.domain)) : p)
    setHostingPrice(p => p === '' ? (isCustom ? '' : '36') : p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, contractType, effectivePlan])

  const total = parseFloat(totalVal) || 0
  const initial = parseFloat(initFee) || 0
  const breakdown = {
    p1: total * 0.30,
    init: initial,
    p2: total * 0.40,
    p3: total * 0.30,
    total,
  }

  const tier2Available = phase === 'phase2' || phase === 'phase3'
  const phaseNote =
    contractType === 'custom'
      ? null
      : phase === 'phase1' || contractType === 'standard'
        ? 'Phase 1 contract: Tier 2 structural revision is not available. Structural changes can only be requested before proceeding to Phase 2. It is the client\u2019s responsibility to raise all change requests at Phase 1 sign-off.'
        : phase === 'phase2'
          ? 'Phase 2 contract: Tier 2 structural changes are now available if scoped here.'
          : phase === 'phase3'
            ? 'Phase 3 is the final build and launch phase. Structural changes at this stage are charged at a premium rate.'
            : null

  // Persist filled-in client info when leaving Step 1
  function persistClientIfNeeded() {
    if (!clientName.trim()) return
    upsertKnownClient({
      name: clientName.trim(),
      email,
      company,
      phone,
      kvk,
      vat,
      address,
      postalCode,
      city,
      country,
    })
  }

  const skipRevisions = phase === 'phase1'

  function next() {
    if (step === 1) persistClientIfNeeded()
    if (step < 7) setStep(s => (s === 4 && skipRevisions) ? 6 : s + 1)
  }
  function prev() {
    if (step > 1) setStep(s => (s === 6 && skipRevisions) ? 4 : s - 1)
  }

  async function generate(targetLang?: 'en' | 'nl') {
    const lang = targetLang ?? previewLang
    await openContractPrintWindow(lang, previewData)
  }

  async function saveContract() {
    if (!clientName.trim()) {
      alert('Add a client name before saving the contract.')
      return
    }
    setSaving(true)
    setSaveStatus(null)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractCode: contractId,
          contractType,
          plan: effectivePlan,
          phase,
          phaseLabel: PHASE_LABELS[phase],
          language: previewLang,
          projectName,
          deliverables,
          phaseStart,
          phaseEnd,
          client: previewData.client,
          pricing: previewData.pricing,
          data: previewData,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Save failed')
      }
      setSaveStatus({ type: 'success', text: `Saved — ${contractId}` })
      setTimeout(() => router.push(`/contracts/${encodeURIComponent(contractId)}`), 1200)
    } catch (e) {
      setSaveStatus({ type: 'error', text: e instanceof Error ? e.message : 'Save failed' })
      setSaving(false)
      setTimeout(() => setSaveStatus(null), 4000)
    }
  }

  async function sendForSignature() {
    if (!clientName.trim()) {
      alert('Add a client name before sending.')
      return
    }
    const recipientEmail = (matchedClient?.dedicatedEmail || email || '').trim()
    if (!recipientEmail) {
      alert('No client email found. Add one in Step 1 before sending.')
      return
    }
    setSaving(true)
    setSaveStatus(null)
    try {
      // 1. Upsert the contract record
      const saveRes = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractCode: contractId,
          contractType,
          plan: effectivePlan,
          phase,
          phaseLabel: PHASE_LABELS[phase],
          language: previewLang,
          projectName,
          deliverables,
          phaseStart,
          phaseEnd,
          client: previewData.client,
          pricing: previewData.pricing,
          data: previewData,
        }),
      })
      if (!saveRes.ok) {
        const j = await saveRes.json().catch(() => ({}))
        throw new Error(j.error || 'Save failed')
      }
      // 2. Send to DocuSign
      const signRes = await fetch(`/api/contracts/${encodeURIComponent(contractId)}/send-for-signature`, {
        method: 'POST',
      })
      const j = await signRes.json().catch(() => ({}))
      if (!signRes.ok) throw new Error(j.error || 'Failed to send for signature')
      setSaveStatus({ type: 'success', text: `Sent to ${j.sentTo || recipientEmail} for signature via DocuSign` })
    } catch (e) {
      setSaveStatus({ type: 'error', text: e instanceof Error ? e.message : 'Failed to send' })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveStatus(null), 6000)
    }
  }

  // Build a flat snapshot for the preview component
  const previewData: PreviewData = {
    contractId,
    contractType,
    plan: effectivePlan,
    phase,
    phaseLabel: PHASE_LABELS[phase],
    projectName,
    deliverables,
    phaseStart,
    phaseEnd,
    client: {
      name: clientName, company, email, phone, kvk, vat, address, postalCode, city, country,
      dedicatedEmail: matchedClient?.dedicatedEmail || '',
    },
    pricing: {
      total,
      initFee: initial,
      p1: breakdown.p1,
      p2: breakdown.p2,
      p3: breakdown.p3,
      tier2Rate: parseFloat(tier2Rate) || PLANS[effectivePlan].rate,
    },
    hosting: {
      mode: hosting,
      domainPrice: parseFloat(domainPrice) || 0,
      hostingPrice: parseFloat(hostingPrice) || 0,
      clientHostingNote: hosting === 'none' ? clientHostingNote : '',
    },
    addons: {
      seo:      { on: seoAddon.on,      price: parseFloat(seoAddon.price) || 0 },
      logo:     { on: logoAddon.on,     price: parseFloat(logoAddon.price) || 0, note: logoAddon.note || '' },
      support:  { on: supportAddon.on,  price: parseFloat(supportAddon.price) || 0, months: parseInt(supportAddon.months) || 0 },
      supabase: { on: supabaseAddon.on, price: parseFloat(supabaseAddon.price) || 0 },
      vercel:   { on: vercelAddon.on,   price: parseFloat(vercelAddon.price) || 0 },
    },
  }

  return (
    <div className="wizard-wrap">
      {/* Step tracker */}
      <aside className="wizard-steps">
        {STEPS.map((s, i) => {
          const isSkipped = s.num === 5 && skipRevisions
          const state = isSkipped ? 'skipped' : step === s.num ? 'active' : step > s.num ? 'done' : 'default'
          return (
            <div key={s.num}>
              <div className={`wstep wstep-${state}`} style={isSkipped ? { opacity: 0.35 } : undefined}>
                <div className="wstep-circle">{state === 'done' ? '\u2713' : isSkipped ? '\u2014' : s.num}</div>
                <div className="wstep-text">
                  <div className="wstep-label">{s.label}</div>
                  <div className="wstep-sub">{isSkipped ? 'N/A \u2014 Phase 1' : s.sub}</div>
                </div>
              </div>
              {i < STEPS.length - 1 && <div className="wstep-divider" />}
            </div>
          )
        })}
      </aside>

      {/* Form panel */}
      <section className="wizard-form">
        <div className="wizard-progress-track">
          <div className="wizard-progress-fill" style={{ width: STEP_PROGRESS[step] + '%' }} />
        </div>

        {/* ───────────── Step 1 ───────────── */}
        {step === 1 && (
          <div>
            <h2 className="wstep-heading">Client details</h2>
            <p className="wstep-tagline">
              Existing clients are auto-filled from history. Add any missing details — they will be saved when you continue.
            </p>

            {matchedClient && <ClientMatchCard matchedClient={matchedClient} />}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name *">
                <div ref={clientNameRef} className="client-suggest-wrap">
                  <input
                    value={clientName}
                    onChange={e => { setClientName(e.target.value); setNameFocused(true) }}
                    onFocus={() => setNameFocused(true)}
                    placeholder="e.g. Joey de Laat"
                    autoComplete="off"
                  />
                  {nameFocused && nameSuggestions.length > 0 && (
                    <div className="client-suggest-dropdown">
                      {nameSuggestions.map(c => (
                        <button
                          key={c.name}
                          type="button"
                          className="client-suggest-item"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setClientName(c.name); setNameFocused(false) }}
                        >
                          <div className="client-suggest-avatar">{c.initials}</div>
                          <div className="client-suggest-text">
                            <div className="client-suggest-name">{c.name}</div>
                            <div className="client-suggest-meta">{c.company || c.type}{c.email ? ` · ${c.email}` : ''}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Company (optional)">
                <input value={company} onChange={e => setCompany(e.target.value)} />
              </Field>
              <Field label="Email *">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </Field>
              <Field label="Phone">
                <input value={phone} onChange={e => setPhone(e.target.value)} />
              </Field>
              <Field label="KvK number (if business)">
                <input value={kvk} onChange={e => setKvk(e.target.value)} />
              </Field>
              <Field label="VAT / BTW number (if applicable)">
                <input value={vat} onChange={e => setVat(e.target.value)} placeholder="e.g. NL123456789B01" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Street address">
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Stratumsedijk 6" />
                </Field>
              </div>
              <Field label="Postal code">
                <input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="e.g. 5611 NB" />
              </Field>
              <Field label="City *">
                <input value={city} onChange={e => setCity(e.target.value)} />
              </Field>
              <Field label="Country">
                <input value={country} onChange={e => setCountry(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {/* ───────────── Step 2 ───────────── */}
        {step === 2 && (
          <div>
            <h2 className="wstep-heading">Contract type</h2>
            <p className="wstep-tagline">Choose the type, plan and phase. The wizard adapts to your selection.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {TYPE_OPTIONS.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setContractType(t.key)}
                  className={`type-card ${contractType === t.key ? 'type-card-active' : ''}`}
                >
                  <div className="font-bold text-brown-dark text-sm mb-1">{t.title}</div>
                  <div className="text-xs text-brown-subtle leading-relaxed">{t.desc}</div>
                </button>
              ))}
            </div>

            {contractType !== 'custom' && (
              <>
                <div className="text-xs font-bold uppercase tracking-wider text-brown-muted mb-2">Plan</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  {(['basic', 'business', 'enterprise'] as PlanKey[]).map(p => {
                    const meta = PLANS[p]
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlan(p)}
                        className={`type-card ${plan === p ? 'type-card-active' : ''}`}
                      >
                        <div className="font-bold text-brown-dark text-sm">{meta.label}</div>
                        <div className="font-heading font-black text-brown-rust text-base mt-1">from €{meta.price.toLocaleString()}</div>
                        <div className="text-xs text-brown-subtle leading-relaxed mt-1">{meta.description}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {contractType === 'custom' && (
              <div className="warn-note mb-5">
                Custom agreement: all pricing will start at €0. You fill in the exact amounts in Step 4 and Step 6. No plan tier required.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              <Field label="Phase">
                <select value={phase} onChange={e => setPhase(e.target.value as PhaseKey)}>
                  {(Object.keys(PHASE_LABELS) as PhaseKey[]).map(k => (
                    <option key={k} value={k}>{PHASE_LABELS[k]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Language">
                <select value={language} onChange={e => setLanguage(e.target.value as LanguageKey)}>
                  <option value="bilingual">Bilingual (EN + NL)</option>
                  <option value="en">English only</option>
                  <option value="nl">Dutch only</option>
                </select>
              </Field>
            </div>

            {phaseNote && <div className="info-note">{phaseNote}</div>}
          </div>
        )}

        {/* ───────────── Step 3 ───────────── */}
        {step === 3 && (
          <div>
            <h2 className="wstep-heading">Project details</h2>
            <p className="wstep-tagline">Define what is being delivered and the timeline for this phase.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Project name">
                <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Photographer portfolio" />
              </Field>
              <Field label="Contract ID">
                <input value={contractId} readOnly className="contract-id-readonly" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Deliverables">
                  <textarea rows={3} value={deliverables} onChange={e => setDeliverables(e.target.value)} placeholder="Bullet list of what is included in this phase…" />
                </Field>
              </div>
              <Field label="Phase start date">
                <input type="date" value={phaseStart} onChange={e => setPhaseStart(e.target.value)} />
              </Field>
              <Field label="Estimated completion">
                <input type="date" value={phaseEnd} onChange={e => setPhaseEnd(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {/* ───────────── Step 4 ───────────── */}
        {step === 4 && (
          <div>
            <h2 className="wstep-heading">Pricing & payments</h2>
            <p className="wstep-tagline">Pre-filled from the selected plan. Adjust the totals — the breakdown updates live.</p>

            {contractType === 'custom' && (
              <div className="info-note mb-4">
                Custom agreement detected. Fill in the total value above and the breakdown will calculate automatically below.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <Field label="Total project value (€, excl. VAT)">
                <input type="number" step="0.01" value={totalVal} onChange={e => setTotalVal(e.target.value)} />
              </Field>
              <Field label="Project initiation fee (€)">
                <input type="number" step="0.01" value={initFee} onChange={e => setInitFee(e.target.value)} />
              </Field>
            </div>

            <div className="breakdown-card">
              <BreakdownRow label="Phase 1 (30%) — before work starts" value={fmtEur(breakdown.p1)} />
              <BreakdownRow label="Initiation fee deducted" value={initial > 0 ? '\u2212 €' + fmtPlain(initial) : '—'} />
              <BreakdownRow label="Phase 2 (40%) — after Phase 2 approval" value={fmtEur(breakdown.p2)} />
              <BreakdownRow label="Phase 3 (30%) — before publishing" value={fmtEur(breakdown.p3)} />
              <BreakdownRow label="Total (excl. VAT)" value={fmtEur(breakdown.total)} bold />
            </div>
          </div>
        )}

        {/* ───────────── Step 5 ───────────── */}
        {step === 5 && (
          <div>
            <h2 className="wstep-heading">Revision scope</h2>
            <p className="wstep-tagline">Defines what kinds of changes are included, hourly, or quoted separately.</p>

            <div className="rev-card">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-brown-dark text-sm">Tier 1 — Cosmetic changes</div>
                <span className="badge badge-success">Always included</span>
              </div>
              <div className="text-xs text-brown-subtle leading-relaxed">
                Color, font, spacing, copy tweaks. Unlimited rounds within each phase. No extra charge ever.
              </div>
            </div>

            <div className="rev-card">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-brown-dark text-sm">Tier 2 — Structural changes</div>
                {tier2Available
                  ? <span className="badge badge-warning">Charged at hourly rate</span>
                  : <span className="badge badge-neutral">Not available in Phase 1</span>
                }
              </div>
              <div className="text-xs text-brown-subtle leading-relaxed mb-3">
                {tier2Available
                  ? 'Layout restructure, new sections, navigation changes. Scoped per request.'
                  : 'Structural changes are not applicable in Phase 1. The client must raise all change requests at Phase 1 sign-off before Phase 2 begins. It is the client\u2019s responsibility.'
                }
              </div>
              {tier2Available && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-sm">
                    <Field label="Hourly rate (€)">
                      <input type="number" step="1" value={tier2Rate} onChange={e => setTier2Rate(e.target.value)} />
                    </Field>
                  </div>
                  <div className="info-note mt-3">
                    Advised rate for the {planMeta.label} plan: €{PLANS[effectivePlan].rate}/hr. Adjust if needed.
                  </div>
                </>
              )}
            </div>

            {contractType !== 'custom' ? (
              <div className="rev-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-brown-dark text-sm">Tier 3 — New features</div>
                  <span className="badge" style={{ background: '#fce8e0', color: '#8b3a1e' }}>Quoted separately</span>
                </div>
                <div className="text-xs text-brown-subtle leading-relaxed mb-3">
                  Sign-up flows, booking apps, payments, user data. Requires a separate addendum. Third-party costs (Supabase, Vercel) passed through at cost.
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['basic', 'business', 'enterprise'] as PlanKey[]).map(p => {
                    const isActivePlan = p === effectivePlan
                    return (
                      <div key={p} className={`rate-card ${isActivePlan ? 'rate-card-active' : ''}`}>
                        <div className="text-[0.7rem] uppercase tracking-wider text-brown-subtle">{PLANS[p].label}</div>
                        <div className="font-heading font-black text-sm text-brown-dark">€{PLANS[p].rate}/hr</div>
                      </div>
                    )
                  })}
                </div>
                <div className="text-[0.72rem] text-brown-subtle mt-3">
                  Active plan is highlighted. Supabase &amp; Vercel costs are always passed through at cost on top of the hourly rate.
                </div>
              </div>
            ) : (
              <div className="rev-card" style={{ opacity: 0.6 }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-brown-dark text-sm">Tier 3 — New features</div>
                  <span className="badge badge-neutral">Not applicable</span>
                </div>
                <div className="text-xs text-brown-subtle leading-relaxed">
                  Tier 3 does not apply to custom agreements — any new feature work is quoted ad-hoc and billed against the negotiated total.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ───────────── Step 6 ───────────── */}
        {step === 6 && (
          <div>
            <h2 className="wstep-heading">Add-ons & hosting</h2>
            <p className="wstep-tagline">
              {contractType === 'custom'
                ? 'Custom agreement: all prices start at €0 — fill in exactly what was negotiated.'
                : 'Hosting / domain pass-through and optional services. Adjust prices if needed.'}
            </p>

            <div className="text-xs font-bold uppercase tracking-wider text-brown-muted mb-2">Hosting & domain</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <HostingCard
                active={hosting === 'both'}
                onClick={() => setHosting('both')}
                title="Domain + Hosting"
                desc="You provide both via Hostinger"
              />
              <HostingCard
                active={hosting === 'hosting'}
                onClick={() => setHosting('hosting')}
                title="Hosting only"
                desc="Client has their own domain"
              />
              <HostingCard
                active={hosting === 'none'}
                onClick={() => setHosting('none')}
                title="Neither"
                desc="Client manages own hosting"
              />
            </div>

            {hosting !== 'none' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                {hosting === 'both' && (
                  <Field label="Domain price (€/year)">
                    <input type="number" step="0.01" value={domainPrice} onChange={e => setDomainPrice(e.target.value)} placeholder={contractType === 'custom' ? '0.00' : '12.00'} />
                  </Field>
                )}
                <Field label="Hosting price (€/year)">
                  <input type="number" step="0.01" value={hostingPrice} onChange={e => setHostingPrice(e.target.value)} placeholder={contractType === 'custom' ? '0.00' : '36.00'} />
                </Field>
              </div>
            )}

            <div className="info-note mb-3">
              {hosting === 'both' && `Domain + Hostinger hosting passed through at cost, charged annually to client. Combined: ${fmtEur((parseFloat(domainPrice) || 0) + (parseFloat(hostingPrice) || 0))}/yr.`}
              {hosting === 'hosting' && `Hostinger hosting passed through at cost. Client provides their own domain. ${fmtEur(parseFloat(hostingPrice) || 0)}/yr.`}
              {hosting === 'none' && 'Client manages their own hosting. No pass-through costs. A responsibility clause will be added to the contract.'}
            </div>

            {hosting === 'none' && (
              <div className="mb-5">
                <Field label="Client's hosting platform / provider (e.g. Wix, Squarespace, their own server)">
                  <input
                    value={clientHostingNote}
                    onChange={e => setClientHostingNote(e.target.value)}
                    placeholder="e.g. Wix (client owns domain and hosting)"
                  />
                </Field>
                <div className="info-note mt-2 text-xs">
                  The contract will include a clause stating the client is responsible for providing access to their hosting dashboard via info@engaginguxdesign.com, and that they accept all risks associated with their chosen hosting environment.
                </div>
              </div>
            )}

            {hosting !== 'none' && <div className="mb-5" />}

            <div className="text-xs font-bold uppercase tracking-wider text-brown-muted mb-2">Service add-ons</div>

            <EditableAddonRow
              name="Foundational SEO setup"
              priceLabel="One-off (€)"
              on={seoAddon.on}
              price={seoAddon.price}
              onToggle={() => setSeoAddon(s => ({ ...s, on: !s.on }))}
              onPriceChange={v => setSeoAddon(s => ({ ...s, price: v }))}
            />
            <EditableAddonRow
              name="Logo design / creation"
              priceLabel="One-off (€)"
              on={logoAddon.on}
              price={logoAddon.price}
              onToggle={() => setLogoAddon(s => ({ ...s, on: !s.on }))}
              onPriceChange={v => setLogoAddon(s => ({ ...s, price: v }))}
              extra={
                logoAddon.on && contractType === 'custom' ? (
                  <Field label="Logo arrangement note (optional)">
                    <input
                      value={logoAddon.note || ''}
                      onChange={e => setLogoAddon(s => ({ ...s, note: e.target.value }))}
                      placeholder='e.g. "Included free as part of friend rate"'
                    />
                  </Field>
                ) : null
              }
            />
            <EditableAddonRow
              name="Priority support"
              priceLabel="€/month"
              on={supportAddon.on}
              price={supportAddon.price}
              onToggle={() => setSupportAddon(s => ({ ...s, on: !s.on }))}
              onPriceChange={v => setSupportAddon(s => ({ ...s, price: v }))}
              extra={
                supportAddon.on ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Number of months">
                      <input
                        type="number"
                        min="1"
                        value={supportAddon.months}
                        onChange={e => setSupportAddon(s => ({ ...s, months: e.target.value }))}
                        placeholder="e.g. 12"
                      />
                    </Field>
                    <div className="flex items-end">
                      <div className="text-xs text-brown-subtle">
                        Total commitment: <span className="font-heading font-black text-brown-dark text-sm">
                          {fmtEur((parseFloat(supportAddon.price) || 0) * (parseInt(supportAddon.months) || 0))}
                        </span>
                        <div className="mt-1">Client may cancel monthly. Pro-rated refund applies on early cancellation.</div>
                      </div>
                    </div>
                  </div>
                ) : null
              }
            />
            <EditableAddonRow
              name="Supabase (user data / auth)"
              priceLabel="€/month (pass-through)"
              on={supabaseAddon.on}
              price={supabaseAddon.price}
              onToggle={() => setSupabaseAddon(s => ({ ...s, on: !s.on }))}
              onPriceChange={v => setSupabaseAddon(s => ({ ...s, price: v }))}
              hint="Billed at Supabase's actual cost — leave 0 if on free tier."
            />
            <EditableAddonRow
              name="Vercel (hosting / serverless)"
              priceLabel="€/month (pass-through)"
              on={vercelAddon.on}
              price={vercelAddon.price}
              onToggle={() => setVercelAddon(s => ({ ...s, on: !s.on }))}
              onPriceChange={v => setVercelAddon(s => ({ ...s, price: v }))}
              hint="Billed at Vercel's actual cost — leave 0 if on hobby tier."
            />
          </div>
        )}

        {/* ───────────── Step 7 ───────────── */}
        {step === 7 && (
          <div>
            <h2 className="wstep-heading">Generate contract</h2>
            <p className="wstep-tagline">Review the legally-formatted contract, choose a language, then download or send for signature.</p>

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
              <DeliveryCard icon="✍" label="Send for signature" sub="Via Xodo Sign · eIDAS" onClick={sendForSignature} />
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="wizard-footer">
          <button type="button" className="btn btn-ghost" onClick={prev} disabled={step === 1}>← Back</button>
          {step < 7 ? (
            <button type="button" className="btn btn-primary" onClick={next}>Continue →</button>
          ) : (
            <div className="flex items-center gap-2">
              {saveStatus && (
                <span className={`text-xs font-medium ${saveStatus.type === 'success' ? 'text-success' : 'text-danger'}`}>
                  {saveStatus.text}
                </span>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={saveContract}
                disabled={saving}
              >
                {saving ? 'Saving…' : editingCode ? 'Save & republish' : 'Save contract'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => generate()}>Generate contract</button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  Sub-components                                            */
/* ─────────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function BreakdownRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 border-b border-brown-dark/10 last:border-0 ${bold ? 'font-bold text-brown-dark' : 'text-brown-muted'}`}>
      <span className="text-xs sm:text-sm">{label}</span>
      <span className={`tabular-nums text-sm ${bold ? 'font-heading font-black text-base' : ''}`}>{value}</span>
    </div>
  )
}

function HostingCard({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} className={`type-card text-left ${active ? 'type-card-active' : ''}`}>
      <div className="font-bold text-brown-dark text-sm mb-1">{title}</div>
      <div className="text-xs text-brown-subtle leading-relaxed">{desc}</div>
    </button>
  )
}

function ClientMatchCard({ matchedClient }: { matchedClient: KnownClient }) {
  return (
    <div className="client-match-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="client-avatar">{matchedClient.initials}</div>
        <div>
          <div className="font-bold text-brown-dark text-sm">{matchedClient.name}</div>
          <div className="text-xs text-brown-subtle">{matchedClient.email || 'no email yet'} · {matchedClient.type}</div>
        </div>
      </div>
      {matchedClient.phases.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {matchedClient.phases.map(p => (
            <span key={p.label} className={`phase-pill phase-pill-${p.status}`}>
              {p.label} — {p.status}
            </span>
          ))}
        </div>
      )}
      <div className="text-xs text-brown-muted">
        {matchedClient.currentPhase > 0
          ? `Client is currently in Phase ${matchedClient.currentPhase}. Next contract will be Phase ${matchedClient.currentPhase + 1}.`
          : 'Existing client record found — fields below have been pre-filled where available.'}
      </div>
    </div>
  )
}

function EditableAddonRow({
  name, priceLabel, on, price, onToggle, onPriceChange, extra, hint,
}: {
  name: string
  priceLabel: string
  on: boolean
  price: string
  onToggle: () => void
  onPriceChange: (v: string) => void
  extra?: React.ReactNode
  hint?: string
}) {
  return (
    <div className="addon-row-stack">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-brown-dark">{name}</div>
          {hint && <div className="text-xs text-brown-subtle">{hint}</div>}
        </div>
        <button type="button" onClick={onToggle} className={`tog ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`Toggle ${name}`} />
      </div>
      {on && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <Field label={priceLabel}>
              <input type="number" step="0.01" value={price} onChange={e => onPriceChange(e.target.value)} placeholder="0.00" />
            </Field>
          </div>
          {extra}
        </div>
      )}
    </div>
  )
}

function DeliveryCard({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="delivery-card">
      <div className="text-xl mb-1">{icon}</div>
      <div className="font-bold text-brown-dark text-sm">{label}</div>
      <div className="text-xs text-brown-subtle">{sub}</div>
    </button>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  Contract preview (Dutch B2B-compliant template)           */
/* ─────────────────────────────────────────────────────────── */

// PreviewData is now defined in @/lib/contractHtml and re-exported above

export function ContractPreview({ lang, data }: { lang: 'en' | 'nl'; data: PreviewData }) {
  const today = new Date().toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const t = lang === 'nl' ? NL : EN
  const c = data.client

  // Hosting summary
  const hostingTotal = data.hosting.mode === 'both'
    ? data.hosting.domainPrice + data.hosting.hostingPrice
    : data.hosting.mode === 'hosting'
      ? data.hosting.hostingPrice
      : 0
  const hostingLabel = data.hosting.mode === 'both' ? t.hostingBoth
    : data.hosting.mode === 'hosting' ? t.hostingOnly
    : t.hostingNone

  // Active add-ons
  const activeAddons: { label: string; value: string }[] = []
  if (data.addons.seo.on)
    activeAddons.push({ label: t.addonSeo, value: fmtEur(data.addons.seo.price) + ' ' + t.oneOff })
  if (data.addons.logo.on) {
    const v = data.addons.logo.note
      ? `${fmtEur(data.addons.logo.price)} ${t.oneOff} — ${data.addons.logo.note}`
      : `${fmtEur(data.addons.logo.price)} ${t.oneOff}`
    activeAddons.push({ label: t.addonLogo, value: v })
  }
  if (data.addons.support.on) {
    const months = data.addons.support.months || 0
    const monthly = data.addons.support.price
    const total = monthly * months
    activeAddons.push({
      label: t.addonSupport,
      value: `${fmtEur(monthly)}/${t.month} × ${months} ${months === 1 ? t.monthSingular : t.months} = ${fmtEur(total)}`,
    })
  }
  if (data.addons.supabase.on)
    activeAddons.push({ label: 'Supabase', value: data.addons.supabase.price > 0 ? `${fmtEur(data.addons.supabase.price)}/${t.month} (${t.passthrough})` : t.passthrough })
  if (data.addons.vercel.on)
    activeAddons.push({ label: 'Vercel', value: data.addons.vercel.price > 0 ? `${fmtEur(data.addons.vercel.price)}/${t.month} (${t.passthrough})` : t.passthrough })

  return (
    <article className="text-[0.82rem] leading-relaxed text-brown-dark">
      {/* Header */}
      <div className="font-heading font-black text-base text-brown-dark">
        {t.contractTitle}
        {data.projectName ? `: ${data.projectName}` : ''} — {data.phaseLabel}
      </div>
      <div className="text-xs text-brown-subtle mb-4">
        {t.contractId}: {data.contractId} · {t.issued}: {today}
      </div>

      {/* 1. Parties */}
      <div className="contract-section-title">1. {t.parties}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="party-block">
          <div className="party-label">{t.provider}</div>
          <div className="font-bold">{PROVIDER.legalName}</div>
          <div className="text-brown-subtle text-xs">{PROVIDER.legalForm}</div>
          <div>{PROVIDER.address}, {PROVIDER.city}, {PROVIDER.country}</div>
          <div>{PROVIDER.email} · {PROVIDER.phone}</div>
          <div className="text-xs text-brown-subtle mt-1">{PROVIDER.kvk} · {PROVIDER.vat}</div>
        </div>
        <div className="party-block">
          <div className="party-label">{t.client}</div>
          <div className="font-bold">{c.name || `[${t.client}]`}{c.company ? ` — ${c.company}` : ''}</div>
          {(c.address || c.postalCode || c.city) && (
            <div>
              {c.address}{c.address && (c.postalCode || c.city) ? ', ' : ''}
              {c.postalCode} {c.city}{(c.postalCode || c.city) && c.country ? ', ' : ''}
              {c.country}
            </div>
          )}
          <div>
            {c.email || `[${t.email}]`}
            {c.phone ? ` · ${c.phone}` : ''}
          </div>
          {(c.kvk || c.vat) && (
            <div className="text-xs text-brown-subtle mt-1">
              {c.kvk && <>KvK {c.kvk}</>}
              {c.kvk && c.vat ? ' · ' : ''}
              {c.vat && <>BTW {c.vat}</>}
            </div>
          )}
        </div>
      </div>

      {/* 2. Scope of work */}
      <div className="contract-section-title">2. {t.scope}</div>
      <div className="mb-3">
        <div className="text-brown-subtle text-xs uppercase tracking-wider mb-1">{t.deliverables}</div>
        <div className="whitespace-pre-line">{data.deliverables || `[${t.deliverables}]`}</div>
        {(data.phaseStart || data.phaseEnd) && (
          <div className="text-xs text-brown-subtle mt-2">
            {data.phaseStart && <>{t.startDate}: {fmtDate(data.phaseStart, lang)}</>}
            {data.phaseStart && data.phaseEnd ? ' · ' : ''}
            {data.phaseEnd && <>{t.endDate}: {fmtDate(data.phaseEnd, lang)}</>}
          </div>
        )}
      </div>

      {/* 3. Pricing & payment */}
      <div className="contract-section-title">3. {t.payment}</div>
      <div className="mb-3">
        <div>{t.totalLabel}: <strong>{fmtEur(data.pricing.total)}</strong> {t.exVat}</div>
        {data.pricing.initFee > 0 && (
          <div>{t.initFeeLabel}: {fmtEur(data.pricing.initFee)} ({t.initFeeNote})</div>
        )}
        <ul className="list-disc list-inside mt-2 space-y-0.5">
          <li>{t.p1Label}: {fmtEur(data.pricing.p1)} — {t.p1Due}</li>
          <li>{t.p2Label}: {fmtEur(data.pricing.p2)} — {t.p2Due}</li>
          <li>{t.p3Label}: {fmtEur(data.pricing.p3)} — {t.p3Due}</li>
        </ul>
        <div className="text-xs text-brown-subtle mt-2">{t.paymentTerms}</div>
      </div>

      {/* 4. Revisions */}
      <div className="contract-section-title">4. {t.revisions}</div>
      <div className="mb-3">{t.revisionsText({
        rate: data.pricing.tier2Rate,
        tier2: data.phase === 'phase2' || data.phase === 'phase3',
        tier3: data.contractType !== 'custom',
        custom: data.contractType === 'custom',
      })}</div>

      {/* 5. Hosting & add-ons */}
      {(hostingTotal > 0 || activeAddons.length > 0) && (
        <>
          <div className="contract-section-title">5. {t.addons}</div>
          <div className="mb-3">
            {hostingTotal >= 0 && data.hosting.mode !== 'none' && (
              <div className="mb-2">
                <strong>{t.hostingHeading}:</strong> {hostingLabel}
                {hostingTotal > 0 && <> — {fmtEur(hostingTotal)}/{t.year} ({t.passthrough})</>}
              </div>
            )}
            {data.hosting.mode === 'none' && (
              <div className="mb-2">
                <strong>{t.hostingHeading}:</strong> {hostingLabel}
                {data.hosting.clientHostingNote && (
                  <span className="text-brown-subtle"> ({data.hosting.clientHostingNote})</span>
                )}
                <div className="text-xs text-brown-subtle mt-1 leading-relaxed">
                  {t.clientHostingClause}
                </div>
              </div>
            )}
            {activeAddons.length > 0 && (
              <ul className="list-disc list-inside space-y-0.5">
                {activeAddons.map(a => <li key={a.label}><strong>{a.label}:</strong> {a.value}</li>)}
              </ul>
            )}
            {data.addons.support.on && <div className="text-xs text-brown-subtle mt-2">{t.supportCancel}</div>}
          </div>
        </>
      )}

      {/* 6. Client obligations */}
      <div className="contract-section-title">6. {t.obligations}</div>
      <div className="mb-3 text-xs">
        {t.obligationsText}
      </div>

      {/* 7. IP */}
      <div className="contract-section-title">7. {t.ip}</div>
      <div className="mb-3 text-xs">{t.ipText}</div>

      {/* 8. Liability */}
      <div className="contract-section-title">8. {t.liability}</div>
      <div className="mb-3 text-xs">{t.liabilityText}</div>

      {/* 9. Cancellation */}
      <div className="contract-section-title">9. {t.cancellation}</div>
      <div className="mb-3 text-xs">{t.cancellationText}</div>

      {/* 10. Governing law */}
      <div className="contract-section-title">10. {t.governing}</div>
      <div className="mb-3 text-xs">{t.governingText}</div>

      {/* 11. Full terms reference */}
      <div className="contract-section-title">11. {t.fullTerms}</div>
      <div className="mb-4 text-xs">
        {t.fullTermsText} <a href={PROVIDER.termsUrl} target="_blank" rel="noopener noreferrer" className="text-brown-rust underline">{PROVIDER.termsUrl}</a>
      </div>

      {/* Signatures */}
      <div className="contract-section-title">{t.signatures}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <div className="signature-block">
          <div className="text-xs text-brown-subtle mb-6">{t.signedBy} {PROVIDER.legalName}</div>
          <div className="border-t border-brown-dark/30 pt-1 text-xs text-brown-subtle">
            {t.namePlaceholder} · {t.datePlaceholder}
          </div>
        </div>
        <div className="signature-block">
          <div className="text-xs text-brown-subtle mb-6">{t.signedBy} {c.name || `[${t.client}]`}</div>
          <div className="border-t border-brown-dark/30 pt-1 text-xs text-brown-subtle">
            {t.namePlaceholder} · {t.datePlaceholder}
          </div>
        </div>
      </div>
    </article>
  )
}

function fmtDate(iso: string, lang: 'en' | 'nl'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* ─────────── PDF generation via print window ─────────── */
/*
 * Renders the multi-page A4 service agreement defined in
 * /billing-and-contract-admin/contract-instruction/contract-template-instruction.md, matching
 * the visual template in contract-template-sample.html.
 *
 * The lang parameter is accepted for backward compatibility, but the contract
 * template is currently English only — that is the legal master version.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function openContractPrintWindow(_lang: 'en' | 'nl', data: PreviewData) {
  // Embed signature as base64 data URL so it loads reliably in about:blank windows
  let sigBase64 = ''
  try {
    const res = await fetch('/cess-signature.png')
    const blob = await res.blob()
    sigBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    // signature won't render but the rest of the contract is usable
  }
  const html = generateContractHtml(data, { sigBase64, includePrintScript: true })

  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) {
    alert('Pop-up blocked. Please allow pop-ups for this site to download the contract.')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

/* ─────────── Translations ─────────── */

const EN = {
  contractTitle: 'Service Agreement',
  contractId: 'Contract ID',
  issued: 'Issued',
  parties: 'Parties',
  provider: 'Service Provider',
  client: 'Client',
  email: 'client email',
  scope: 'Scope of Work',
  deliverables: 'Deliverables',
  startDate: 'Phase start',
  endDate: 'Estimated completion',
  payment: 'Pricing & Payment',
  totalLabel: 'Total project value',
  exVat: '(excl. VAT — VAT charged at applicable Dutch / EU rate)',
  initFeeLabel: 'Project Initiation Fee',
  initFeeNote: 'fully deducted from the Phase 1 payment',
  p1Label: 'Phase 1 (30%)',
  p1Due: 'due before Phase 1 work begins',
  p2Label: 'Phase 2 (40%)',
  p2Due: 'due after written client approval of Phase 2',
  p3Label: 'Phase 3 (30%)',
  p3Due: 'due before publishing / final delivery',
  paymentTerms: 'Invoices payable within 30 days of invoice date. Late payments subject to statutory interest of 1% per month under Dutch law (Handelsrentewet) and a €25 administrative fee per reminder after the first. Engaging UX Design reserves the right to suspend work where payment is overdue by more than 14 days.',
  revisions: 'Revision Scope',
  revisionsText: (o: { rate: number; tier2: boolean; tier3: boolean; custom: boolean }) => {
    const parts: string[] = []
    parts.push('Tier 1 (cosmetic changes — colour, font, spacing, copy) are included with unlimited rounds per phase.')
    if (o.tier2) parts.push(`Tier 2 (structural changes — layout restructure, new sections, navigation) are charged at €${o.rate}/hr.`)
    else parts.push('Tier 2 (structural changes) are not applicable in this phase. The Client must raise all structural change requests at Phase 1 sign-off.')
    if (o.tier3) parts.push('Tier 3 (new features — sign-up flows, payments, user data) require a separate written addendum.')
    if (o.custom) parts.push('As a custom agreement, additional change requests will be quoted ad-hoc against the negotiated total.')
    parts.push('Third-party costs (Supabase, Vercel, etc.) are passed through at cost.')
    return parts.join(' ')
  },
  addons: 'Hosting & Add-ons',
  hostingHeading: 'Hosting & domain',
  hostingBoth: 'Domain + Hostinger hosting provided by Engaging UX Design',
  hostingOnly: 'Hostinger hosting provided by Engaging UX Design (client provides own domain)',
  hostingNone: 'Client manages own domain and hosting',
  clientHostingClause: 'The client has chosen to use their own hosting and domain services. The client agrees to: (1) provide Engaging UX Design access to their hosting dashboard via info@engaginguxdesign.com; (2) accept full responsibility for all risks associated with their chosen hosting environment; (3) acknowledge that Engaging UX Design has no control over, and accepts no liability for, any technical disturbances, downtime, data loss, or security incidents related to the client\'s hosting provider.',
  passthrough: 'pass-through at cost',
  oneOff: '(one-off)',
  month: 'month',
  monthSingular: 'month',
  months: 'months',
  year: 'yr',
  addonSeo: 'Foundational SEO setup',
  addonLogo: 'Logo design',
  addonSupport: 'Priority support',
  supportCancel: 'Priority support is billed monthly. Client may cancel at any time with written notice; pro-rated refund applies for the unused portion of any pre-paid period.',
  obligations: 'Client Obligations',
  obligationsText: 'Client agrees to provide all required content and assets on time, designate a single decision-maker, provide feedback within 5 business days, and ensure all supplied content is free of third-party IP infringement.',
  ip: 'Intellectual Property',
  ipText: 'Upon receipt of full payment of all outstanding invoices, the Client receives full ownership of the custom deliverables created for this project. Engaging UX Design retains ownership of all deliverables until full payment is received and retains the right to display completed work in its portfolio.',
  liability: 'Limitation of Liability',
  liabilityText: 'To the maximum extent permitted by Dutch law, Engaging UX Design\u2019s total liability under this agreement shall not exceed the total fees paid by the Client for this project. No liability is accepted for indirect, consequential or incidental loss including loss of revenue, data or profits.',
  cancellation: 'Cancellation & Termination',
  cancellationText: 'Either party may terminate by written notice. Upon termination, all completed work is invoiced at the applicable milestone rate, the Project Initiation Fee is non-refundable, and outstanding invoices remain due. Deliverables transfer only after full payment. Projects inactive for over 60 days may be archived and a restart fee applied.',
  governing: 'Governing Law',
  governingText: 'This agreement is governed by Dutch law. Disputes will first be addressed by direct negotiation. If unresolved within 30 days, disputes shall be submitted to the competent court in the district of Oost-Brabant, the Netherlands.',
  fullTerms: 'Full Service Terms',
  fullTermsText: 'This contract is supplemented and governed by the Engaging UX Design Service Terms & Project Conditions in force at the date of signing, available at:',
  signatures: 'Signatures',
  signedBy: 'Signed for',
  namePlaceholder: 'Name',
  datePlaceholder: 'Date',
}

const NL = {
  contractTitle: 'Dienstverleningsovereenkomst',
  contractId: 'Contract-ID',
  issued: 'Uitgegeven',
  parties: 'Partijen',
  provider: 'Dienstverlener',
  client: 'Opdrachtgever',
  email: 'e-mail opdrachtgever',
  scope: 'Werkomschrijving',
  deliverables: 'Op te leveren werk',
  startDate: 'Startdatum fase',
  endDate: 'Geschatte oplevering',
  payment: 'Prijs & Betaling',
  totalLabel: 'Totale projectwaarde',
  exVat: '(excl. BTW — BTW wordt berekend tegen het toepasselijke NL/EU-tarief)',
  initFeeLabel: 'Projectinitiatiekosten',
  initFeeNote: 'volledig in mindering gebracht op de Fase 1-betaling',
  p1Label: 'Fase 1 (30%)',
  p1Due: 'verschuldigd voor aanvang van Fase 1',
  p2Label: 'Fase 2 (40%)',
  p2Due: 'verschuldigd na schriftelijke goedkeuring van Fase 2',
  p3Label: 'Fase 3 (30%)',
  p3Due: 'verschuldigd voor publicatie / eindlevering',
  paymentTerms: 'Facturen zijn betaalbaar binnen 30 dagen na factuurdatum. Bij te late betaling is wettelijke handelsrente van 1% per maand verschuldigd (Handelsrentewet) en €25 administratiekosten per herinnering na de eerste. Engaging UX Design behoudt zich het recht voor om de werkzaamheden op te schorten bij een betalingsachterstand van meer dan 14 dagen.',
  revisions: 'Revisie-omvang',
  revisionsText: (o: { rate: number; tier2: boolean; tier3: boolean; custom: boolean }) => {
    const parts: string[] = []
    parts.push('Tier 1 (cosmetische wijzigingen — kleur, lettertype, spacing, tekst) is inbegrepen met onbeperkte rondes per fase.')
    if (o.tier2) parts.push(`Tier 2 (structurele wijzigingen — layout, nieuwe secties, navigatie) wordt berekend tegen €${o.rate}/uur.`)
    else parts.push('Tier 2 (structurele wijzigingen) is niet van toepassing in deze fase. De opdrachtgever dient alle structurele wijzigingsverzoeken bij goedkeuring van Fase 1 in te dienen.')
    if (o.tier3) parts.push('Tier 3 (nieuwe functies — registratie, betalingen, gebruikersgegevens) vereist een separaat schriftelijk addendum.')
    if (o.custom) parts.push('Als aangepaste overeenkomst worden aanvullende wijzigingsverzoeken ad hoc geoffreerd binnen het overeengekomen totaalbedrag.')
    parts.push('Externe kosten (Supabase, Vercel, etc.) worden tegen kostprijs doorberekend.')
    return parts.join(' ')
  },
  addons: 'Hosting & Aanvullende diensten',
  hostingHeading: 'Hosting & domein',
  hostingBoth: 'Domein + Hostinger hosting verzorgd door Engaging UX Design',
  hostingOnly: 'Hostinger hosting verzorgd door Engaging UX Design (opdrachtgever levert eigen domein)',
  hostingNone: 'Opdrachtgever beheert eigen domein en hosting',
  clientHostingClause: 'De opdrachtgever heeft gekozen voor eigen hosting- en domeinbeheer. De opdrachtgever gaat akkoord met: (1) het verlenen van toegang aan Engaging UX Design tot het hostingdashboard via info@engaginguxdesign.com; (2) volledige verantwoordelijkheid voor alle risico\'s die samenhangen met de gekozen hostingomgeving; (3) de erkenning dat Engaging UX Design geen controle heeft over, en niet aansprakelijk is voor, technische storingen, uitval, gegevensverlies of beveiligingsincidenten die verband houden met de hostingprovider van de opdrachtgever.',
  passthrough: 'tegen kostprijs',
  oneOff: '(eenmalig)',
  month: 'maand',
  monthSingular: 'maand',
  months: 'maanden',
  year: 'jr',
  addonSeo: 'Fundamentele SEO-setup',
  addonLogo: 'Logo-ontwerp',
  addonSupport: 'Priority support',
  supportCancel: 'Priority support wordt maandelijks gefactureerd. De opdrachtgever kan op elk moment opzeggen met schriftelijke kennisgeving; voor het ongebruikte deel van een vooruitbetaalde periode geldt een evenredige terugbetaling.',
  obligations: 'Verplichtingen opdrachtgever',
  obligationsText: 'Opdrachtgever verstrekt tijdig alle benodigde content en materialen, wijst één eindverantwoordelijke aan voor goedkeuringen, geeft feedback binnen 5 werkdagen en garandeert dat aangeleverde content geen inbreuk maakt op rechten van derden.',
  ip: 'Intellectueel Eigendom',
  ipText: 'Na ontvangst van volledige betaling van alle openstaande facturen verkrijgt de opdrachtgever het volledige eigendom van de op maat ontwikkelde deliverables. Engaging UX Design behoudt het eigendom van alle deliverables tot volledige betaling is ontvangen en behoudt het recht om opgeleverd werk in haar portfolio te tonen.',
  liability: 'Beperking van Aansprakelijkheid',
  liabilityText: 'Voor zover toegestaan onder Nederlands recht is de totale aansprakelijkheid van Engaging UX Design uit hoofde van deze overeenkomst beperkt tot het totaal aan honorarium dat door de opdrachtgever voor dit project is voldaan. Aansprakelijkheid voor indirecte, gevolg- of incidentele schade waaronder gederfde inkomsten, dataverlies of winstderving is uitgesloten.',
  cancellation: 'Opzegging & Beëindiging',
  cancellationText: 'Beide partijen kunnen schriftelijk opzeggen. Bij beëindiging wordt het uitgevoerde werk gefactureerd tegen het toepasselijke mijlpaaltarief, zijn de Projectinitiatiekosten niet-restitueerbaar en blijven openstaande facturen verschuldigd. Deliverables worden pas overgedragen na volledige betaling. Projecten die langer dan 60 dagen inactief zijn kunnen worden gearchiveerd en een herstart-tarief kan worden toegepast.',
  governing: 'Toepasselijk Recht',
  governingText: 'Op deze overeenkomst is Nederlands recht van toepassing. Geschillen worden eerst in onderling overleg behandeld. Indien niet binnen 30 dagen opgelost, worden geschillen voorgelegd aan de bevoegde rechter in het arrondissement Oost-Brabant.',
  fullTerms: 'Volledige Algemene Voorwaarden',
  fullTermsText: 'Op deze overeenkomst zijn aanvullend de Engaging UX Design Service Terms & Project Conditions van toepassing zoals geldend op de datum van ondertekening, beschikbaar op:',
  signatures: 'Handtekeningen',
  signedBy: 'Namens',
  namePlaceholder: 'Naam',
  datePlaceholder: 'Datum',
}
