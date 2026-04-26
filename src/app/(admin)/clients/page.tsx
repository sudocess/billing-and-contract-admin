'use client'

import Link from 'next/link'
import { useState } from 'react'
import { KNOWN_CLIENTS, upsertKnownClient, type KnownClient } from '@/lib/contracts'

type DraftClient = {
  firstName: string
  lastName: string
  email: string
  company: string
  phone: string
  kvk: string
  vat: string
  address: string
  postalCode: string
  city: string
  country: string
  type: string
  dedicatedEmail: string
  password: string
}

const EMPTY_DRAFT: DraftClient = {
  firstName: '', lastName: '', email: '', company: '', phone: '', kvk: '', vat: '',
  address: '', postalCode: '', city: '', country: 'Netherlands',
  type: 'New client', dedicatedEmail: '', password: '',
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length <= 1) return { firstName: full.trim(), lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function passwordScore(val: string): number {
  if (!val) return 0
  let score = 0
  if (val.length >= 8) score++
  if (/[A-Z]/.test(val)) score++
  if (/[0-9]/.test(val)) score++
  if (/[^A-Za-z0-9]/.test(val)) score++
  return score
}

type View =
  | { mode: 'list' }
  | { mode: 'form'; formMode: 'add' | 'edit'; original?: string }

export default function ClientsPage() {
  const [clients, setClients] = useState<KnownClient[]>(() => [...KNOWN_CLIENTS])
  const [view, setView] = useState<View>({ mode: 'list' })
  const [draft, setDraft] = useState<DraftClient>(EMPTY_DRAFT)
  const [showPassword, setShowPassword] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function openAdd() {
    setDraft(EMPTY_DRAFT)
    setShowPassword(false)
    setView({ mode: 'form', formMode: 'add' })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }
  function openEdit(c: KnownClient) {
    const { firstName, lastName } = splitName(c.name)
    setDraft({
      firstName,
      lastName,
      email: c.email || '',
      company: c.company || '',
      phone: c.phone || '',
      kvk: c.kvk || '',
      vat: c.vat || '',
      address: c.address || '',
      postalCode: c.postalCode || '',
      city: c.city || '',
      country: c.country || 'Netherlands',
      type: c.type,
      dedicatedEmail: c.dedicatedEmail || '',
      password: c.password || '',
    })
    setShowPassword(false)
    setView({ mode: 'form', formMode: 'edit', original: c.name })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }
  function close() {
    setView({ mode: 'list' })
    setDraft(EMPTY_DRAFT)
  }
  function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let pwd = ''
    for (let i = 0; i < 16; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
    setDraft(d => ({ ...d, password: pwd }))
    setShowPassword(true)
  }
  function save() {
    const fullName = `${draft.firstName} ${draft.lastName}`.trim()
    if (!fullName) {
      alert('First or last name is required.')
      return
    }
    const initials = fullName.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'

    if (view.mode === 'form' && view.formMode === 'edit' && view.original) {
      const idx = KNOWN_CLIENTS.findIndex(c => c.name === view.original)
      if (idx >= 0) {
        const existing = KNOWN_CLIENTS[idx]
        KNOWN_CLIENTS[idx] = {
          ...existing,
          name: fullName,
          initials,
          email: draft.email,
          company: draft.company || undefined,
          phone: draft.phone || undefined,
          kvk: draft.kvk || undefined,
          vat: draft.vat || undefined,
          address: draft.address || undefined,
          postalCode: draft.postalCode || undefined,
          city: draft.city || undefined,
          country: draft.country || undefined,
          type: draft.type || existing.type,
          dedicatedEmail: draft.dedicatedEmail || undefined,
          password: draft.password || undefined,
        }
      }
    } else {
      upsertKnownClient({
        name: fullName,
        email: draft.email,
        company: draft.company,
        phone: draft.phone,
        kvk: draft.kvk,
        vat: draft.vat,
        address: draft.address,
        postalCode: draft.postalCode,
        city: draft.city,
        country: draft.country,
        type: draft.type || undefined,
        dedicatedEmail: draft.dedicatedEmail,
        password: draft.password,
      })
    }
    setClients([...KNOWN_CLIENTS])
    close()
  }
  function remove(name: string) {
    const idx = KNOWN_CLIENTS.findIndex(c => c.name === name)
    if (idx >= 0) KNOWN_CLIENTS.splice(idx, 1)
    setClients([...KNOWN_CLIENTS])
    setConfirmDelete(null)
  }

  // ─── Form view (full-page, replaces the list) ───
  if (view.mode === 'form') {
    const isAdd = view.formMode === 'add'
    const score = passwordScore(draft.password)
    const strengthClass = score <= 1 ? 'w' : score <= 2 ? 'm' : 's'
    const strengthLabel = !draft.password
      ? ''
      : score <= 1 ? 'Weak' : score <= 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong'
    const strengthColor = strengthClass === 'w' ? '#e24b4a' : strengthClass === 'm' ? '#ef9f27' : '#2d6e2d'

    return (
      <>
        <div className="nc-topbar">
          <div className="nc-topbar-left">
            <button type="button" className="nc-back-btn" onClick={close}>← Clients</button>
            <h1 className="nc-page-title">
              {isAdd ? 'Add new client' : `Edit: ${view.original}`}
            </h1>
          </div>
        </div>

        <div className="nc-form-area">
          {/* Card 1 — Contact */}
          <div className="fc">
            <div className="fc-head">
              <div className="fc-icon">
                <svg viewBox="0 0 16 16" fill="none" strokeWidth="1.5">
                  <circle cx="8" cy="5" r="2.5" />
                  <path d="M3 13c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" />
                </svg>
              </div>
              <div>
                <div className="fc-title">Contact</div>
                <div className="fc-desc">Primary details used on invoices and in the client party block on contracts.</div>
              </div>
            </div>
            <div className="fc-body">
              <div className="fg">
                <div className="ff">
                  <label className="fl">First name</label>
                  <input className="fi" value={draft.firstName ?? ''} onChange={e => setDraft({ ...draft, firstName: e.target.value })} placeholder="Joey" autoFocus />
                </div>
                <div className="ff">
                  <label className="fl">Last name</label>
                  <input className="fi" value={draft.lastName ?? ''} onChange={e => setDraft({ ...draft, lastName: e.target.value })} placeholder="de Laat" />
                </div>
                <div className="ff">
                  <label className="fl">Company <span className="opt">optional</span></label>
                  <input className="fi" value={draft.company ?? ''} onChange={e => setDraft({ ...draft, company: e.target.value })} placeholder="LHR Photography" />
                </div>
                <div className="ff">
                  <label className="fl">Phone</label>
                  <input className="fi" type="tel" value={draft.phone ?? ''} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="+31 6 12 34 56 78" />
                </div>
                <div className="ff span2">
                  <label className="fl">Email</label>
                  <input className="fi" type="email" value={draft.email ?? ''} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="hello@example.com" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 — Dedicated Google account */}
          <div className="fc">
            <div className="fc-head">
              <div className="fc-icon">
                <svg viewBox="0 0 16 16" fill="none" strokeWidth="1.5">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" />
                  <path d="M5 7V5a3 3 0 016 0v2" />
                  <circle cx="8" cy="10.5" r="1" />
                </svg>
              </div>
              <div>
                <div className="fc-title">Dedicated Google account</div>
                <div className="fc-desc">Created by you for this client. Connects Vercel, Supabase, Resend and GitHub. Shared after initiation payment is received.</div>
              </div>
            </div>
            <div className="fc-body">
              <div className="fg">
                <div className="ff span2">
                  <label className="fl">Google account email <span className="opt">optional</span></label>
                  <input className="fi" type="email" value={draft.dedicatedEmail ?? ''} onChange={e => setDraft({ ...draft, dedicatedEmail: e.target.value })} placeholder="e.g. clientname@gmail.com" autoComplete="off" />
                  <div className="hint">Leave blank if not yet created. Add it later from the client profile.</div>
                </div>
                <div className="ff span2">
                  <label className="fl">Password</label>
                  <div className="pw-row">
                    <input
                      className="fi"
                      type={showPassword ? 'text' : 'password'}
                      value={draft.password ?? ''}
                      onChange={e => setDraft({ ...draft, password: e.target.value })}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                    />
                    <button type="button" className="pw-toggle" onClick={() => setShowPassword(s => !s)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                    <button type="button" className="pw-gen" onClick={generatePassword}>Generate</button>
                  </div>
                  <div className="strength">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`strength-seg${i < score ? ' ' + strengthClass : ''}`} />
                    ))}
                  </div>
                  <div className="strength-label" style={{ color: strengthLabel ? strengthColor : undefined }}>
                    {strengthLabel}
                  </div>
                  <div className="hint" style={{ marginTop: 5 }}>
                    Stored only in this dashboard. Never written into any contract or document.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3 — Business & legal details */}
          <div className="fc">
            <div className="fc-head">
              <div className="fc-icon">
                <svg viewBox="0 0 16 16" fill="none" strokeWidth="1.5">
                  <rect x="2" y="3" width="12" height="10" rx="1.5" />
                  <line x1="5" y1="7" x2="11" y2="7" />
                  <line x1="5" y1="10" x2="8" y2="10" />
                </svg>
              </div>
              <div>
                <div className="fc-title">Business &amp; legal details</div>
                <div className="fc-desc">Required for Dutch B2B contracts and invoices. Skip anything that does not apply.</div>
              </div>
            </div>
            <div className="fc-body">
              <div className="fg">
                <div className="ff">
                  <label className="fl">KvK number <span className="opt">optional</span></label>
                  <input className="fi" value={draft.kvk ?? ''} onChange={e => setDraft({ ...draft, kvk: e.target.value })} placeholder="e.g. 88321040" />
                </div>
                <div className="ff">
                  <label className="fl">VAT / BTW number <span className="opt">optional</span></label>
                  <input className="fi" value={draft.vat ?? ''} onChange={e => setDraft({ ...draft, vat: e.target.value })} placeholder="e.g. NL123456789B01" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 4 — Address */}
          <div className="fc">
            <div className="fc-head">
              <div className="fc-icon">
                <svg viewBox="0 0 16 16" fill="none" strokeWidth="1.5">
                  <path d="M8 2a4 4 0 014 4c0 3.5-4 8-4 8S4 9.5 4 6a4 4 0 014-4z" />
                  <circle cx="8" cy="6" r="1.3" />
                </svg>
              </div>
              <div>
                <div className="fc-title">Address</div>
                <div className="fc-desc">Billing address used on invoices and the client party block on contracts.</div>
              </div>
            </div>
            <div className="fc-body">
              <div className="fg cols3">
                <div className="ff span2">
                  <label className="fl">Street address</label>
                  <input className="fi" value={draft.address ?? ''} onChange={e => setDraft({ ...draft, address: e.target.value })} placeholder="Stratumsedijk 6" />
                </div>
                <div className="ff">
                  <label className="fl">Postal code</label>
                  <input className="fi" value={draft.postalCode ?? ''} onChange={e => setDraft({ ...draft, postalCode: e.target.value })} placeholder="5611 NB" />
                </div>
                <div className="ff">
                  <label className="fl">City</label>
                  <input className="fi" value={draft.city ?? ''} onChange={e => setDraft({ ...draft, city: e.target.value })} placeholder="Eindhoven" />
                </div>
                <div className="ff">
                  <label className="fl">Country</label>
                  <select className="fi" value={draft.country ?? 'Netherlands'} onChange={e => setDraft({ ...draft, country: e.target.value })}>
                    <option>Netherlands</option>
                    <option>Belgium</option>
                    <option>Germany</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="nc-form-footer">
          <div className="nc-footer-note">
            All fields marked <strong>optional</strong> can be filled in later from the client profile.
          </div>
          <div className="nc-footer-btns">
            <button type="button" className="btn-cancel-nc" onClick={close}>Cancel</button>
            <button type="button" className="btn-add-nc" onClick={save}>
              <span className="btn-add-dot" /> {isAdd ? 'Add client' : 'Save changes'}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ─── Default list view ───
  return (
    <>
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <h1 className="font-heading text-lg font-extrabold text-brown-dark">Clients</h1>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={openAdd}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            <span className="hidden sm:inline">Add Client</span>
            <span className="sm:hidden">Add</span>
          </button>
          <Link href="/contracts/new" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            <span className="hidden sm:inline">New Contract</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>
      </div>

      <div className="p-4 sm:p-7 flex-1">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">All Clients</div>
            <div className="text-xs text-brown-subtle">{clients.length} total</div>
          </div>
          <div className="p-4 sm:p-5">
            {clients.length === 0 && (
              <div className="text-sm text-brown-subtle text-center py-8">No clients yet. Click <strong>Add Client</strong> to create one.</div>
            )}
            {clients.map(c => (
              <div key={c.name} className="client-card">
                <div className="client-avatar">{c.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-brown-dark text-sm truncate">{c.name}</div>
                  <div className="text-xs text-brown-subtle truncate">
                    {c.type}{c.email ? ` · ${c.email}` : ''}{c.company ? ` · ${c.company}` : ''}
                  </div>
                </div>
                <div className="text-xs text-brown-rust font-semibold whitespace-nowrap mr-3">
                  {c.contracts} contract{c.contracts !== 1 ? 's' : ''} · {c.invoices} invoice{c.invoices !== 1 ? 's' : ''}
                </div>
                <div className="flex gap-1.5">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Edit</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(c.name)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal-card" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-heading font-extrabold text-brown-dark text-base">Delete client?</h2>
              <button type="button" className="modal-close" onClick={() => setConfirmDelete(null)} aria-label="Close">×</button>
            </div>
            <div className="p-5 text-sm text-brown-muted">
              Permanently remove <strong>{confirmDelete}</strong> from the client list? This cannot be undone.
              <div className="info-note mt-3">
                Note: in-memory only. Existing contracts/invoices for this client will not be affected, but you will need to re-create the client to issue new ones.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => remove(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Form helpers (legacy helpers removed; new UI uses inline .fc/.fg/.ff classes) ── */
