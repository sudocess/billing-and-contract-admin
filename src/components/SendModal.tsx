'use client'

import { useState } from 'react'

interface SendModalProps {
  invoiceId: string
  clientEmail: string
  clientName: string
  invoiceNumber: string
  language: string
  onClose: () => void
  onSent: () => void
}

export default function SendModal({ invoiceId, clientEmail, clientName, invoiceNumber, language, onClose, onSent }: SendModalProps) {
  const [email, setEmail] = useState(clientEmail)
  const [subject, setSubject] = useState(`Invoice ${invoiceNumber} — Engaging UX Design`)
  const [message, setMessage] = useState(
    clientName
      ? `Hi ${clientName},\n\nPlease find your invoice attached. Don't hesitate to reach out if you have any questions.\n\nKind regards,\nEngaging UX Design`
      : ''
  )
  const [invLang, setInvLang] = useState(language || 'en')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    if (!email) { setError('Please enter a recipient email.'); return }
    setSending(true)
    setError('')
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, subject, message, language: invLang }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invoice')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <h2 className="font-heading text-lg font-extrabold text-brown-dark mb-1.5">Send Invoice</h2>
        <p className="text-[0.88rem] text-brown-muted mb-6 leading-relaxed">
          Choose the language for the invoice email and document, then send to your client.
        </p>

        <div className="flex flex-col gap-1.5 mb-3.5">
          <label>Send To</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" />
        </div>

        <div className="flex flex-col gap-1.5 mb-3.5">
          <label>Email Subject</label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder={`Invoice ${invoiceNumber}`} />
        </div>

        <div className="flex flex-col gap-1.5 mb-3.5">
          <label>Personal Message <span className="text-brown-subtle font-normal">(optional)</span></label>
          <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Hi, please find your invoice attached..." />
        </div>

        <div className="flex flex-col gap-1.5">
          <label>Invoice Language</label>
          <div className="flex gap-2.5 mt-1.5">
            <button
              className={`flex-1 ${invLang === 'en' ? 'btn btn-primary' : 'btn btn-ghost'}`}
              onClick={() => setInvLang('en')}
            >
              🇬🇧 Send in English
            </button>
            <button
              className={`flex-1 ${invLang === 'nl' ? 'btn btn-primary' : 'btn btn-ghost'}`}
              onClick={() => setInvLang('nl')}
            >
              🇳🇱 Verstuur in het Nederlands
            </button>
          </div>
          <span className="text-xs text-brown-subtle mt-1">The invoice document and email will be generated in the selected language.</span>
        </div>

        {error && (
          <div className="mt-4 bg-danger-bg text-danger text-sm font-semibold px-3 py-2 rounded-lg">{error}</div>
        )}

        <div className="flex gap-2.5 mt-6 justify-end">
          <button className="btn btn-ghost" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-success" onClick={handleSend} disabled={sending}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            {sending ? 'Sending...' : 'Confirm & Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
