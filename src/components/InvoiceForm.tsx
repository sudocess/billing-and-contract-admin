'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SendModal from './SendModal'

interface ClientSuggestion {
  name: string
  company?: string
  email: string
  phone?: string
  kvk?: string
  vat?: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
}

interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
}

interface FormData {
  clientName: string
  clientEmail: string
  clientContact: string
  clientPhone: string
  clientAddress: string
  clientCity: string
  clientCountry: string
  clientVat: string
  clientKvk: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  reference: string
  paymentTerms: string
  currency: string
  language: string
  internalNotes: string
  iban: string
  bic: string
  bankName: string
  accountHolder: string
  paymentRef: string
  ownVat: string
  ownKvk: string
  lateFee: string
  vatTreatment: string
  notes: string
}

interface InvoiceFormProps {
  initialData?: Record<string, unknown> & { items?: Record<string, unknown>[] }
  invoiceId?: string
}

const PRESETS = [
  { label: 'Phase 1 (30%)', desc: 'Phase 1 — Strategy & Structure (30%)', qty: 1, unit: 0, vat: 21 },
  { label: 'Phase 2 (40%)', desc: 'Phase 2 — Design & Prototype (40%)', qty: 1, unit: 0, vat: 21 },
  { label: 'Phase 3 (30%)', desc: 'Phase 3 — Build & Launch (30%)', qty: 1, unit: 0, vat: 21 },
  { label: 'Initiation Fee', desc: 'Project Initiation Fee', qty: 1, unit: 50, vat: 21 },
  { label: 'SEO Setup', desc: 'Foundational SEO Setup', qty: 1, unit: 0, vat: 21 },
  { label: 'Logo Design', desc: 'Logo Design / Creation', qty: 1, unit: 200, vat: 21 },
  { label: 'Hosting Setup', desc: 'Domain & Hosting Setup', qty: 1, unit: 50, vat: 21 },
  { label: 'Maintenance', desc: 'Monthly Maintenance & Support', qty: 1, unit: 0, vat: 21 },
]

function defaultFormData(): FormData {
  const today = new Date()
  const due = new Date()
  due.setDate(due.getDate() + 30)
  return {
    clientName: '', clientEmail: '', clientContact: '', clientPhone: '',
    clientAddress: '', clientCity: '', clientCountry: 'Netherlands',
    clientVat: '', clientKvk: '',
    invoiceNumber: `${today.getFullYear()}-001`,
    invoiceDate: today.toISOString().split('T')[0],
    dueDate: due.toISOString().split('T')[0],
    reference: '', paymentTerms: '30 days', currency: '€', language: 'en',
    internalNotes: '',
    iban: '', bic: '', bankName: '', accountHolder: 'Engaging UX Design', paymentRef: '',
    ownVat: '', ownKvk: '', lateFee: '1% per month', vatTreatment: 'standard', notes: '',
  }
}

function mapInitialData(data: Record<string, unknown>): FormData {
  const d = data as Record<string, string | number | Date | null>
  const fmtDate = (v: unknown) => {
    if (!v) return ''
    const dt = v instanceof Date ? v : new Date(String(v))
    return dt.toISOString().split('T')[0]
  }
  return {
    clientName: String(d.clientName || ''),
    clientEmail: String(d.clientEmail || ''),
    clientContact: String(d.clientContact || ''),
    clientPhone: String(d.clientPhone || ''),
    clientAddress: String(d.clientAddress || ''),
    clientCity: String(d.clientCity || ''),
    clientCountry: String(d.clientCountry || 'Netherlands'),
    clientVat: String(d.clientVat || ''),
    clientKvk: String(d.clientKvk || ''),
    invoiceNumber: String(d.invoiceNumber || ''),
    invoiceDate: fmtDate(d.invoiceDate),
    dueDate: fmtDate(d.dueDate),
    reference: String(d.reference || ''),
    paymentTerms: String(d.paymentTerms || '30 days'),
    currency: String(d.currency || '€'),
    language: String(d.language || 'en'),
    internalNotes: String(d.internalNotes || ''),
    iban: String(d.iban || ''),
    bic: String(d.bic || ''),
    bankName: String(d.bankName || ''),
    accountHolder: String(d.accountHolder || 'Engaging UX Design'),
    paymentRef: String(d.paymentRef || ''),
    ownVat: String(d.ownVat || ''),
    ownKvk: String(d.ownKvk || ''),
    lateFee: String(d.lateFee || '1% per month'),
    vatTreatment: String(d.vatTreatment || 'standard'),
    notes: String(d.notes || ''),
  }
}

let counter = 0
function newId() { return `item-${++counter}-${Date.now()}` }

export default function InvoiceForm({ initialData, invoiceId }: InvoiceFormProps) {
  const router = useRouter()
  const isEdit = !!invoiceId

  const [form, setForm] = useState<FormData>(() =>
    initialData ? mapInitialData(initialData) : defaultFormData()
  )

  const [items, setItems] = useState<LineItem[]>(() => {
    if (initialData?.items?.length) {
      return initialData.items.map((it: Record<string, unknown>) => ({
        id: newId(),
        description: String(it.description || ''),
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        vatRate: Number(it.vatRate) || 21,
      }))
    }
    return [{ id: newId(), description: '', quantity: 1, unitPrice: 0, vatRate: 21 }]
  })

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [sendModal, setSendModal] = useState(false)
  const [savedId, setSavedId] = useState(invoiceId || '')

  const [clients, setClients] = useState<ClientSuggestion[]>([])
  const [clientSearch, setClientSearch] = useState(form.clientName)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients).catch(() => {})
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients
    const q = clientSearch.toLowerCase()
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q))
    )
  }, [clients, clientSearch])

  const selectClient = useCallback((c: ClientSuggestion) => {
    const billingName = c.company || c.name
    const contactName = c.company ? c.name : ''
    setForm(prev => ({
      ...prev,
      clientName: billingName,
      clientContact: contactName,
      clientEmail: c.email || prev.clientEmail,
      clientPhone: c.phone || prev.clientPhone,
      clientAddress: c.address || prev.clientAddress,
      clientCity: [c.postalCode, c.city].filter(Boolean).join(' ') || prev.clientCity,
      clientCountry: c.country || prev.clientCountry,
      clientVat: c.vat || prev.clientVat,
      clientKvk: c.kvk || prev.clientKvk,
    }))
    setClientSearch(billingName)
    setShowClientDropdown(false)
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }, [])

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  // Line item handlers
  const addItem = useCallback(() => {
    setItems(prev => [...prev, { id: newId(), description: '', quantity: 1, unitPrice: 0, vatRate: 21 }])
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const updateItem = useCallback((id: string, field: keyof LineItem, value: string | number) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i
      if (field === 'description') return { ...i, description: String(value) }
      return { ...i, [field]: Number(value) || 0 }
    }))
  }, [])

  const addPreset = useCallback((desc: string, qty: number, unit: number, vat: number) => {
    setItems(prev => [...prev, { id: newId(), description: desc, quantity: qty, unitPrice: unit, vatRate: vat }])
  }, [])

  // Totals
  const totals = useMemo(() => {
    let subtotal = 0
    const vatMap: Record<number, number> = {}
    items.forEach(item => {
      const net = item.quantity * item.unitPrice
      subtotal += net
      vatMap[item.vatRate] = (vatMap[item.vatRate] || 0) + net * (item.vatRate / 100)
    })
    const vatTotal = Object.values(vatMap).reduce((a, b) => a + b, 0)
    return { subtotal, vatTotal, grandTotal: subtotal + vatTotal, vatMap }
  }, [items])

  const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  // Save
  const handleSave = async (action: 'draft' | 'preview' | 'send') => {
    if (!form.clientName || !form.clientEmail || !form.invoiceNumber) {
      showToast('Please fill in required fields (client name, email, invoice number)')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        items: items.map(({ id: _id, ...rest }) => ({
          ...rest,
          amount: rest.quantity * rest.unitPrice,
        })),
        subtotal: totals.subtotal,
        vatTotal: totals.vatTotal,
        grandTotal: totals.grandTotal,
      }

      let id = savedId
      if (isEdit && id) {
        await fetch(`/api/invoices/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        id = data.id
        setSavedId(id)
      }

      if (action === 'preview') {
        router.push(`/invoices/${id}`)
      } else if (action === 'send') {
        setSendModal(true)
      } else {
        showToast('Draft saved successfully')
      }
    } catch {
      showToast('Error saving invoice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* EU Notice */}
      <div className="bg-info-bg border border-info/15 rounded-lg px-4 py-2.5 flex items-center gap-2.5 mb-5 text-[0.82rem] text-info">
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        EU compliant invoicing: VAT number, invoice number, issue date, due date, and itemised VAT are required fields under EU Directive 2006/112/EC.
      </div>

      {/* ── CLIENT DETAILS ── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            Client Details
          </div>
        </div>
        <div className="panel-body">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 relative" ref={clientDropdownRef}>
              <label>Client / Company Name *</label>
              <input
                type="text"
                placeholder="Acme BV"
                value={showClientDropdown ? clientSearch : form.clientName}
                onFocus={() => {
                  setClientSearch(form.clientName)
                  setShowClientDropdown(true)
                }}
                onChange={e => {
                  setClientSearch(e.target.value)
                  updateField('clientName', e.target.value)
                  setShowClientDropdown(true)
                }}
              />
              {showClientDropdown && filteredClients.length > 0 && (
                <ul className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-brown-subtle/30 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredClients.map((c, i) => (
                    <li
                      key={i}
                      className="px-3 py-2 cursor-pointer hover:bg-accent/10 flex flex-col"
                      onMouseDown={e => { e.preventDefault(); selectClient(c) }}
                    >
                      <span className="text-sm font-medium text-brown-primary">{c.company || c.name}</span>
                      {c.company && <span className="text-xs text-brown-subtle">{c.name}</span>}
                      {c.email && <span className="text-xs text-brown-subtle">{c.email}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Contact Name</label>
              <input type="text" placeholder="Jan de Vries" value={form.clientContact} onChange={e => updateField('clientContact', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Email Address *</label>
              <input type="email" placeholder="jan@acmebv.nl" value={form.clientEmail} onChange={e => updateField('clientEmail', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Phone</label>
              <input type="tel" placeholder="+31 6 00 000 000" value={form.clientPhone} onChange={e => updateField('clientPhone', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label>Street Address</label>
              <input type="text" placeholder="Keizersgracht 123" value={form.clientAddress} onChange={e => updateField('clientAddress', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Postcode & City</label>
              <input type="text" placeholder="1015 CJ Amsterdam" value={form.clientCity} onChange={e => updateField('clientCity', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Country</label>
              <select value={form.clientCountry} onChange={e => updateField('clientCountry', e.target.value)}>
                <option value="Netherlands">Netherlands</option>
                <option value="Belgium">Belgium</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="Spain">Spain</option>
                <option value="Italy">Italy</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Other EU">Other EU</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Client VAT Number <span className="text-brown-subtle font-normal">(if applicable)</span></label>
              <input type="text" placeholder="NL000000000B01" value={form.clientVat} onChange={e => updateField('clientVat', e.target.value)} />
              <span className="text-xs text-brown-subtle">Required for B2B EU transactions (reverse charge)</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label>KvK / Chamber of Commerce No.</label>
              <input type="text" placeholder="12345678" value={form.clientKvk} onChange={e => updateField('clientKvk', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* ── INVOICE DETAILS ── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            Invoice Details
          </div>
        </div>
        <div className="panel-body">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label>Invoice Number *</label>
              <input type="text" value={form.invoiceNumber} onChange={e => updateField('invoiceNumber', e.target.value)} />
              <span className="text-xs text-brown-subtle">Required — must be sequential (EU law)</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Issue Date *</label>
              <input type="date" value={form.invoiceDate} onChange={e => updateField('invoiceDate', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Due Date *</label>
              <input type="date" value={form.dueDate} onChange={e => updateField('dueDate', e.target.value)} />
              <span className="text-xs text-brown-subtle">Standard: 14 or 30 days (EU norm)</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Project / Reference</label>
              <input type="text" placeholder="Website Redesign — Phase 1" value={form.reference} onChange={e => updateField('reference', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Payment Terms</label>
              <select value={form.paymentTerms} onChange={e => updateField('paymentTerms', e.target.value)}>
                <option value="14 days">14 days from invoice date</option>
                <option value="30 days">30 days from invoice date</option>
                <option value="60 days">60 days from invoice date</option>
                <option value="Upon receipt">Due upon receipt</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Currency</label>
              <select value={form.currency} onChange={e => updateField('currency', e.target.value)}>
                <option value="€">EUR (€)</option>
                <option value="£">GBP (£)</option>
                <option value="$">USD ($)</option>
              </select>
            </div>
          </div>
          <hr className="my-5 border-brown-dark/10" />
          <div className="flex flex-col gap-1.5">
            <label>Internal Notes <span className="text-brown-subtle font-normal">(not shown on invoice)</span></label>
            <textarea rows={2} placeholder="e.g. Client requested split payment..." value={form.internalNotes} onChange={e => updateField('internalNotes', e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── LINE ITEMS ── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            Line Items
          </div>
          <button className="btn btn-secondary btn-sm" onClick={addItem}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Item
          </button>
        </div>

        <div className="p-0">
          <table className="line-items">
            <thead>
              <tr>
                <th style={{ width: '38%' }}>Description</th>
                <th style={{ width: '10%' }}>Qty</th>
                <th style={{ width: '14%' }}>Unit Price</th>
                <th style={{ width: '12%' }}>VAT %</th>
                <th style={{ width: '14%' }}>Amount</th>
                <th style={{ width: '6%' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td><input type="text" placeholder="Service description..." value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} /></td>
                  <td><input type="number" min="0" step="0.5" style={{ textAlign: 'center' }} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} /></td>
                  <td><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', e.target.value)} /></td>
                  <td>
                    <select value={item.vatRate} onChange={e => updateItem(item.id, 'vatRate', e.target.value)}>
                      <option value={21}>21%</option>
                      <option value={9}>9%</option>
                      <option value={0}>0%</option>
                    </select>
                  </td>
                  <td>
                    <span className="font-heading font-bold text-[0.9rem] text-brown-dark tabular-nums">
                      {form.currency}{fmt(item.quantity * item.unitPrice)}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => removeItem(item.id)} className="p-1 rounded text-brown-subtle hover:text-danger hover:bg-danger-bg transition-colors cursor-pointer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Quick Add */}
          <div className="px-4 py-3.5 border-t border-brown-dark/10 bg-brown-pale">
            <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-2">Quick Add</div>
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map(p => (
                <button key={p.label} className="btn btn-ghost btn-sm" onClick={() => addPreset(p.desc, p.qty, p.unit, p.vat)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="panel-body pt-0">
          <div className="mt-4 pt-4 border-t-2 border-brown-dark/10 flex justify-end">
            <div className="min-w-[300px]">
              <div className="flex justify-between py-1.5 text-[0.9rem] text-brown-muted">
                <span>Subtotal (excl. VAT)</span>
                <span className="font-bold text-brown-dark tabular-nums font-heading">{form.currency}{fmt(totals.subtotal)}</span>
              </div>
              {Object.entries(totals.vatMap).map(([rate, amount]) => (
                <div key={rate} className="flex justify-between py-1.5 text-[0.9rem] text-brown-muted">
                  <span>VAT {rate}%</span>
                  <span className="font-bold text-brown-dark tabular-nums font-heading">{form.currency}{fmt(amount)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2.5 mt-1.5 border-t-2 border-brown-dark/10 font-heading text-lg font-black text-brown-dark">
                <span>Total Due</span>
                <span className="tabular-nums">{form.currency}{fmt(totals.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PAYMENT INFO ── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
            Payment Information
          </div>
        </div>
        <div className="panel-body">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label>Bank Account (IBAN) *</label>
              <input type="text" placeholder="NL00 BANK 0000 0000 00" value={form.iban} onChange={e => updateField('iban', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label>BIC / SWIFT</label>
              <input type="text" placeholder="INGBNL2A" value={form.bic} onChange={e => updateField('bic', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Bank Name</label>
              <input type="text" placeholder="ING Bank" value={form.bankName} onChange={e => updateField('bankName', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label>Account Holder Name</label>
              <input type="text" value={form.accountHolder} onChange={e => updateField('accountHolder', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label>Payment Reference / Description</label>
              <input type="text" placeholder="Invoice 2026-001 — Acme BV" value={form.paymentRef} onChange={e => updateField('paymentRef', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* ── EU COMPLIANCE ── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            EU Compliance Fields
          </div>
          <span className="flex items-center gap-1.5 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0"></span>
            Required by EU Directive 2006/112/EC
          </span>
        </div>
        <div className="panel-body">
          <div className="grid grid-cols-2 gap-4">
            {/* Own VAT */}
            <div className="flex items-start gap-2.5 p-3.5 bg-brown-pale rounded-lg border border-brown-dark/10">
              <div className="w-8 h-8 rounded-lg bg-brown-mid flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-brown-pale" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /></svg>
              </div>
              <div className="flex-1">
                <div className="text-[0.78rem] font-bold text-brown-dark mb-1">Your VAT Number *</div>
                <input type="text" placeholder="NL000000000B01" value={form.ownVat} onChange={e => updateField('ownVat', e.target.value)} />
                <span className="text-xs text-brown-subtle mt-1 block">Mandatory on every invoice (EU law)</span>
              </div>
            </div>
            {/* Own KvK */}
            <div className="flex items-start gap-2.5 p-3.5 bg-brown-pale rounded-lg border border-brown-dark/10">
              <div className="w-8 h-8 rounded-lg bg-brown-mid flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-brown-pale" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
              </div>
              <div className="flex-1">
                <div className="text-[0.78rem] font-bold text-brown-dark mb-1">Your KvK Number</div>
                <input type="text" placeholder="KvK 12345678" value={form.ownKvk} onChange={e => updateField('ownKvk', e.target.value)} />
                <span className="text-xs text-brown-subtle mt-1 block">Required for Netherlands registration</span>
              </div>
            </div>
            {/* Late Fee */}
            <div className="flex items-start gap-2.5 p-3.5 bg-brown-pale rounded-lg border border-brown-dark/10">
              <div className="w-8 h-8 rounded-lg bg-brown-mid flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-brown-pale" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              <div className="flex-1">
                <div className="text-[0.78rem] font-bold text-brown-dark mb-1">Late Payment Notice</div>
                <select value={form.lateFee} onChange={e => updateField('lateFee', e.target.value)}>
                  <option value="1% per month">1% statutory interest per month (NL standard)</option>
                  <option value="8% per annum">8% per annum (EU Late Payment Directive)</option>
                  <option value="none">No late fee stated</option>
                </select>
                <span className="text-xs text-brown-subtle mt-1 block">EU Late Payment Directive 2011/7/EU</span>
              </div>
            </div>
            {/* VAT Treatment */}
            <div className="flex items-start gap-2.5 p-3.5 bg-brown-pale rounded-lg border border-brown-dark/10">
              <div className="w-8 h-8 rounded-lg bg-brown-mid flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-brown-pale" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <div className="flex-1">
                <div className="text-[0.78rem] font-bold text-brown-dark mb-1">VAT Treatment</div>
                <select value={form.vatTreatment} onChange={e => updateField('vatTreatment', e.target.value)}>
                  <option value="standard">Standard VAT — Dutch resident client</option>
                  <option value="reverse">Reverse Charge — EU B2B client (Article 196)</option>
                  <option value="exempt">VAT Exempt (KOR / kleine ondernemersregeling)</option>
                  <option value="export">Outside EU — No VAT (export)</option>
                </select>
                <span className="text-xs text-brown-subtle mt-1 block">Auto-applies correct VAT note on invoice</span>
              </div>
            </div>
          </div>

          <hr className="my-5 border-brown-dark/10" />

          <div className="flex flex-col gap-1.5">
            <label>Additional Invoice Notes <span className="text-brown-subtle font-normal">(shown on invoice)</span></label>
            <textarea rows={3} placeholder="e.g. Thank you for your business. Please reference invoice number when making payment." value={form.notes} onChange={e => updateField('notes', e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div className="flex gap-3 justify-end mt-2 pb-8">
        <button className="btn btn-ghost" disabled={saving} onClick={() => handleSave('draft')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button className="btn btn-secondary" disabled={saving} onClick={() => handleSave('preview')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          Preview Invoice
        </button>
        <button className="btn btn-primary btn-lg" disabled={saving} onClick={() => handleSave('send')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          Send Invoice
        </button>
      </div>

      {/* ── SEND MODAL ── */}
      {sendModal && savedId && (
        <SendModal
          invoiceId={savedId}
          clientEmail={form.clientEmail}
          clientName={form.clientName}
          invoiceNumber={form.invoiceNumber}
          language={form.language}
          onClose={() => setSendModal(false)}
          onSent={() => router.push(`/invoices/${savedId}`)}
        />
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-brown-mid text-brown-pale px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-2.5 z-[300] toast-enter font-semibold text-sm">
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          {toast}
        </div>
      )}
    </>
  )
}
