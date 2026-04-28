'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

type Status = 'DRAFT' | 'PENDING' | 'SIGNED' | 'CANCELLED'

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
      alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  async function deleteContract() {
    if (busy) return
    if (!confirm(`Permanently delete contract ${contractCode}?\n\nThis cannot be undone.`)) return
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
      alert(e instanceof Error ? e.message : 'Delete failed')
      setBusy(null)
    }
  }

  async function sendForSignature() {
    if (busy) return
    if (!clientEmail) {
      alert('No client email on this contract. Add one before sending for signature.')
      return
    }
    if (!confirm(`Send "${contractCode}" to ${clientEmail} for electronic signature via DocuSign?`)) return
    setBusy('sign')
    try {
      const res = await fetch(
        `/api/contracts/${encodeURIComponent(contractCode)}/send-for-signature`,
        { method: 'POST' },
      )
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (j.consentRequired) {
          alert(
            'DocuSign consent not yet granted.\n\n' +
            'Open this URL in your browser to grant consent, then try again:\n\n' +
            `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${process.env.NEXT_PUBLIC_DOCUSIGN_INTEGRATION_KEY || 'your-integration-key'}&redirect_uri=https://www.docusign.com`
          )
        } else {
          throw new Error(j.error || 'Failed to send for signature')
        }
        return
      }
      alert(`Sent! DocuSign will email ${j.sentTo} with the signing link.`)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send for signature')
    } finally {
      setBusy(null)
    }
  }

  const canSign = status !== 'SIGNED' && status !== 'CANCELLED'

  return (
    <>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/><path d="M15 5l4 4"/></svg>
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
