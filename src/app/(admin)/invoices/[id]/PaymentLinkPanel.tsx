'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ALLOWED_PAYMENT_HOSTS, linkAgeDays, LINK_STALE_AFTER_DAYS } from '@/lib/paymentLink'

/**
 * Paste the payment request that goes out with the invoice email.
 *
 * The link is stamped when saved, because these requests expire: without the date, a
 * link pasted in September looks exactly like one pasted this morning, and the first
 * sign of the difference would be a client reporting a dead page.
 */
export default function PaymentLinkPanel({
  invoiceId,
  initialUrl,
  initialAddedAt,
  amountDue,
  currency,
}: {
  invoiceId: string
  initialUrl: string | null
  initialAddedAt: string | null
  amountDue: number
  currency: string
}) {
  const router = useRouter()
  const [url, setUrl] = useState(initialUrl ?? '')
  const [savedUrl, setSavedUrl] = useState(initialUrl ?? '')
  const [addedAt, setAddedAt] = useState(initialAddedAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const age = linkAgeDays(addedAt)
  const stale = age !== null && age > LINK_STALE_AFTER_DAYS
  const dirty = url.trim() !== savedUrl

  async function save() {
    if (busy) return
    setBusy(true); setError(''); setOk('')
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment-link`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not save the link.')
      setSavedUrl(j.paymentLinkUrl)
      setUrl(j.paymentLinkUrl)
      setAddedAt(j.paymentLinkAt)
      setOk('Saved, it will be included in the invoice email.')
      router.refresh()
      setTimeout(() => setOk(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the link.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (busy) return
    setBusy(true); setError(''); setOk('')
    try {
      await fetch(`/api/invoices/${invoiceId}/payment-link`, { method: 'DELETE' })
      setUrl(''); setSavedUrl(''); setAddedAt(null)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel p-5 mb-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider">Payment request link</div>
        {savedUrl && (
          <span
            className={`text-[11px] font-semibold ${stale ? 'text-warning' : 'text-brown-subtle'}`}
          >
            {age === 0 ? 'Added today' : `Added ${age} day${age === 1 ? '' : 's'} ago`}
            {stale ? ', check it still works' : ''}
          </span>
        )}
      </div>

      <p className="text-[13px] text-brown-subtle leading-relaxed mb-3">
        Paste the Rabobank betaalverzoek (or other request) for{' '}
        <strong className="text-brown-dark">{currency}{amountDue.toFixed(2)}</strong>. The email shows
        that amount beside the link and prints the full address, so the client can see where it
        goes before clicking.
      </p>

      <textarea
        value={url}
        onChange={e => { setUrl(e.target.value); setError('') }}
        rows={3}
        spellCheck={false}
        placeholder="https://betaalverzoek.rabobank.nl/..."
        className="w-full font-mono text-[12px] break-all"
      />

      {error && (
        <div className="mt-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 text-[13px]">
          {error}
        </div>
      )}
      {ok && (
        <div className="mt-2 px-3 py-2 rounded-md bg-success/10 border border-success/30 text-success text-[13px]">
          {ok}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-3">
        <span className="text-[11px] text-brown-subtle">
          Accepted: {ALLOWED_PAYMENT_HOSTS.join(', ')}
        </span>
        <div className="flex gap-2">
          {savedUrl && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={remove} disabled={busy}>
              Remove
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={save}
            disabled={busy || !url.trim() || !dirty}
          >
            {busy ? 'Saving…' : savedUrl ? 'Update link' : 'Save link'}
          </button>
        </div>
      </div>
    </div>
  )
}
