'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

type Props = {
  contractCode: string
  status: 'signed' | 'pending' | 'cancelled'
  viewable: boolean
}

export default function ContractRowActions({ contractCode, status, viewable }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<null | 'cancel' | 'delete' | 'reactivate'>(null)

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
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {viewable ? (
        <Link
          href={`/contracts/${encodeURIComponent(contractCode)}`}
          className="btn btn-ghost btn-sm"
        >View</Link>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" disabled title="Demo contract — no saved snapshot">View</button>
      )}
      {viewable && (
        <>
          <Link
            href={`/contracts/${encodeURIComponent(contractCode)}/edit`}
            className="btn btn-ghost btn-sm"
          >Edit</Link>
          {status !== 'cancelled' ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => patchStatus('CANCELLED')}
              disabled={!!busy}
            >{busy === 'cancel' ? 'Cancelling…' : 'Cancel'}</button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => patchStatus('PENDING')}
              disabled={!!busy}
            >{busy === 'reactivate' ? 'Reactivating…' : 'Reactivate'}</button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm text-danger"
            onClick={deleteContract}
            disabled={!!busy}
          >{busy === 'delete' ? 'Deleting…' : 'Delete'}</button>
        </>
      )}
      {!viewable && (
        status === 'signed' ? (
          <button type="button" className="btn btn-ghost btn-sm">Invoice</button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm">Resend</button>
        )
      )}
    </div>
  )
}
