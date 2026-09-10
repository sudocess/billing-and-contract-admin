'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = {
  contractCode: string
  clientName: string
  clientCompany: string | null
  projectName: string | null
  phaseLabel: string
  status: string
  totalValue: number
}

/**
 * Pick the agreement this extension adds to.
 *
 * A scope extension only exists relative to a parent, so the parent is chosen first
 * and the rest is the ordinary contract editor — the extension is a real contract
 * with its own price and its own signature, linked back to what it extends.
 */
export default function ExtensionPicker() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/contracts', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { contracts: [] }))
      .then(j => setRows(j.contracts ?? []))
      .catch(() => setRows([]))
  }, [])

  // A superseded or cancelled agreement has nothing to extend.
  const eligible = rows.filter(r => r.status !== 'SUPERSEDED' && r.status !== 'CANCELLED')
  const filtered = eligible.filter(r => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return `${r.contractCode} ${r.clientName} ${r.clientCompany ?? ''} ${r.projectName ?? ''}`
      .toLowerCase().includes(q)
  })

  async function create(code: string) {
    if (busy) return
    setBusy(code); setError('')
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(code)}/change-order`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not create the scope extension.')
      // Straight into the editor: an extension has its own scope and its own price,
      // and both are blank until filled in.
      router.push(`/contracts/${encodeURIComponent(j.contractCode ?? j.new)}/edit`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the scope extension.')
      setBusy(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-brown-subtle mb-4">
        Which agreement does this extend? The original stays in force — the extension is
        priced and signed separately.
      </p>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by contract, client or project…"
        className="mb-4"
      />

      {error && (
        <div className="mb-4 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map(r => (
          <button
            key={r.contractCode}
            type="button"
            onClick={() => create(r.contractCode)}
            disabled={!!busy}
            className="text-left rounded-lg border border-brown-light px-4 py-3 hover:bg-brown-pale/25 transition-colors disabled:opacity-50"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-heading font-bold text-brown-dark">
                {r.projectName || r.phaseLabel}
              </span>
              <span className="font-mono text-[11px] text-brown-subtle">{r.contractCode}</span>
            </div>
            <div className="text-[12px] text-brown-subtle">
              {r.clientCompany || r.clientName} · {r.status}
              {busy === r.contractCode ? ' · creating…' : ''}
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-brown-subtle">
            No contract available to extend. Superseded and cancelled agreements cannot be extended.
          </p>
        )}
      </div>
    </div>
  )
}
