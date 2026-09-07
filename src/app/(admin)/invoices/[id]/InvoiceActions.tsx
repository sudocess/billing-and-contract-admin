'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SendModal from '@/components/SendModal'

interface InvoiceActionsProps {
  invoice: {
    id: string
    invoiceNumber: string
    clientEmail: string
    clientName: string
    language: string
    status: string
  }
}

const METHODS = ['Bank transfer', 'iDEAL', 'Cash', 'Other'] as const

export default function InvoiceActions({ invoice }: InvoiceActionsProps) {
  const router = useRouter()
  const [sendModal, setSendModal] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [toast, setToast] = useState('')

  // Defaults to today, but it is editable — a bank transfer clears days after it is
  // sent, and the books should match the bank statement rather than the day the
  // button happened to be pressed.
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [paidMethod, setPaidMethod] = useState<string>('Bank transfer')
  const [paidReference, setPaidReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function confirmPaid(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAID',
          // Midday avoids the date shifting a day either way across time zones.
          paidAt: new Date(`${paidAt}T12:00:00`).toISOString(),
          paidMethod,
          paidReference: paidReference.trim(),
        }),
      })
      if (!res.ok) throw new Error('Could not record the payment')
      setPayModal(false)
      setToast(`Recorded as paid on ${paidAt}`)
      router.refresh()
      setTimeout(() => setToast(''), 3500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {invoice.status !== 'PAID' && (
        <button className="btn btn-success btn-sm" onClick={() => setPayModal(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          Mark Paid
        </button>
      )}
      <button className="btn btn-primary" onClick={() => setSendModal(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        Send Invoice
      </button>

      {payModal && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-brown-dark/50 px-4"
          onClick={() => !saving && setPayModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-brown-light">
              <h2 className="font-heading text-lg font-bold text-brown-dark">Record payment</h2>
              <p className="text-xs text-brown-subtle mt-0.5">
                Invoice <span className="font-mono">{invoice.invoiceNumber}</span> · {invoice.clientName}
              </p>
            </div>

            <form onSubmit={confirmPaid} className="p-6 grid gap-4">
              {error && (
                <div className="px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-brown-muted mb-1.5">
                  Payment date
                </span>
                <input type="date" required value={paidAt} onChange={e => setPaidAt(e.target.value)} />
                <span className="block text-[11px] text-brown-subtle mt-1">
                  The date the money arrived, not today&apos;s date.
                </span>
              </label>

              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-brown-muted mb-1.5">
                  Method
                </span>
                <select value={paidMethod} onChange={e => setPaidMethod(e.target.value)}>
                  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-brown-muted mb-1.5">
                  Reference
                </span>
                <input
                  type="text"
                  value={paidReference}
                  onChange={e => setPaidReference(e.target.value)}
                  placeholder="Bank reference or transaction ID"
                />
                <span className="block text-[11px] text-brown-subtle mt-1">
                  Whatever lets you find this payment on your bank statement later.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPayModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-success btn-sm" disabled={saving}>
                  {saving ? 'Saving…' : 'Mark as paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sendModal && (
        <SendModal
          invoiceId={invoice.id}
          clientEmail={invoice.clientEmail}
          clientName={invoice.clientName}
          invoiceNumber={invoice.invoiceNumber}
          language={invoice.language}
          onClose={() => setSendModal(false)}
          onSent={() => {
            setSendModal(false)
            setToast('Invoice sent successfully!')
            router.refresh()
            setTimeout(() => setToast(''), 3500)
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-brown-mid text-brown-pale px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-2.5 z-[300] toast-enter font-semibold text-sm">
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          {toast}
        </div>
      )}
    </>
  )
}
