'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { fmtEuro } from '@/lib/installments'

type Row = {
  id: string
  contractCode: string
  clientName: string
  clientCompany: string | null
  projectName: string | null
  phaseLabel: string
  contractType: string
  status: string
  totalValue: number
  parentContractId: string | null
  signedAt: string | null
  createdAt: string
}

/**
 * Pick the agreement this extension adds to.
 *
 * Grouped by client rather than listed flat, because the question being answered is
 * "what does this client already have with me" — the care plans, the projects, and
 * the extensions already hanging off them. A flat list of codes makes that invisible.
 */
export default function ExtensionPicker() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/contracts', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { contracts: [] }))
      .then(j => setRows(j.contracts ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const byId = new Map(rows.map(r => [r.id, r]))
    const map = new Map<string, Row[]>()

    for (const r of rows) {
      const key = (r.clientCompany || r.clientName || 'Unknown').trim()
      const hay = `${r.contractCode} ${r.clientName} ${r.clientCompany ?? ''} ${r.projectName ?? ''} ${r.phaseLabel}`.toLowerCase()
      if (q && !hay.includes(q)) continue
      const list = map.get(key)
      if (list) list.push(r)
      else map.set(key, [r])
    }

    return [...map.entries()]
      .map(([client, list]) => ({
        client,
        list: list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
        byId,
      }))
      .sort((a, b) => a.client.localeCompare(b.client))
  }, [rows, search])

  // Superseded and cancelled agreements have nothing left to extend.
  const canExtend = (r: Row) => r.status !== 'SUPERSEDED' && r.status !== 'CANCELLED'

  const kindOf = (r: Row) =>
    r.contractType === 'care' ? 'Care plan'
      : r.parentContractId ? 'Scope extension'
      : r.contractType === 'extension' ? 'Scope extension'
      : 'Project'

  async function create(code: string) {
    if (busy) return
    setBusy(code); setError('')
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(code)}/change-order`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not create the scope extension.')
      router.push(`/contracts/${encodeURIComponent(j.new)}/edit`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the scope extension.')
      setBusy(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-brown-subtle mb-4">
        Which agreement does this extend? The original stays in force, the extension is
        priced and signed separately.
      </p>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by client, project or contract code…"
        className="mb-4"
      />

      {error && (
        <div className="mb-4 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-brown-subtle">Loading…</p>}

      {!loading && groups.length === 0 && (
        <p className="text-sm text-brown-subtle">
          Nothing to extend yet. <Link href="/contracts/new" className="text-brown-rust underline">Create a contract first</Link>.
        </p>
      )}

      <div className="flex flex-col gap-5">
        {groups.map(g => (
          <div key={g.client}>
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h2 className="font-heading text-base font-bold text-brown-dark m-0">{g.client}</h2>
              <span className="text-[11px] text-brown-subtle">
                {g.list.length} agreement{g.list.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {g.list.map(r => {
                const extendable = canExtend(r)
                const parent = r.parentContractId ? g.byId.get(r.parentContractId) : null
                return (
                  <div
                    key={r.contractCode}
                    className={`rounded-lg border px-4 py-3 ${
                      extendable ? 'border-brown-light bg-white' : 'border-brown-light/60 bg-brown-pale/20'
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-heading font-bold text-brown-dark">
                        {r.projectName || r.phaseLabel}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle">
                        {kindOf(r)}
                      </span>
                    </div>

                    <div className="text-[12px] text-brown-subtle mt-0.5">
                      <Link
                        href={`/contracts/${encodeURIComponent(r.contractCode)}`}
                        target="_blank"
                        className="font-mono text-brown-rust hover:underline"
                      >
                        {r.contractCode}
                      </Link>
                      {' · '}{r.status}{' · '}{fmtEuro(r.totalValue)}
                      {r.contractType === 'care' && '/mo'}
                      {parent && (
                        <> · extends <span className="font-mono">{parent.contractCode}</span></>
                      )}
                    </div>

                    <div className="mt-2">
                      {extendable ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm !py-1 !text-[11px]"
                          onClick={() => create(r.contractCode)}
                          disabled={!!busy}
                        >
                          {busy === r.contractCode ? 'Creating…' : 'Extend this agreement'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-brown-subtle">
                          {r.status === 'SUPERSEDED'
                            ? 'Replaced by a later version, extend that instead'
                            : 'Cancelled, nothing to extend'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
