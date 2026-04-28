'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

type Status = 'DRAFT' | 'PENDING' | 'SIGNED' | 'CANCELLED'

type DialogConfig = {
  title: string
  sub?: string
  detail: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
}

export default function ContractDetailActions({
  contractCode,
  status,
  clientEmail,
}: {
  contractCode: string
  status: Status
  clientEmail: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<null | 'cancel' | 'reactivate' | 'delete' | 'sign'>(null)
  const [dialog, setDialog] = useState<DialogConfig | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 6000)
  }

  function closeDialog() {
    setDialog(null)
  }

  async function patchStatus(newStatus: 'CANCELLED' | 'PENDING') {
    if (busy) return
    setBusy(newStatus === 'CANCELLED' ? 'cancel' : 'reactivate')
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(contractCode)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Update failed')
      }
      router.refresh()
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  async function doDelete() {
    setBusy('delete')
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(contractCode)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Delete failed')
      }
      router.replace('/contracts')
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Delete failed')
      setBusy(null)
    }
  }

  async function doSendForSignature() {
    setBusy('sign')
    try {
      const res = await fetch(
        `/api/contracts/${encodeURIComponent(contractCode)}/send-for-signature`,
        { method: 'POST' },
      )
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (j.consentRequired) {
          showToast('error', 'DocuSign consent not yet granted. Grant consent in your DocuSign account and try again.')
        } else {
          throw new Error(j.error || 'Failed to send for signature')
        }
        return
      }
      showToast('success', `Sent! DocuSign is emailing ${j.sentTo} with a secure signing link.`)
      router.refresh()
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to send for signature')
    } finally {
      setBusy(null)
    }
  }

  function sendForSignature() {
    if (busy) return
    if (!clientEmail) {
      showToast('error', 'No client email on this contract. Edit the contract and add one before sending.')
      return
    }
    setDialog({
      title: 'Send for signature',
      sub: 'Via DocuSign · eIDAS',
      detail: `DocuSign will send a secure signing link to ${clientEmail}. Once they sign, the contract status updates automatically.`,
      confirmLabel: 'Send via DocuSign',
      onConfirm: doSendForSignature,
    })
  }

  function deleteContract() {
    if (busy) return
    setDialog({
      title: 'Delete contract',
      detail: `Permanently delete ${contractCode}? This cannot be undone.`,
      confirmLabel: 'Delete permanently',
      danger: true,
      onConfirm: doDelete,
    })
  }

  const canSign = status !== 'SIGNED' && status !== 'CANCELLED'

  return (
    <>
      {/* ── Confirmation modal ─────────────────────────────────────────── */}
      {dialog && (
        <div
          className="fixed inset-0 z-[100] bg-brown-dark/50 flex items-center justify-center p-4"
          onClick={() => !busy && closeDialog()}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-brown-dark/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-2">
              {dialog.sub && (
                <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle mb-1">
                  {dialog.sub}
                </div>
              )}
              <h2 className="font-heading text-lg font-extrabold text-brown-dark">{dialog.title}</h2>
            </div>

            <div className="px-6 py-4">
              <p className="text-sm text-brown-subtle leading-relaxed">{dialog.detail}</p>
            </div>

            <div className="px-6 py-4 border-t border-brown-dark/10 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeDialog}
                disabled={!!busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-sm ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => { closeDialog(); dialog.onConfirm() }}
                disabled={!!busy}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notification ─────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[200] max-w-sm flex items-start gap-3 rounded-xl px-4 py-3.5 shadow-xl text-sm font-medium leading-snug transition-all
            ${toast.type === 'success'
              ? 'bg-brown-dark text-cream'
              : 'bg-danger text-white'
            }`}
        >
          <span className="text-base shrink-0 mt-px">{toast.type === 'success' ? '✓' : '⚠'}</span>
          <span className="flex-1">{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="shrink-0 opacity-60 hover:opacity-100 text-base leading-none"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      <Link
        href={`/contracts/${encodeURIComponent(contractCode)}/edit`}
        className="btn btn-ghost btn-sm"
        title="Edit and republish this contract"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        <span>Edit</span>
      </Link>

      {canSign && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={sendForSignature}
          disabled={!!busy}
          title={clientEmail ? `Send to ${clientEmail} for DocuSign signature` : 'No client email — add one first'}
        >
          {busy === 'sign' ? (
            'Sending…'
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.08V8l-6-6H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6"/><path d="M14 3v5h5"/><path d="M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><line x1="18" y1="15" x2="18" y2="18"/></svg>
              <span>Send for signature</span>
            </>
          )}
        </button>
      )}

      {status !== 'CANCELLED' ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => patchStatus('CANCELLED')}
          disabled={!!busy}
          title="Mark this contract as cancelled"
        >
          {busy === 'cancel' ? 'Cancelling…' : 'Cancel contract'}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => patchStatus('PENDING')}
          disabled={!!busy}
        >
          {busy === 'reactivate' ? 'Reactivating…' : 'Reactivate'}
        </button>
      )}

      <button
        type="button"
        className="btn btn-ghost btn-sm text-danger"
        onClick={deleteContract}
        disabled={!!busy}
        title="Permanently delete this contract"
      >
        {busy === 'delete' ? 'Deleting…' : 'Delete'}
      </button>
    </>
  )
}
