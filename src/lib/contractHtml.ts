// Shared contract HTML template — runs server-side (DocuSign PDF) and client-side (print window).
// Keep this file free of browser-only APIs.

import type { ContractType, PhaseKey } from './contracts'

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
  sigBase64?: string      // pre-fetched/read base64 data URL for the signature image
  includePrintScript?: boolean  // add window.print() auto-print script (browser only)
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const fmt = (v: number) => '€' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function fmtLong(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

export function generateContractHtml(data: PreviewData, opts: GenerateHtmlOptions = {}): string {
  const { sigBase64 = '', includePrintScript = false } = opts

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
  } else if (data.phase === 'phase3') {
    phaseNote = '<strong>Phase 3 — Build &amp; Launch</strong> covers: full front-end and back-end development, integration of all dynamic applications, cross-browser and device testing, deployment to the live hosting environment, and final handover of all credentials and source code.'
  }

  // ── Section 4: payment rows ──────────────────────────────────────────
  let paymentRows = ''
  let paymentNote = ''
  if (isCustom) {
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
    paymentNote = data.pricing.initFee > 0 ? `The project initiation fee (${fmt(data.pricing.initFee)}) is non-refundable.` : ''
  } else {
    const p1Net = data.pricing.p1 - data.pricing.initFee
    paymentRows = `
      <tr><td>Phase 1 — 30%</td><td>Due before Phase 1 work begins</td><td class="amount">${fmt(p1Net)}</td></tr>
      <tr><td>Phase 2 — 40%</td><td>Due after written client approval of Phase 2</td><td class="amount">${fmt(data.pricing.p2)}</td></tr>
      <tr><td>Phase 3 — 30%</td><td>Due before final delivery / publishing</td><td class="amount">${fmt(data.pricing.p3)}</td></tr>`
    paymentNote = data.pricing.initFee > 0 ? `The project initiation fee (${fmt(data.pricing.initFee)}) is non-refundable.` : ''
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
    const total = data.hosting.domainPrice + data.hosting.hostingPrice
    addonRows.push(`<tr><td class="addon-name">Domain + Hosting via Hostinger<div class="addon-note">Client provided with both domain and managed hosting.</div></td><td class="addon-price">${fmt(total)}/yr</td></tr>`)
  } else if (data.hosting.mode === 'hosting') {
    addonRows.push(`<tr><td class="addon-name">Hostinger hosting<div class="addon-note">Client provides own domain. Managed hosting passed through at cost.</div></td><td class="addon-price">${fmt(data.hosting.hostingPrice)}/yr</td></tr>`)
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

  const printScript = includePrintScript
    ? `<script>window.addEventListener('load', function() { setTimeout(window.print, 300); });</script>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Service Agreement — Engaging UX Design — ${esc(data.contractId)}</title>
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
  .toolbar { position: absolute; top: 12px; right: 12px; background: #1c1008; color: #f7ede2; padding: 8px 14px; border-radius: 100px; font-size: 11px; cursor: pointer; border: none; font-family: inherit; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10; }
  @media print {
    html, body { background: #fff; }
    .page {
      display: block;
      width: 100%;
      height: 276.19mm;
      min-height: 0;
      max-height: 276.19mm;
      margin: 0;
      padding: 0;
      border: none;
      border-radius: 0;
      box-shadow: none;
      overflow: hidden;
      break-after: always;
      page-break-after: always;
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
    <div class="contract-title">${projectTitle}</div>
    <div class="contract-subtitle">${esc(data.phaseLabel)} · ${esc(typeLabel)}</div>
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
            +31 6 17 60 24 41<br>
            <span class="muted">KvK registered · VAT-registered (NL)</span>
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
      <div class="section-label">2. Project at a Glance</div>
      <div class="details-row">
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
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-label">3. Scope of Work</div>
      <p class="scope-text">${data.deliverables ? esc(data.deliverables) : '[Deliverables to be specified.]'}</p>
      ${phaseNote ? `<div class="note" style="margin-top:10px;">${phaseNote}</div>` : ''}
    </div>

    <div class="section">
      <div class="section-label">4. Payment Schedule</div>
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
        Invoices are payable within 30 days of invoice date. Late payments are subject to statutory interest of 1% per month under Dutch law (Handelsrentewet) and a €25 administrative fee per reminder issued after the first. Engaging UX Design reserves the right to suspend work where payment is overdue by more than 14 days.${paymentNote ? ' ' + paymentNote : ''}
      </div>
    </div>

  </div>
  <div class="page-footer">
    <div class="pf-ref">Contract ID: ${esc(data.contractId)} · Engaging UX Design</div>
    <div class="pf-num">Page 1 of 3</div>
  </div>
</div>

<!-- ═══════════ PAGE 2 ═══════════ -->
<div class="page">
  <div class="page-header-cont">
    <div class="phc-brand">Engaging UX Design — Service Agreement</div>
    <div class="phc-id">${esc(data.contractId)}</div>
  </div>

  <div class="page-body">

    <div class="section">
      <div class="section-label">5. Revision Scope</div>
      ${revisionTiers}
    </div>

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
    <div class="pf-num">Page 2 of 3</div>
  </div>
</div>

<!-- ═══════════ PAGE 3 ═══════════ -->
<div class="page">
  <div class="page-header-cont">
    <div class="phc-brand">Engaging UX Design — Service Agreement</div>
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
      <p class="clause">Either party may terminate with written notice. Upon termination, completed work is invoiced at the applicable milestone rate; outstanding invoices remain due; and deliverables transfer only after full payment. Projects inactive for more than <strong>60 days</strong> may be archived and a restart fee applied.</p>
    </div>

    <div class="section">
      <div class="section-label">13. Governing Law</div>
      <p class="clause">This agreement is governed by Dutch law. Disputes will first be addressed by direct negotiation. If unresolved within 30 days, disputes shall be submitted to the competent court in the district of <strong>Oost-Brabant</strong>, the Netherlands. This contract is supplemented by the Engaging UX Design Service Terms &amp; Project Conditions: <a href="https://engaginguxdesign.com/service-terms-and-conditions" style="color:#8b3a1e;">engaginguxdesign.com/service-terms-and-conditions</a></p>
    </div>

    <div class="section" style="margin-top:32px;">
      <div class="section-label">Signatures</div>
      <div class="sig-grid">
        <div class="sig-block">
          <div class="sig-party">Engaging UX Design</div>
          <div class="sig-line signed"><img class="sig-img" src="${sigBase64}" alt="Cess de Laat signature" /></div>
          <div class="sig-stamp">✓ Signed electronically</div>
          <div class="sig-line signed"><span class="sig-typed">Cess de Laat — Founder</span></div>
          <div class="sig-field-label">Name &amp; title</div>
          <div class="sig-line signed"><span class="sig-typed">${esc(today)}</span></div>
          <div class="sig-field-label">Date</div>
        </div>
        <div class="sig-block">
          <div class="sig-party">${esc(clientName)}</div>
          <div class="sig-line"></div>
          <div class="sig-field-label">CLIENT SIGNATURE</div>
          <div class="sig-line"></div>
          <div class="sig-field-label">Name &amp; title</div>
          <div class="sig-line"></div>
          <div class="sig-field-label">DATE SIGNED</div>
        </div>
      </div>
      <p class="clause" style="margin-top:14px;font-size:10.5px;color:#8a6a55;line-height:1.55;">
        This document is signed electronically by Engaging UX Design in accordance with EU Regulation 910/2014 (eIDAS) on electronic signatures. By countersigning above (or by replying in writing to confirm acceptance), the Client agrees to all terms set out in this Service Agreement.
      </p>
    </div>

  </div>
  <div class="page-footer">
    <div class="pf-ref"><a href="https://engaginguxdesign.com/service-terms-and-conditions">engaginguxdesign.com/service-terms-and-conditions</a> · Contract ID: ${esc(data.contractId)}</div>
    <div class="pf-num">Page 3 of 3</div>
  </div>
</div>

${printScript}
</body>
</html>`
}

// fmtDate exported for use in ContractWizard preview component
export { fmtLong as fmtDate }
