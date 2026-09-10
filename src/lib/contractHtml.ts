// Shared contract HTML template — runs server-side (PDF generation) and client-side (print window).
// Keep this file free of browser-only APIs.

import type { ContractType, PhaseKey } from './contracts'
import { computeSchedule, fmtDueDate, fmtEuro, type PaymentSchedule } from './installments'

export type Hosting = 'both' | 'hosting' | 'none'

export type PreviewData = {
  contractId: string
  contractType: ContractType
  plan: string
  phase: PhaseKey
  phaseLabel: string
  projectName: string
  deliverables: string
  phaseStart: string
  phaseEnd: string
  client: {
    name: string; company: string; email: string; phone: string
    kvk: string; vat: string; address: string; postalCode: string; city: string; country: string
    dedicatedEmail?: string
  }
  pricing: {
    total: number; initFee: number; p1: number; p2: number; p3: number; tier2Rate: number
  }
  /** Variable-length payment schedule. When present it replaces the p1/p2/p3 table. */
  schedule?: PaymentSchedule | null
  /**
   * On a scope extension, the agreement it adds to.
   *
   * Held explicitly rather than read out of the contract code. Extensions used to be
   * numbered inside their parent (…-0001-EXT1), so the parent could be parsed back
   * out; they are now their own family (…-E1-0001) and nothing in the code says what
   * they extend.
   */
  extendsCode?: string | null
  /**
   * Present only on care-plan agreements. A care plan has no milestones and no fixed
   * total, so sections 2, 4 and 5 are rendered from this instead of from the phase
   * split — which would otherwise print three €0.00 milestone rows under a monthly fee.
   */
  carePlan?: {
    includedHours: number
    hourlyRate: number
    monthlyFee: number
    effectiveRate: number
    startDate: string
    noticeDays: number
    includesInfrastructure: boolean
    notes: string
    tiers?: { key: string; name: string; hourlyRate: number; includedHours: number; overageRate: number; blurb: string }[]
    recommended?: string
    selectedTier?: string | null
    /** Codes of the agreements this plan sits alongside, never replaces. */
    complements?: string[]
    features?: { label: string; included?: [boolean, boolean, boolean]; values: [string, string, string] }[]
  } | null
  /**
   * Registration numbers as they stood when this contract was written, captured into
   * the snapshot rather than read live. A contract must state what was true at the
   * moment it was signed — re-rendering last year's agreement should not retroactively
   * claim a registration obtained since. Empty values omit the line entirely.
   */
  owner?: { kvk?: string; vat?: string }
  hosting: { mode: Hosting; domainPrice: number; hostingPrice: number; clientHostingNote?: string }
  addons: {
    seo: { on: boolean; price: number }
    logo: { on: boolean; price: number; note: string }
    support: { on: boolean; price: number; months: number }
    supabase: { on: boolean; price: number }
    vercel: { on: boolean; price: number }
  }
}

export interface GenerateHtmlOptions {
  sigBase64?: string           // admin signature image as base64 data URL
  includePrintScript?: boolean // add window.print() auto-print script (browser only)
  pdfMode?: boolean            // when true: overflow:visible so Puppeteer doesn't clip content
  clientSignedName?: string    // typed name when client has signed
  clientSignedAt?: string      // formatted date when client has signed
  signingReference?: string    // UUID generated at signing time — embedded in audit trail
  signerIp?: string            // IP address captured at signing time
  signerTimestampIso?: string  // full ISO 8601 timestamp of signing (e.g. 2026-04-29T14:32:05.000Z)
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Renders "KvK 12345678 · BTW NL123456789B01" from whatever is actually held.
 *
 * Previously this was the fixed string "KvK registered · VAT-registered (NL)",
 * printed on every contract regardless of whether either registration existed.
 * Asserting a registration you do not hold is not a cosmetic problem on a document
 * a client signs, so the line now renders only from real values and disappears
 * when there are none.
 */
function ownerRegistrationLine(owner?: { kvk?: string; vat?: string }): string {
  const parts: string[] = []
  const kvk = owner?.kvk?.trim()
  const vat = owner?.vat?.trim()
  if (kvk) parts.push(`KvK ${esc(kvk)}`)
  if (vat) parts.push(`BTW ${esc(vat)}`)
  if (parts.length === 0) return ''
  return `<span class="muted">${parts.join(' &middot; ')}</span>`
}

/**
 * Turns the free-text deliverables field into a real nested list.
 *
 * The text already carries structure — "•" for a point, a leading "-" for a detail
 * under it, and bare lines acting as section headings ("Admin App - >"). It was
 * being dropped into a single <p>, so HTML collapsed every newline into a space and
 * the whole scope of work arrived as one unreadable block.
 *
 * Bullets are also normalised out of the middle of lines, because the source text
 * sometimes runs a heading and its first bullet together on one line.
 */
function renderDeliverables(raw: string): string {
  if (!raw.trim()) return '<p class="scope-text">[Deliverables to be specified.]</p>'

  const lines = raw
    .replace(/\s*•\s*/g, '\n• ')   // force every bullet onto its own line
    .split(/\r?\n/)
    .map(l => l.trim())

  type Block =
    | { kind: 'heading'; text: string }
    | { kind: 'list'; items: { text: string; details: string[] }[] }

  const blocks: Block[] = []
  const currentList = () => {
    const last = blocks[blocks.length - 1]
    if (last?.kind === 'list') return last
    const fresh: Block = { kind: 'list', items: [] }
    blocks.push(fresh)
    return fresh as Extract<Block, { kind: 'list' }>
  }

  for (const line of lines) {
    if (!line) continue

    if (line.startsWith('•')) {
      currentList().items.push({ text: line.replace(/^•\s*/, ''), details: [] })
      continue
    }

    if (/^[-–]\s+/.test(line)) {
      const list = currentList()
      const detail = line.replace(/^[-–]\s+/, '')
      if (list.items.length === 0) list.items.push({ text: detail, details: [] })
      else list.items[list.items.length - 1].details.push(detail)
      continue
    }

    // Anything else is a section heading, e.g. "Admin App - >" or a preamble line.
    blocks.push({ kind: 'heading', text: line.replace(/\s*-\s*>\s*$/, '') })
  }

  return blocks
    .map(b => {
      if (b.kind === 'heading') return `<div class="scope-heading">${esc(b.text)}</div>`
      return `<ul class="scope-list">${b.items
        .map(
          it =>
            `<li>${esc(it.text)}${
              it.details.length
                ? `<ul class="scope-sublist">${it.details.map(d => `<li>${esc(d)}</li>`).join('')}</ul>`
                : ''
            }</li>`,
        )
        .join('')}</ul>`
    })
    .join('')
}

const fmt = (v: number) => '€' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function fmtLong(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

export function generateContractHtml(data: PreviewData, opts: GenerateHtmlOptions = {}): string {
  const {
    sigBase64 = '', includePrintScript = false, pdfMode = false,
    clientSignedName = '', clientSignedAt = '',
    signingReference = '', signerIp = '', signerTimestampIso = '',
  } = opts

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const c = data.client
  const isCustom = data.contractType === 'custom'

  const typeLabel =
    data.contractType === 'custom'   ? 'Custom Agreement'
    : data.contractType === 'standard' ? 'Standard Agreement'
    : data.contractType === 'phase'    ? 'Phase Agreement'
    : 'Service Agreement'

  const projectTitle = data.projectName ? esc(data.projectName) : 'Service Agreement'

  // ── Phase scope note (Section 3) ──────────────────────────────────────
  let phaseNote = ''
  if (isCustom) {
    phaseNote = 'This is a Custom Agreement. The scope of work is as described above and agreed between both parties.'
  } else if (data.phase === 'phase1') {
    phaseNote = '<strong>Phase 1 — Strategy &amp; Structure</strong> covers: project kick-off meeting, UX research and sitemap definition, content structure and wireframes, design direction proposal, and written Phase 1 sign-off by the client before Phase 2 begins.'
  } else if (data.phase === 'phase2') {
    phaseNote = '<strong>Phase 2 — Design &amp; Prototype</strong> covers: high-fidelity design in Figma, typography and layout refinement, a fully clickable interactive prototype, and client feedback rounds within the agreed revision scope before Phase 3 begins.'
  } else if (data.phase === 'phase4') {
    // Handover is not a slice of the build — it is the point where the work is
    // accepted as complete. Kept deliberately separate from payment, so a project
    // delivered in September is not treated as unfinished because its final
    // instalment falls the following spring.
    phaseNote = '<strong>Phase 4 — Handover &amp; Acceptance</strong> covers: written confirmation that the delivered work is accepted as complete, handover of all credentials and administrative access, and a 30-day warranty period from the acceptance date during which defects in the delivered work are corrected at no charge. Acceptance marks the completion of the project. Ownership of custom deliverables, source code and any domain registered on the client&rsquo;s behalf transfers on receipt of final payment, which may fall after the acceptance date. Work requested after acceptance, including ongoing support and maintenance, falls outside this agreement and requires a separate contract.'
  } else if (data.phase === 'phase3') {
    phaseNote = '<strong>Phase 3 — Build &amp; Launch</strong> covers: full front-end and back-end development, integration of all dynamic applications, cross-browser and device testing, deployment to the live hosting environment, and final handover of all credentials and source code.'
  }

  // ── Section 4: payment rows ──────────────────────────────────────────
  let paymentRows = ''
  let paymentNote = ''
  const schedule = data.schedule ?? null

  if (schedule && schedule.instalments.length > 0) {
    // Explicit schedule. Credits are printed as their own rows rather than netted
    // off silently, so the Amount column adds up to the stated total on the page.
    const c = computeSchedule(schedule)

    const creditRows = c.credits
      .map(r => {
        const why = [r.note, r.dueDate ? fmtDueDate(r.dueDate) : ''].filter(Boolean).join(' · ')
        return `<tr><td>${esc(r.label)}</td><td>${esc(why || 'Already settled')}</td><td class="amount">${fmt(r.amount)}</td></tr>`
      })
      .join('')

    const termRows = c.instalments
      .map(r => {
        const when = r.dueDate ? `Due ${fmtDueDate(r.dueDate)}` : ''
        const detail = [r.note, when].filter(Boolean).join(' · ')
        // Net sits in the Amount column so it reconciles with the excl.-VAT total;
        // the gross is shown alongside because that is what actually gets transferred.
        return `<tr><td>${esc(r.label)}</td><td>${esc(detail)}${detail ? ' — ' : ''}${fmtEuro(r.gross)} incl. VAT</td><td class="amount">${fmt(r.amount)}</td></tr>`
      })
      .join('')

    paymentRows = creditRows + termRows

    const vatLine =
      c.vatRate > 0
        ? ` VAT at ${c.vatRate}% adds ${fmtEuro(c.totalVat)}, so ${fmtEuro(c.totalGross)} remains payable across ${c.instalments.length} instalments.`
        : ''
    paymentNote =
      `Amounts shown are exclusive of VAT.${vatLine}` +
      (c.creditsNet > 0
        ? ` ${fmtEuro(c.creditsNet)} has already been invoiced and is listed above for completeness — it is not payable again.`
        : '')
  } else if (isCustom) {
    paymentRows = `
      <tr><td>Payment 1 (30%)</td><td>Due before work begins</td><td class="amount">${fmt(data.pricing.p1)}</td></tr>
      <tr><td>Payment 2 (40%)</td><td>Due at agreed midpoint</td><td class="amount">${fmt(data.pricing.p2)}</td></tr>
      <tr><td>Payment 3 (30%)</td><td>Due before final delivery</td><td class="amount">${fmt(data.pricing.p3)}</td></tr>`
    paymentNote = 'No project initiation fee applies to this Custom Agreement.'
  } else if (data.contractType === 'phase') {
    if (data.phase === 'phase1') {
      paymentRows = `<tr><td>Phase 1 — 30%</td><td>Due before Phase 1 work begins</td><td class="amount">${fmt(data.pricing.p1 - data.pricing.initFee)}</td></tr>`
    } else if (data.phase === 'phase2') {
      paymentRows = `<tr><td>Phase 2 — 40%</td><td>Due after written client approval of Phase 2</td><td class="amount">${fmt(data.pricing.p2)}</td></tr>`
    } else {
      paymentRows = `<tr><td>Phase 3 — 30%</td><td>Due before final delivery / publishing</td><td class="amount">${fmt(data.pricing.p3)}</td></tr>`
    }
    // The Phase 1 row prints p1 minus the initiation fee, so without this sentence the
    // three rows visibly fall short of the stated total with no explanation.
    paymentNote = data.pricing.initFee > 0
      ? `The project initiation fee (${fmt(data.pricing.initFee)}) has already been invoiced and is deducted from the Phase 1 amount shown above; the three payments therefore total ${fmt(data.pricing.total - data.pricing.initFee)} against a project value of ${fmt(data.pricing.total)}. The initiation fee is non-refundable.`
      : ''
  } else {
    const p1Net = data.pricing.p1 - data.pricing.initFee
    paymentRows = `
      <tr><td>Phase 1 — 30%</td><td>Due before Phase 1 work begins</td><td class="amount">${fmt(p1Net)}</td></tr>
      <tr><td>Phase 2 — 40%</td><td>Due after written client approval of Phase 2</td><td class="amount">${fmt(data.pricing.p2)}</td></tr>
      <tr><td>Phase 3 — 30%</td><td>Due before final delivery / publishing</td><td class="amount">${fmt(data.pricing.p3)}</td></tr>`
    // The Phase 1 row prints p1 minus the initiation fee, so without this sentence the
    // three rows visibly fall short of the stated total with no explanation.
    paymentNote = data.pricing.initFee > 0
      ? `The project initiation fee (${fmt(data.pricing.initFee)}) has already been invoiced and is deducted from the Phase 1 amount shown above; the three payments therefore total ${fmt(data.pricing.total - data.pricing.initFee)} against a project value of ${fmt(data.pricing.total)}. The initiation fee is non-refundable.`
      : ''
  }

  // ── Section 5: revision tiers ────────────────────────────────────────
  let revisionTiers = ''
  if (isCustom) {
    revisionTiers = `
      <div class="tier-row">
        <div class="tier-index active">1</div>
        <div class="tier-content">
          <div class="tier-title">Cosmetic changes</div>
          <div class="tier-desc">Colour, font, spacing, copy adjustments. Unlimited rounds within each phase.</div>
        </div>
        <span class="tier-badge badge-inc">Included</span>
      </div>
      <div class="note" style="margin-top:10px;">This is a Custom Agreement. Tier 2 (structural changes) and Tier 3 (new features) are not included in this contract. Any structural or feature additions require a separate written agreement.</div>`
  } else if (data.phase === 'phase1') {
    revisionTiers = `
      <div class="tier-row">
        <div class="tier-index active">1</div>
        <div class="tier-content">
          <div class="tier-title">Cosmetic changes</div>
          <div class="tier-desc">Colour, font, spacing, copy adjustments. Unlimited rounds within each phase.</div>
        </div>
        <span class="tier-badge badge-inc">Included</span>
      </div>
      <div class="tier-row">
        <div class="tier-index">2</div>
        <div class="tier-content">
          <div class="tier-title">Structural changes</div>
          <div class="tier-desc">Not available in Phase 1. The client must raise all structural change requests at Phase 1 sign-off before Phase 2 begins. This is the client's responsibility.</div>
        </div>
        <span class="tier-badge" style="background:#f0e4d8;color:#9a7a65;">Phase 2+ only</span>
      </div>
      <div class="tier-row">
        <div class="tier-index">3</div>
        <div class="tier-content">
          <div class="tier-title">New features</div>
          <div class="tier-desc">Sign-up flows, booking systems, payments, user data storage. Each requires a separate written addendum. Data storage and app hosting costs billed at cost.</div>
        </div>
        <span class="tier-badge badge-add">Addendum required</span>
      </div>`
  } else {
    const rate = data.pricing.tier2Rate
    revisionTiers = `
      <div class="tier-row">
        <div class="tier-index active">1</div>
        <div class="tier-content">
          <div class="tier-title">Cosmetic changes</div>
          <div class="tier-desc">Colour, font, spacing, copy adjustments. Unlimited rounds within each phase.</div>
        </div>
        <span class="tier-badge badge-inc">Included</span>
      </div>
      <div class="tier-row">
        <div class="tier-index active">2</div>
        <div class="tier-content">
          <div class="tier-title">Structural changes</div>
          <div class="tier-desc">Layout restructure, new sections, navigation changes. Charged at <strong>€${rate}/hr</strong>. The client is responsible for raising all structural requests before this phase ends.</div>
        </div>
        <span class="tier-badge badge-hr">€${rate}/hr</span>
      </div>
      <div class="tier-row">
        <div class="tier-index">3</div>
        <div class="tier-content">
          <div class="tier-title">New features</div>
          <div class="tier-desc">Sign-up flows, booking systems, payments, user data storage. Each requires a separate written addendum. Data storage and app hosting costs billed at cost.</div>
        </div>
        <span class="tier-badge badge-add">Addendum required</span>
      </div>`
  }

  // ── Section 6: hosting + add-ons ─────────────────────────────────────
  const addonRows: string[] = []
  if (data.hosting.mode === 'both') {
    // Split deliberately. The public pricing page sells "Domain & hosting setup" as a
    // one-off fee; combining it with the annual hosting charge and printing the sum
    // "/yr" billed a setup fee as recurring, which the website does not support.
    if (data.hosting.domainPrice > 0) {
      addonRows.push(`<tr><td class="addon-name">Domain &amp; hosting setup<div class="addon-note">One-off. Domain registration and managed hosting configured on the client&rsquo;s behalf.</div></td><td class="addon-price">${fmt(data.hosting.domainPrice)} one-off</td></tr>`)
    }
    if (data.hosting.hostingPrice > 0) {
      addonRows.push(`<tr><td class="addon-name">Managed hosting via Hostinger<div class="addon-note">Recurring. Passed through at cost; renews annually unless cancelled.</div></td><td class="addon-price">${fmt(data.hosting.hostingPrice)}/yr</td></tr>`)
    }
  } else if (data.hosting.mode === 'hosting') {
    addonRows.push(`<tr><td class="addon-name">Managed hosting via Hostinger<div class="addon-note">Client provides own domain. Managed hosting passed through at cost; renews annually unless cancelled.</div></td><td class="addon-price">${fmt(data.hosting.hostingPrice)}/yr</td></tr>`)
  } else {
    addonRows.push(`<tr><td class="addon-name">Domain &amp; hosting${data.hosting.clientHostingNote ? ` — ${data.hosting.clientHostingNote}` : ''}<div class="addon-note">Client manages own domain and hosting. No pass-through costs.<br/><br/><strong>Client responsibility clause:</strong> The client has chosen to use their own hosting and domain services. The client agrees to: (1) provide Engaging UX Design access to their hosting dashboard via info@engaginguxdesign.com; (2) accept full responsibility for all risks associated with their chosen hosting environment; (3) acknowledge that Engaging UX Design has no control over, and accepts no liability for, any technical disturbances, downtime, data loss, or security incidents related to the client's hosting provider.</div></td><td class="addon-price">€0</td></tr>`)
  }
  if (data.addons.seo.on)
    addonRows.push(`<tr><td class="addon-name">Foundational SEO setup<div class="addon-note">One-off setup of meta tags, structured data, sitemap, robots, and analytics baseline.</div></td><td class="addon-price">${fmt(data.addons.seo.price)}</td></tr>`)
  if (data.addons.logo.on) {
    const noteHtml = data.addons.logo.note ? esc(data.addons.logo.note) : 'One-off logo design and delivery in vector + raster formats.'
    addonRows.push(`<tr><td class="addon-name">Logo design<div class="addon-note">${noteHtml}</div></td><td class="addon-price">${fmt(data.addons.logo.price)}</td></tr>`)
  }
  if (data.addons.support.on) {
    const months = data.addons.support.months || 0
    const total = data.addons.support.price * months
    addonRows.push(`<tr><td class="addon-name">Priority support<div class="addon-note">Fixed monthly — cancel with 1 calendar month written notice.</div></td><td class="addon-price">${fmt(data.addons.support.price)}/mo × ${months} ${months === 1 ? 'month' : 'months'} = ${fmt(total)}</td></tr>`)
  }
  if (data.addons.supabase.on)
    addonRows.push(`<tr><td class="addon-name">Supabase<div class="addon-note">Database / auth — pass-through, no mark-up.</div></td><td class="addon-price pass">At cost</td></tr>`)
  if (data.addons.vercel.on)
    addonRows.push(`<tr><td class="addon-name">Vercel<div class="addon-note">App hosting / serverless — pass-through, no mark-up.</div></td><td class="addon-price pass">At cost</td></tr>`)

  const addonsNote = data.addons.support.on
    ? 'Priority support is a fixed monthly commitment. The client may cancel with written notice at least <strong>one full calendar month in advance</strong>. A pro-rated refund applies for any unused pre-paid portion. Data storage and app hosting costs are billed at cost and invoiced separately.'
    : 'Data storage and app hosting costs (Supabase, Vercel, etc.) are billed at cost and invoiced separately.'

  // ── Section 7: Google account ────────────────────────────────────────
  const hasGoogle = !!c.dedicatedEmail
  const googleEmail = hasGoogle ? esc(c.dedicatedEmail!) : '[to be confirmed]'
  const credentialTiming = isCustom
    ? 'For this Custom Agreement, credentials are shared with the client before Phase 1 work begins.'
    : 'Credentials are shared with the client immediately upon receipt of the project initiation payment.'
  const googleExtraNote = hasGoogle ? '' : '<br><span style="font-size:10.5px;color:#8a6a55;">The dedicated Google account email will be communicated to the client separately.</span>'

  // ── Party blocks ─────────────────────────────────────────────────────
  const clientCompanyLine = c.company ? `${esc(c.company)}<br>` : ''
  const clientAddressParts = [c.address, c.postalCode, c.city, c.country].filter(Boolean).join(', ')
  const clientAddressLine = clientAddressParts ? `${esc(clientAddressParts)}<br>` : ''
  const clientKvkLine = (c.kvk || c.vat)
    ? `<span class="muted">${c.kvk ? 'KvK ' + esc(c.kvk) : ''}${c.kvk && c.vat ? ' · ' : ''}${c.vat ? 'BTW ' + esc(c.vat) : ''}</span>`
    : ''

  const completionDate = data.phaseEnd
    ? new Date(data.phaseEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'To be confirmed'

  const clientName = c.name || '[Client name]'

  /**
   * The terms that govern a monthly plan.
   *
   * A care plan has no milestones, so none of the phase-payment language applies to
   * it. These are the plan's own terms: how the allowance works, what happens to hours
   * that go unused, what is included in the fee, and what an overdue invoice does and
   * does not affect.
   */
  function careTerms(c: NonNullable<PreviewData['carePlan']>): string {
    const rollover = Math.max(1, Math.round(c.includedHours / 2))
    const threshold = Math.max(1, Math.round(c.includedHours * 2))
    return `
      <div class="note">
        <strong>How the included hours work.</strong> Included hours cover technical and design work on the delivered website and application: changes, content and gallery updates, fixes, and feature work within the existing systems. Time is logged in 15-minute increments and reported monthly. Up to ${rollover} unused ${rollover === 1 ? 'hour carries' : 'hours carry'} into the following calendar month only and expire at the end of it. Hours have no cash value and are not refundable, transferable or exchangeable, and any unused hours expire when this agreement ends.
      </div>
      <div class="note">
        <strong>Work beyond the allowance.</strong> Work requested beyond the included hours is agreed in writing before it starts and billed in arrears at ${fmt(c.hourlyRate)} per hour. Engaging UX Design will say so in writing before the allowance is exceeded, and will not incur additional hours without written approval. Work outside the scope of the delivered systems, including new applications or integrations, a visual redesign, migration to a different platform, or any single piece of work reasonably estimated at more than ${threshold} hours, is quoted and agreed as a separate scope extension.
      </div>
      <div class="note">
        <strong>Billing and notice.</strong> This plan runs monthly. There is no minimum term and no annual commitment: it continues month to month until either party ends it with ${c.noticeDays} days&rsquo; written notice, and the plan may be moved up or down at any month boundary on the same notice. Any change to the fee is given 60 days&rsquo; written notice, and no change applies to a month already paid for. The fee is payable monthly in advance.${c.includesInfrastructure ? ' All third-party infrastructure covered by this plan is included in the monthly fee, with no separate pass-through invoices.' : ''}
      </div>
      <div class="note">
        <strong>If an invoice is overdue.</strong> Delivery or release of outstanding work is paused until payment is received. The website, the business email, the domain name and access to the administration application are not suspended, withheld or allowed to lapse for non-payment. On cancellation, a full export of website files, database and client data is provided at no charge, and no service is switched off before the transfer is complete.
      </div>`
  }

  /* ── Which kind of agreement is this? ──────────────────────────────────────
     Three documents share one shell. Only sections 2, 4 and 5 differ: what the
     agreement is at a glance, how it is paid for, and what it includes. Everything
     else — parties, infrastructure, obligations, IP, the legal tail — is common,
     and stays common so a clause fixed once is fixed everywhere. */
  const care = data.carePlan ?? null
  // Legacy extensions were numbered inside their parent, so the parent is still
  // recoverable from those codes; newer ones carry it explicitly.
  const legacyExt = /^(.*)-EXT(\d+)$/.exec(data.contractId || '')
  const isExtension =
    data.contractType === 'extension'
    || !!data.extendsCode
    || !!legacyExt
    || /-E\d+-\d{4}$/.test(data.contractId || '')
  const extendsCode = data.extendsCode || legacyExt?.[1] || ''
  const docKind: 'care' | 'extension' | 'project' =
    care ? 'care' : isExtension ? 'extension' : 'project'

  // A proposal offers three plans and binds none; an agreement states the one chosen.
  const careAgreed = !!care?.selectedTier
  const docTitle =
    docKind === 'care' ? (careAgreed ? 'Care Plan Agreement' : 'Care Plan Proposal')
      : docKind === 'extension' ? 'Scope Extension'
      : 'Service Agreement'

  const glanceLabel =
    docKind === 'care' ? '2. Plan at a Glance'
      : docKind === 'extension' ? '2. Extension at a Glance'
      : '2. Project at a Glance'

  const glanceCells =
    docKind === 'care' && care
      ? `
        <div class="detail-cell">
          <div class="detail-cell-label">${careAgreed ? 'Monthly fee' : 'Plans offered'}</div>
          <div class="detail-cell-value accent">${careAgreed ? `${fmt(care.monthlyFee)} <span style="font-size:9.5px;font-weight:400;color:#9a7a65;">per month, excl. VAT</span>` : `${(care.tiers ?? []).length || 3} to choose from`}</div>
        </div>
        <div class="detail-cell">
          <div class="detail-cell-label">${careAgreed ? 'Included hours' : 'Recommended'}</div>
          <div class="detail-cell-value">${careAgreed ? `${care.includedHours} hours per month` : esc((care.tiers ?? []).find(t => t.key === care.recommended)?.name ?? '')}</div>
        </div>
        <div class="detail-cell">
          <div class="detail-cell-label">Starts</div>
          <div class="detail-cell-value">${esc(fmtLong(care.startDate))}</div>
        </div>`
      : docKind === 'extension'
        ? `
        <div class="detail-cell">
          <div class="detail-cell-label">Extends</div>
          <div class="detail-cell-value">${esc(extendsCode || 'the original agreement')}</div>
        </div>
        <div class="detail-cell">
          <div class="detail-cell-label">Agreed completion</div>
          <div class="detail-cell-value">${esc(completionDate)}</div>
        </div>
        <div class="detail-cell">
          <div class="detail-cell-label">Value of this extension</div>
          <div class="detail-cell-value accent">${fmt(data.pricing.total)} <span style="font-size:9.5px;font-weight:400;color:#9a7a65;">excl. VAT</span></div>
        </div>`
        : `
        <div class="detail-cell">
          <div class="detail-cell-label">Phase</div>
          <div class="detail-cell-value">${esc(data.phaseLabel)}</div>
        </div>
        <div class="detail-cell">
          <div class="detail-cell-label">Estimated completion</div>
          <div class="detail-cell-value">${esc(completionDate)}</div>
        </div>
        <div class="detail-cell">
          <div class="detail-cell-label">Total project value</div>
          <div class="detail-cell-value accent">${fmt(data.pricing.total)} <span style="font-size:9.5px;font-weight:400;color:#9a7a65;">excl. VAT</span></div>
        </div>`

  const paymentLabel = docKind === 'care' ? '4. Fees &amp; Billing' : '4. Payment Schedule'

  const paymentBlock =
    docKind === 'care' && care && !careAgreed
      ? `
      <div class="note">No fee is payable until a plan is chosen. Once a plan is agreed, that plan&rsquo;s fee is billed monthly in advance and the terms below apply to it.</div>
      ${careTerms(care)}`
      : docKind === 'care' && care
      ? `
      <table class="payment-table">
        <thead>
          <tr><th>Item</th><th>Basis</th><th style="text-align:right;">Amount</th></tr>
        </thead>
        <tbody>
          <tr><td>Monthly fee</td><td>Billed monthly in advance</td><td class="amount">${fmt(care.monthlyFee)}</td></tr>
          <tr><td>Included hours</td><td>${care.includedHours} ${care.includedHours === 1 ? 'hour' : 'hours'} each month, within the fee</td><td class="amount">included</td></tr>
          <tr><td>Additional hours</td><td>Agreed in writing in advance, billed in arrears</td><td class="amount">${fmt(care.hourlyRate)}/hr</td></tr>
        </tbody>
      </table>
      ${careTerms(care)}`
      : `
      <table class="payment-table">
        <thead>
          <tr><th>Milestone</th><th>Condition</th><th style="text-align:right;">Amount</th></tr>
        </thead>
        <tbody>
          ${paymentRows}
          <tr><td colspan="2">Total (excl. VAT)</td><td class="amount total">${fmt(data.pricing.total)}</td></tr>
        </tbody>
      </table>
      <div class="note">
        Invoices are payable within 30 days of invoice date. Late payments are subject to contractually agreed interest of 1% per month, in addition to any statutory commercial interest due under art. 6:119a BW and a &euro;25 administrative fee per reminder issued after the first. Where an invoice is overdue, delivery or release of outstanding deliverables is paused until payment is received.${paymentNote ? ' ' + paymentNote : ''}
      </div>`

  const scopeNote =
    docKind === 'extension'
      ? `<div class="note accent" style="margin-top:10px;">This is additional work, outside the scope of ${esc(extendsCode || 'the original agreement')}. That agreement remains in force unchanged; this document adds to it and is priced and signed separately.</div>`
      : docKind === 'care' && care
        ? [
            // Stated first, because the question a client asks on receiving a second
            // contract is whether it changes the first one. It does not.
            (care.complements ?? []).length
              ? `<div class="note accent" style="margin-top:10px;"><strong>This plan stands alongside ${(care.complements ?? []).map(c => esc(c)).join(', ')}.</strong> It is a separate agreement covering ongoing support after delivery. It does not replace, alter or reduce anything agreed there, and nothing in it changes the scope, price or payment schedule of that work. Where the two ever appear to conflict, the original agreement prevails.</div>`
              : `<div class="note accent" style="margin-top:10px;"><strong>This is a separate agreement covering ongoing support.</strong> It does not replace or alter any project agreement already in place.</div>`,
            care.includesInfrastructure
              ? `<div class="note" style="margin-top:10px;">Hosting, the database, domain registration and business email are included in the monthly fee and are not invoiced separately.</div>`
              : '',
          ].join('')
        : ''

  /* The three-option comparison. Included hours and the extra-hour rate are emitted
     from the tier figures rather than kept as editable rows, so the table cannot
     contradict the prices printed directly above it. */
  const tierTable = (() => {
    const t = care?.tiers
    if (!t || t.length !== 3) return ''
    const highlight = care?.selectedTier ?? care?.recommended
    const cls = (k: string) => (k === highlight ? ' class="rec"' : '')
    const head = t.map(x => `<th${cls(x.key)}>${esc(x.name)}</th>`).join('')
    const feeOf = (x: { hourlyRate: number; includedHours: number }) =>
      Math.round(x.hourlyRate * x.includedHours * 100) / 100
    const price = t.map(x => `<td${cls(x.key)}><strong>${fmt(feeOf(x))}</strong><br><span class="muted">per month</span></td>`).join('')
    const hrs = t.map(x => `<td${cls(x.key)}>${x.includedHours} ${x.includedHours === 1 ? 'hour' : 'hours'}</td>`).join('')
    const over = t.map(x => `<td${cls(x.key)}>${fmt(x.overageRate)}/hr</td>`).join('')
    const blurb = t.map(x => `<td${cls(x.key)}><span class="muted">${esc(x.blurb)}</span></td>`).join('')
    const rows = (care?.features ?? [])
      .filter(f => f.label?.trim())
      .map(f => `<tr><th scope="row">${esc(f.label)}</th>${[0, 1, 2].map(i => {
        const on = f.included ? f.included[i] !== false : !!String(f.values[i] ?? '').trim()
        return `<td${cls(t[i].key)}>${on ? esc(String(f.values[i] ?? '').trim() || '\u2713') : '\u2014'}</td>`
      }).join('')}</tr>`)
      .join('')

    return `
      <table class="payment-table tier-table" style="margin-top:10px;">
        <thead><tr><th></th>${head}</tr></thead>
        <tbody>
          <tr><th scope="row">Monthly fee</th>${price}</tr>
          <tr><th scope="row">Included hours per month</th>${hrs}</tr>
          <tr><th scope="row">Hours beyond the included total</th>${over}</tr>
          ${rows}
          <tr><th scope="row"></th>${blurb}</tr>
        </tbody>
      </table>
      <div class="note">${careAgreed
        ? `The highlighted plan is the one agreed, and is the plan this agreement covers.`
        : `The highlighted plan is the one recommended for this engagement. No plan is binding until one is chosen and this document is signed.`} Plans may be changed at any month boundary with ${care?.noticeDays ?? 30} days&rsquo; notice, and no plan carries a minimum term.</div>`
  })()

  // For a care plan the plans and what they include ARE the scope of work, so the
  // comparison sits inside section 3 rather than taking a number of its own — which
  // would have pushed every later section along by one for this kind only.
  const scopeLabel =
    docKind === 'care' && tierTable ? '3. Plans &amp; What They Include'
      : docKind === 'extension' ? '3. Additional Scope of Work'
      : '3. Scope of Work'

  const section5 =
    docKind === 'care' && care
      ? `
    <div class="section">
      <div class="section-label">5. What the Included Hours Cover</div>
      <p class="clause">The included hours cover technical and design work on the delivered systems: content updates, refinements to existing pages and features, maintenance, monitoring, and support. They do not cover new applications, integrations or third-party services, a visual redesign or rebrand, migration to a different platform, or any single piece of work reasonably estimated at more than ${Math.max(1, Math.round(care.includedHours * 2))} hours. Work of that nature is quoted and agreed as a separate scope extension.</p>
      <p class="clause">Time is logged and reported monthly. The rate for additional hours is ${fmt(care.hourlyRate)} per hour.</p>
    </div>`
      : `
    <div class="section">
      <div class="section-label">5. Revision Scope</div>
      ${revisionTiers}
    </div>`

  const printScript = includePrintScript
    ? `<script>window.addEventListener('load', function() { setTimeout(window.print, 300); });</script>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${docTitle} — Engaging UX Design — ${esc(data.contractId)}</title>
<link href="https://fonts.googleapis.com/css2?family=Gabarito:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #f0e4d8; font-family: "Gabarito", sans-serif; color: #1c1008; font-size: 12.5px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  .page { width: 210mm; min-height: 297mm; margin: 32px auto; background: #fff; border: 1px solid #d4bfb0; border-radius: 3px; display: flex; flex-direction: column; position: relative; overflow: hidden; }
  .page:last-of-type { page-break-after: auto; }
  .page-body { flex: 1; padding: 36px 44px 24px; }
  .page-footer { border-top: 1px solid #ecddd4; padding: 10px 44px; display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
  .pf-ref { font-size: 10px; color: #9a7a65; }
  .pf-ref a { color: #8b3a1e; text-decoration: none; }
  .pf-num { font-size: 10px; color: #b8a090; font-family: "Courier New", monospace; }
  .contract-header { background: #1c1008; padding: 26px 44px 22px; display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; border-radius: 3px 3px 0 0; }
  .brand-name { font-size: 15px; font-weight: 700; color: #f7ede2; letter-spacing: 0.01em; line-height: 1.3; }
  .brand-tagline { font-size: 10px; color: #c4a898; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 3px; }
  .header-meta { text-align: right; }
  .contract-type-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: #c4714f; margin-bottom: 4px; }
  .contract-id { font-size: 11px; font-family: "Courier New", monospace; color: #d4bfb0; line-height: 1.6; }
  .contract-title-bar { background: #f7ede2; padding: 16px 44px; border-bottom: 1px solid #d4bfb0; }
  .contract-title { font-size: 14px; font-weight: 700; color: #1c1008; line-height: 1.4; }
  .contract-subtitle { font-size: 11px; color: #8a6a55; margin-top: 3px; }
  .page-header-cont { background: #1c1008; padding: 12px 44px; display: flex; justify-content: space-between; align-items: center; border-radius: 3px 3px 0 0; }
  .phc-brand { font-size: 11px; font-weight: 700; color: #c4a898; letter-spacing: 0.04em; }
  .phc-id { font-size: 10px; color: #7a5a48; font-family: "Courier New", monospace; }
  .section { margin-bottom: 26px; }
  .section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #8b3a1e; padding-bottom: 6px; border-bottom: 1px solid #ecddd4; margin-bottom: 12px; }
  .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .party-block:first-child { padding-right: 24px; border-right: 1px solid #ecddd4; }
  .party-role { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #9a7a65; margin-bottom: 6px; }
  .party-name { font-size: 13px; font-weight: 700; color: #1c1008; margin-bottom: 4px; line-height: 1.3; }
  .party-detail { font-size: 11.5px; color: #5c3a28; line-height: 1.7; }
  .party-detail .muted { color: #9a7a65; font-size: 10.5px; }
  .details-row { display: grid; grid-template-columns: repeat(3,1fr); border: 1px solid #ecddd4; border-radius: 5px; overflow: hidden; }
  .detail-cell { padding: 11px 14px; border-right: 1px solid #ecddd4; }
  .detail-cell:last-child { border-right: none; }
  .detail-cell-label { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #9a7a65; margin-bottom: 3px; }
  .detail-cell-value { font-size: 12.5px; font-weight: 600; color: #1c1008; }
  .detail-cell-value.accent { color: #8b3a1e; }
  .scope-text { font-size: 12.5px; color: #3b2110; line-height: 1.75; }
  .scope-heading { font-size: 12.5px; font-weight: 700; color: #1c1008; margin: 14px 0 6px; }
  .scope-heading:first-child { margin-top: 0; }
  .scope-list { margin: 0 0 10px; padding-left: 18px; list-style: none; }
  .scope-list > li {
    position: relative; font-size: 12.5px; color: #3b2110; line-height: 1.65;
    margin-bottom: 7px; padding-left: 2px; break-inside: avoid; page-break-inside: avoid;
  }
  .scope-list > li::before {
    content: '\\2022'; position: absolute; left: -14px; top: 0;
    color: #8b3a1e; font-weight: 700;
  }
  .scope-sublist { margin: 5px 0 0; padding-left: 16px; list-style: none; }
  .scope-sublist > li {
    position: relative; font-size: 12px; color: #5c3a28; line-height: 1.6; margin-bottom: 3px;
  }
  .scope-sublist > li::before {
    content: '\\2013'; position: absolute; left: -12px; top: 0; color: #a8836a;
  }
  .tier-table td, .tier-table thead th { text-align: center; }
.tier-table tbody th { text-align: left; font-weight: 400; width: 34%; color: #3b2110; padding: 9px 12px; border-bottom: 1px solid #ecddd4; font-size: 12px; }
.tier-table .rec { background: #fdf0e8; }
.tier-table thead th.rec { color: #8b3a1e; }
.tier-table tr:last-child td { font-weight: 400; background: transparent; }
.payment-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
  .payment-table thead tr { background: #f7ede2; }
  .payment-table th { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #8a6a55; padding: 8px 12px; text-align: left; border-bottom: 1px solid #d4bfb0; }
  .payment-table td { padding: 9px 12px; color: #3b2110; border-bottom: 1px solid #f0e4d8; vertical-align: top; }
  .payment-table tr:last-child td { border-bottom: none; font-weight: 700; background: #fdf5ef; color: #1c1008; }
  .payment-table .amount { font-weight: 600; white-space: nowrap; text-align: right; }
  .payment-table .amount.total { color: #8b3a1e; }
  .note { font-size: 11px; color: #5c3a28; margin-top: 9px; line-height: 1.6; padding: 9px 13px; background: #f7ede2; border-left: 2px solid #d4bfb0; border-radius: 0 4px 4px 0; }
  .note.accent { border-left-color: #8b3a1e; }
  .note strong { color: #1c1008; }
  .tier-row { display: flex; align-items: flex-start; gap: 11px; padding: 9px 0; border-bottom: 1px solid #f0e4d8; }
  .tier-row:last-of-type { border-bottom: none; }
  .tier-index { width: 20px; height: 20px; border-radius: 50%; background: #f0e4d8; display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 700; color: #8a6a55; flex-shrink: 0; margin-top: 1px; }
  .tier-index.active { background: #8b3a1e; color: #fff; }
  .tier-content { flex: 1; min-width: 0; }
  .tier-title { font-size: 11.5px; font-weight: 700; color: #1c1008; }
  .tier-desc { font-size: 11px; color: #8a6a55; margin-top: 2px; line-height: 1.5; }
  .tier-badge { margin-left: auto; flex-shrink: 0; font-size: 9.5px; font-weight: 600; padding: 2px 8px; border-radius: 20px; margin-top: 1px; white-space: nowrap; }
  .badge-inc { background: #e6f4ea; color: #2d6e2d; }
  .badge-hr { background: #fff8e1; color: #8a5f00; }
  .badge-add { background: #fce8e0; color: #8b3a1e; }
  .addons-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .addons-table td { padding: 8px 12px; border-bottom: 1px solid #f0e4d8; color: #3b2110; vertical-align: top; }
  .addons-table tr:last-child td { border-bottom: none; }
  .addon-name { font-weight: 600; }
  .addon-note { font-size: 10.5px; color: #9a7a65; font-weight: 400; margin-top: 2px; line-height: 1.5; }
  .addon-price { text-align: right; font-weight: 600; white-space: nowrap; }
  .addon-price.pass { color: #9a7a65; font-weight: 400; font-style: italic; }
  .clause { font-size: 12px; color: #3b2110; line-height: 1.75; margin-bottom: 9px; }
  .clause:last-child { margin-bottom: 0; }
  .clause strong { color: #1c1008; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 8px; break-inside: avoid; page-break-inside: avoid; }
  .sig-block { break-inside: avoid; page-break-inside: avoid; }
  .sig-party { font-size: 10px; font-weight: 700; color: #8a6a55; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 26px; }
  .sig-line { border-bottom: 1px solid #1c1008; margin-bottom: 5px; height: 30px; position: relative; }
  .sig-line.signed { border-bottom-color: #1c1008; }
  .sig-img { position: absolute; left: 4px; bottom: 0; height: 38px; width: auto; max-width: 220px; object-fit: contain; }
  .sig-typed { position: absolute; left: 4px; bottom: 6px; font-family: 'Gabarito', sans-serif; font-size: 12px; color: #1c1008; font-weight: 500; }
  .sig-field-label { font-size: 10px; color: #9a7a65; margin-bottom: 16px; }
  .sig-stamp { font-size: 9px; color: #2d6e2d; font-weight: 600; margin-top: -8px; margin-bottom: 14px; letter-spacing: 0.04em; }
  .audit-trail { margin-top: 18px; border: 1px solid #d4bfb0; border-radius: 5px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
  .audit-trail-head { background: #1c1008; padding: 8px 14px 7px; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .audit-trail-title { font-size: 8.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #c4a898; }
  .audit-trail-sub { font-size: 8px; color: #7a5a48; }
  .audit-trail-row { display: grid; grid-template-columns: 110px 1fr; border-bottom: 1px solid #f0e4d8; }
  .audit-trail-row:last-child { border-bottom: none; }
  .audit-trail-key { padding: 5px 12px; font-size: 8.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9a7a65; background: #fdf5ef; border-right: 1px solid #f0e4d8; display: flex; align-items: center; }
  .audit-trail-val { padding: 5px 12px; font-size: 10px; color: #1c1008; font-family: "Courier New", monospace; word-break: break-all; }
  .audit-trail-val.ref { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #1c1008; }
  .audit-trail-val.prose { font-family: "Gabarito", sans-serif; font-size: 10px; color: #5c3a28; line-height: 1.5; }
  .toolbar { position: absolute; top: 12px; right: 12px; background: #1c1008; color: #f7ede2; padding: 8px 14px; border-radius: 100px; font-size: 11px; cursor: pointer; border: none; font-family: inherit; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10; }
  @media screen {
    .page { width: min(210mm, 100%); }
  }
  @media screen and (max-width: 640px) {
    html, body { font-size: 11.5px; }
    .page { margin: 0; border-left: none; border-right: none; border-radius: 0; }
    .page-body { padding: 18px 16px 14px; }
    .contract-header { padding: 16px 16px 13px; flex-direction: column; gap: 6px; }
    .header-meta { text-align: left; }
    .contract-title-bar { padding: 12px 16px; }
    .page-header-cont { padding: 10px 16px; }
    .page-footer { padding: 8px 16px; flex-wrap: wrap; gap: 4px; }
    .parties-grid { grid-template-columns: 1fr; gap: 0; }
    .party-block:first-child { padding-right: 0; border-right: none; border-bottom: 1px solid #ecddd4; padding-bottom: 14px; margin-bottom: 14px; }
    .details-row { grid-template-columns: 1fr; }
    .detail-cell { border-right: none !important; border-bottom: 1px solid #ecddd4; }
    .detail-cell:last-child { border-bottom: none; }
    .payment-table th, .payment-table td { padding: 7px 8px; }
    .tier-row { gap: 8px; }
    .tier-badge { font-size: 8.5px; padding: 2px 6px; }
    .addons-table td { padding: 6px 8px; }
    .sig-grid { grid-template-columns: 1fr; gap: 24px; }
    .toolbar { top: 8px; right: 8px; padding: 6px 12px; font-size: 10px; }
  }
  @media print {
    html, body { background: #fff; }
    .page {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
      border: none;
      border-radius: 0;
      box-shadow: none;
      break-after: always;
      page-break-after: always;
      ${pdfMode
        ? 'height: auto; min-height: 276.19mm; overflow: visible;'
        : 'height: 276.19mm; max-height: 276.19mm; min-height: 0; overflow: hidden;'}
    }
    .page:last-child {
      break-after: avoid;
      page-break-after: avoid;
    }
    .page-body { flex: none; padding: 10px 14mm 6px; }
    .page-footer { display: none; }
    .page-header-cont { display: none; }
    .contract-header { padding: 14px 14mm 12px; border-radius: 0; }
    .contract-title-bar { padding: 10px 14mm; }
    .toolbar { display: none; }
    .section, .parties-grid, .details-row, .payment-table, .payment-table tr,
    .tier-row, .addons-table, .addons-table tr, .sig-grid, .sig-block, .clause,
    .note { break-inside: avoid; page-break-inside: avoid; }
    .section-label { break-after: avoid; page-break-after: avoid; }
  }
  @page { size: A4 portrait; margin: 6.35mm 6.35mm 14.46mm 6.35mm; }
</style>
</head>
<body>
${includePrintScript ? '<button class="toolbar" onclick="window.print()">Save as PDF / Print</button>' : ''}

<!-- ═══════════ PAGE 1 ═══════════ -->
<div class="page">
  <header class="contract-header">
    <div>
      <div class="brand-name">Engaging UX Design</div>
      <div class="brand-tagline">UX Design &amp; Web Development · Eindhoven, NL</div>
    </div>
    <div class="header-meta">
      <div class="contract-type-label">Service Agreement</div>
      <div class="contract-id">ID: ${esc(data.contractId)}<br>Issued: ${esc(today)}</div>
    </div>
  </header>

  <div class="contract-title-bar">
    <div class="contract-title">${docKind === 'care' ? esc(docTitle) : projectTitle}</div>
    <div class="contract-subtitle">${docKind === 'care'
      ? esc(`${data.client.company || data.client.name} · monthly support`)
      : docKind === 'extension'
        ? esc(`Scope extension of ${extendsCode || 'the original agreement'}`)
        : `${esc(data.phaseLabel)} &middot; ${esc(typeLabel)}`}</div>
  </div>

  <div class="page-body">

    <div class="section">
      <div class="section-label">1. Parties</div>
      <div class="parties-grid">
        <div class="party-block">
          <div class="party-role">Service Provider</div>
          <div class="party-name">Engaging UX Design</div>
          <div class="party-detail">
            Eenmanszaak (sole proprietorship)<br>
            Eindhoven, Netherlands<br>
            info@engaginguxdesign.com<br>
            +31 6 12 92 23 16<br>
            ${ownerRegistrationLine(data.owner)}
          </div>
        </div>
        <div class="party-block">
          <div class="party-role">Client</div>
          <div class="party-name">${esc(clientName)}</div>
          <div class="party-detail">
            ${clientCompanyLine}${clientAddressLine}${c.email ? esc(c.email) + '<br>' : ''}${c.phone ? esc(c.phone) + '<br>' : ''}${clientKvkLine}
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-label">${glanceLabel}</div>
      <div class="details-row">${glanceCells}
      </div>
    </div>

    <div class="section">
      <div class="section-label">${scopeLabel}</div>
      ${renderDeliverables(data.deliverables)}
      ${tierTable}
      ${docKind === 'project' && phaseNote ? `<div class="note" style="margin-top:10px;">${phaseNote}</div>` : ''}
      ${scopeNote}
    </div>

    <div class="section">
      <div class="section-label">${paymentLabel}</div>${paymentBlock}
    </div>

  </div>
  <div class="page-footer">
    <div class="pf-ref">Contract ID: ${esc(data.contractId)} · Engaging UX Design</div>
    <div class="pf-num">Page 1 of 5</div>
  </div>
</div>

<!-- ═══════════ PAGE 2 ═══════════ -->
<div class="page">
  <div class="page-header-cont">
    <div class="phc-brand">Engaging UX Design — ${docTitle}</div>
    <div class="phc-id">${esc(data.contractId)}</div>
  </div>

  <div class="page-body">

${section5}

    <div class="section">
      <div class="section-label">6. Hosting &amp; Add-ons</div>
      <table class="addons-table">
        <tbody>
          ${addonRows.join('\n          ')}
        </tbody>
      </table>
      <div class="note">${addonsNote}</div>
    </div>

    <div class="section">
      <div class="section-label">7. Technical Infrastructure &amp; Third-Party Services</div>
      <p class="clause">To develop and deliver this project, Engaging UX Design uses professional third-party platforms on the client's behalf. A dedicated Google account is created for the client to serve as the root identity connecting all services. The client receives full credentials and ownership of this account.</p>
      <div class="note accent" style="margin-bottom:12px;">
        <strong>Dedicated Google account:</strong> ${googleEmail}<br>
        <span style="font-size:10.5px;color:#8a6a55;">${credentialTiming}</span>${googleExtraNote}
      </div>
      <table class="addons-table">
        <tbody>
          <tr>
            <td class="addon-name">Website hosting<div class="addon-note">Client website hosted via a managed hosting platform. Costs billed at cost.</div></td>
            <td class="addon-price pass">At cost</td>
          </tr>
          <tr>
            <td class="addon-name">App hosting &amp; serverless functions — Vercel<div class="addon-note">Dynamic applications deployed via Vercel, Inc. The client acknowledges and accepts Vercel's Terms of Service and Privacy Policy.</div></td>
            <td class="addon-price pass">At cost</td>
          </tr>
          <tr>
            <td class="addon-name">Data storage &amp; database — Supabase<div class="addon-note">Application data stored via Supabase, Inc. The client acknowledges and accepts Supabase's Terms of Service, Privacy Policy, and Data Processing Agreement.</div></td>
            <td class="addon-price pass">At cost</td>
          </tr>
          <tr>
            <td class="addon-name">Transactional email — Resend<div class="addon-note">Automated notifications sent via Resend, Inc. The client acknowledges and accepts Resend's Terms of Service and Privacy Policy.</div></td>
            <td class="addon-price pass">At cost</td>
          </tr>
          <tr>
            <td class="addon-name">Source code &amp; version control — GitHub<div class="addon-note">All code maintained in a private GitHub repository. Full access transferred to client upon final payment.</div></td>
            <td class="addon-price">Included</td>
          </tr>
        </tbody>
      </table>
      <div class="note">
        <strong>Third-party liability disclaimer (Art. 6:76 BW):</strong> Engaging UX Design accepts no liability for data breaches, outages, or data loss originating from Vercel, Supabase, Resend, GitHub, or any other third-party platform. Each platform operates under its own terms, security standards, and privacy policies. The client is responsible for reading and accepting those terms. Claims arising from third-party platform failures must be directed to the relevant provider. This limitation applies to the fullest extent permitted by Dutch law.
      </div>
    </div>

  </div>
  <div class="page-footer">
    <div class="pf-ref">Contract ID: ${esc(data.contractId)} · Engaging UX Design</div>
    <div class="pf-num">Page 2 of 5</div>
  </div>
</div>

<!-- ═══════════ PAGE 3 ═══════════ -->
<div class="page">
  <div class="page-header-cont">
    <div class="phc-brand">Engaging UX Design — ${docTitle}</div>
    <div class="phc-id">${esc(data.contractId)}</div>
  </div>

  <div class="page-body">

    <div class="section">
      <div class="section-label">8. Client Obligations</div>
      <p class="clause">The client agrees to designate a single point of contact for all project decisions, to provide written feedback within <strong>5 business days</strong> of each deliverable, and to ensure that all supplied materials are free of third-party intellectual property infringement.</p>
      <p class="clause"><strong>Content &amp; asset delivery:</strong> The client must provide all required content, copy, images, and brand assets within <strong>14 business days</strong> of contract signing. Engaging UX Design will send a written reminder 3 business days before this deadline, at which point the client may also agree to proceed with licensed placeholder images sourced from Unsplash.</p>
      <p class="clause">If assets are not delivered and no response is received by the deadline:</p>
      <table class="addons-table" style="margin-bottom:9px;">
        <tbody>
          <tr>
            <td class="addon-name">Client agrees to Unsplash images<div class="addon-note">Engaging UX Design sources appropriate licensed images and proceeds. A separate invoice is issued for sourcing and integration time.</div></td>
          </tr>
          <tr>
            <td class="addon-name">Client does not respond<div class="addon-note">Project is placed on hold. No further work proceeds until assets are received. Timeline is extended by the days of delay, with no penalty to Engaging UX Design. Projects on hold for more than 60 days may be subject to a restart fee (see section 12).</div></td>
          </tr>
        </tbody>
      </table>
      <div class="note">Delays caused by late asset delivery are the full responsibility of the client and do not constitute a breach by Engaging UX Design.</div>
    </div>

    <div class="section">
      <div class="section-label">9. Intellectual Property</div>
      <p class="clause">Upon receipt of full payment, the client receives full ownership of all custom deliverables. Until full payment is received, all deliverables remain the property of Engaging UX Design. Engaging UX Design retains the right to display completed work in its portfolio and marketing materials.</p>
    </div>

    <div class="section">
      <div class="section-label">10. Confidentiality</div>
      <p class="clause">Both parties agree to treat as confidential any non-public business information shared during the project and not to disclose it to third parties without prior written consent, except where required by law.</p>
    </div>

    <div class="section">
      <div class="section-label">11. Limitation of Liability</div>
      <p class="clause">To the maximum extent permitted by Dutch law, Engaging UX Design's total liability shall not exceed the total fees paid for this project. No liability is accepted for indirect, consequential, or incidental loss, including loss of revenue, data, or profits.</p>
    </div>

    <div class="section">
      <div class="section-label">12. Cancellation &amp; Termination</div>
      <p class="clause">Either party may terminate this agreement by written notice of not less than <strong>14 days</strong>. Either party may terminate with immediate effect if the other commits a material breach that remains unremedied 14 days after written notice, or is declared bankrupt, is granted suspension of payments, or ceases to trade.</p>
      <p class="clause">Upon termination, completed work is invoiced at the applicable milestone rate; outstanding invoices remain due; and deliverables transfer only after full payment. Where the client terminates for convenience, the client owes the fees for work performed and costs already committed up to the termination date, less any costs Engaging UX Design demonstrably saves by not completing the work. The parties agree that this settles any claim under article 7:764 BW. Projects inactive for more than <strong>60 days</strong> may be archived and a restart fee applied.</p>
    </div>

  </div>
  <div class="page-footer">
    <div class="pf-ref"><a href="https://engaginguxdesign.com/service-terms-and-conditions">engaginguxdesign.com/service-terms-and-conditions</a> · Contract ID: ${esc(data.contractId)}</div>
    <div class="pf-num">Page 3 of 5</div>
  </div>
</div>

<div class="page">
  <div class="page-header-cont">
    <div class="phc-brand">Engaging UX Design — ${docTitle}</div>
    <div class="phc-id">${esc(data.contractId)}</div>
  </div>

  <div class="page-body">

    <div class="section">
      <div class="section-label">13. Force Majeure</div>
      <p class="clause">Neither party is liable for any failure or delay in performance caused by circumstances beyond its reasonable control and not attributable to its fault within the meaning of <strong>article 6:75 BW</strong>. Such circumstances include, without limitation: the failure, outage, suspension or discontinuation of any third-party platform on which delivery depends, including those named in section 7 and the hosting provider; loss of internet connectivity or power; cyber-attack or malicious third-party interference; changes in law or government measures; and, Engaging UX Design being operated by a single practitioner, the serious illness or incapacity of that practitioner.</p>
      <p class="clause">Obligations affected by force majeure are suspended for its duration and the project timeline is extended accordingly, without either party incurring liability for damages arising from that suspension. Payment obligations for work already performed are not suspended. If a force majeure situation continues for more than <strong>60 consecutive days</strong>, either party may terminate the affected part of this agreement by written notice, with work performed up to that date remaining payable.</p>
    </div>

    <div class="section">
      <div class="section-label">14. Severability</div>
      <p class="clause">If any provision of this agreement is held void, invalid or unenforceable in whole or in part, that provision shall be deemed replaced by a valid and enforceable provision approximating as closely as possible the intent and commercial effect of the original, and the remaining provisions shall continue in full force. The invalidity of one provision does not affect the validity of this agreement as a whole.</p>
    </div>

    <div class="section">
      <div class="section-label">15. Entire Agreement</div>
      <p class="clause">This agreement, together with the Engaging UX Design Service Terms &amp; Project Conditions as published on the date of signing, constitutes the entire agreement between the parties in respect of its subject matter, and supersedes all prior proposals, quotations, correspondence, discussions and understandings, whether written or oral. Where this agreement and those Service Terms conflict, this agreement prevails.</p>
      <p class="clause">Amendments are valid only when agreed in writing by both parties. A scope extension or superseding agreement issued through the Engaging UX Design contract system and accepted by the client in the same manner as this agreement satisfies that requirement. The applicability of any general terms and conditions of the client is expressly rejected, whether or not referred to in the client&rsquo;s own documents.</p>
    </div>

  </div>
  <div class="page-footer">
    <div class="pf-ref"><a href="https://engaginguxdesign.com/service-terms-and-conditions">engaginguxdesign.com/service-terms-and-conditions</a> · Contract ID: ${esc(data.contractId)}</div>
    <div class="pf-num">Page 4 of 5</div>
  </div>
</div>

<div class="page">
  <div class="page-header-cont">
    <div class="phc-brand">Engaging UX Design — ${docTitle}</div>
    <div class="phc-id">${esc(data.contractId)}</div>
  </div>

  <div class="page-body">

    <div class="section">
      <div class="section-label">16. Governing Law</div>
      <p class="clause">This agreement is governed by Dutch law. Disputes will first be addressed by direct negotiation. If unresolved within 30 days, disputes shall be submitted to the competent court in the district of <strong>Oost-Brabant</strong>, the Netherlands. This contract is supplemented by the Engaging UX Design Service Terms &amp; Project Conditions: <a href="https://engaginguxdesign.com/service-terms-and-conditions" style="color:#8b3a1e;">engaginguxdesign.com/service-terms-and-conditions</a></p>
    </div>

    <div class="section" style="margin-top:32px;">
      <div class="section-label">Signatures</div>
      <div class="sig-grid">
        <div class="sig-block">
          <div class="sig-party">Engaging UX Design</div>
          <div class="sig-line signed"><img class="sig-img" src="${sigBase64}" alt="Cess Garcia - de Laat signature" /></div>
          <div class="sig-stamp">✓ Signed electronically</div>
          <div class="sig-line signed"><span class="sig-typed">Cess Garcia - de Laat — Founder</span></div>
          <div class="sig-field-label">Name &amp; title</div>
          <div class="sig-line signed"><span class="sig-typed">${esc(today)}</span></div>
          <div class="sig-field-label">Date</div>
        </div>
        <div class="sig-block">
          <div class="sig-party">${esc(clientName)}</div>
          <div class="sig-line${clientSignedName ? ' signed' : ''}">${clientSignedName ? `<span class="sig-typed">${esc(clientSignedName)}</span>` : ''}</div>
          ${clientSignedName ? '<div class="sig-stamp">✓ Signed electronically</div>' : ''}
          <div class="sig-field-label">CLIENT SIGNATURE</div>
          <div class="sig-line${clientSignedName ? ' signed' : ''}">${clientSignedName ? `<span class="sig-typed">${esc(clientSignedName)}</span>` : ''}</div>
          <div class="sig-field-label">Name &amp; title</div>
          <div class="sig-line${clientSignedAt ? ' signed' : ''}">${clientSignedAt ? `<span class="sig-typed">${esc(clientSignedAt)}</span>` : ''}</div>
          <div class="sig-field-label">DATE SIGNED</div>
        </div>
      </div>
      <p class="clause" style="margin-top:14px;font-size:10.5px;color:#8a6a55;line-height:1.55;">
        This document is signed electronically by Engaging UX Design in accordance with EU Regulation 910/2014 (eIDAS) on electronic signatures. By countersigning above (or by replying in writing to confirm acceptance), the Client agrees to all terms set out in this Service Agreement.
      </p>

      ${clientSignedName && signingReference ? `
      <div class="audit-trail">
        <div class="audit-trail-head">
          <span class="audit-trail-title">Electronic Signature Audit Trail</span>
          <span class="audit-trail-sub">EU Regulation 910/2014 (eIDAS) · Simple Electronic Signature (SES)</span>
        </div>
        <div class="audit-trail-row">
          <div class="audit-trail-key">Reference</div>
          <div class="audit-trail-val ref">${esc(signingReference)}</div>
        </div>
        <div class="audit-trail-row">
          <div class="audit-trail-key">Document</div>
          <div class="audit-trail-val">${esc(data.contractId)}</div>
        </div>
        <div class="audit-trail-row">
          <div class="audit-trail-key">Signer</div>
          <div class="audit-trail-val">${esc(clientSignedName)}</div>
        </div>
        <div class="audit-trail-row">
          <div class="audit-trail-key">Timestamp</div>
          <div class="audit-trail-val">${esc(signerTimestampIso)}</div>
        </div>
        <div class="audit-trail-row">
          <div class="audit-trail-key">IP Address</div>
          <div class="audit-trail-val">${esc(signerIp || 'not recorded')}</div>
        </div>
        <div class="audit-trail-row">
          <div class="audit-trail-key">Method</div>
          <div class="audit-trail-val prose">Signer confirmed intent by typing their full legal name and checking the consent checkbox. Constitutes a legally binding Simple Electronic Signature under EU Regulation 910/2014 (eIDAS).</div>
        </div>
      </div>` : ''}
    </div>

  </div>
  <div class="page-footer">
    <div class="pf-ref"><a href="https://engaginguxdesign.com/service-terms-and-conditions">engaginguxdesign.com/service-terms-and-conditions</a> · Contract ID: ${esc(data.contractId)}</div>
    <div class="pf-num">Page 5 of 5</div>
  </div>
</div>

${printScript}
<script>
  function reportHeight() {
    var h = document.documentElement.scrollHeight;
    if (window.parent !== window) window.parent.postMessage({ iframeHeight: h }, '*');
  }
  window.addEventListener('load', reportHeight);
  window.addEventListener('resize', reportHeight);
</script>
</body>
</html>`
}

// fmtDate exported for use in ContractWizard preview component
export { fmtLong as fmtDate }
