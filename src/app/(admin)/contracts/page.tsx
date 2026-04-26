import Link from 'next/link'
import { MOCK_CONTRACTS, KNOWN_CLIENTS, nextContractId } from '@/lib/contracts'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const phaseBadge: Record<string, { label: string; cls: string }> = {
  phase1: { label: 'Phase 1', cls: 'badge-phase1' },
  phase2: { label: 'Phase 2', cls: 'badge-phase2' },
  phase3: { label: 'Phase 3', cls: 'badge-phase3' },
  custom: { label: 'Special', cls: 'badge-custom' },
}

const fmt = (n: number) => n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const typeLabel = (t: string) => {
  switch (t) {
    case 'custom': return 'Custom Agreement'
    case 'standard': return 'Standard Agreement'
    case 'phase': return 'Phase Agreement'
    default: return t.charAt(0).toUpperCase() + t.slice(1)
  }
}

type DisplayContract = {
  id: string
  client: string
  type: string
  phase: 'phase1' | 'phase2' | 'phase3' | 'custom'
  value: number
  status: 'signed' | 'pending'
  viewable?: boolean
}

export default async function ContractsPage() {
  // Saved (DB) contracts come first, then the mock historical demo rows
  const dbContracts = await prisma.contract.findMany({ orderBy: { createdAt: 'desc' } })
  const dbRows: DisplayContract[] = dbContracts.map(c => ({
    id: c.contractCode,
    client: c.clientName,
    type: typeLabel(c.contractType),
    phase: (['phase1', 'phase2', 'phase3', 'custom'].includes(c.phase) ? c.phase : 'custom') as DisplayContract['phase'],
    value: c.totalValue,
    status: c.status === 'SIGNED' ? 'signed' : 'pending',
    viewable: true,
  }))
  const contracts: DisplayContract[] = [...dbRows, ...MOCK_CONTRACTS]

  const active = contracts.filter(c => c.status === 'signed').length
  const pending = contracts.filter(c => c.status === 'pending').length

  // "Signed this month" — count from DB only (real saved data)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const signedThisMonth = dbContracts.filter(
    c => c.status === 'SIGNED' && c.signedAt && c.signedAt >= monthStart,
  ).length

  // Next contract no.: derive from the most recent client (Joey) for the demo
  const joey = KNOWN_CLIENTS[0]
  const nextNo = nextContractId(joey.clientCode, 3)

  return (
    <>
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <h1 className="font-heading text-lg font-extrabold text-brown-dark">Contract History</h1>
        <Link href="/contracts/new" className="btn btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          <span className="hidden sm:inline">New Contract</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      <div className="p-4 sm:p-7 flex-1">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-brown-dark/10">
            <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-2">Active Contracts</div>
            <div className="font-heading text-2xl font-black text-brown-dark tabular-nums">{active}</div>
            <div className="text-xs text-brown-subtle mt-1">currently signed</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-brown-dark/10">
            <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-2">Awaiting Signature</div>
            <div className="font-heading text-2xl font-black text-warning tabular-nums">{pending}</div>
            <div className="text-xs text-brown-subtle mt-1">{pending === 1 ? 'contract' : 'contracts'} pending</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-brown-dark/10">
            <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-2">Signed This Month</div>
            <div className="font-heading text-2xl font-black text-success tabular-nums">{signedThisMonth}</div>
            <div className="text-xs text-brown-subtle mt-1">in {new Date().toLocaleDateString('en-US', { month: 'long' })}</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-brown-dark/10">
            <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-2">Next Contract No.</div>
            <div className="font-heading text-xl font-black text-brown-dark">{nextNo}</div>
            <span className="badge badge-info mt-1.5">Auto-generated</span>
          </div>
        </div>

        {/* Table */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">All Contracts</div>
            <div className="text-xs text-brown-subtle">{contracts.length} total contracts</div>
          </div>
          <div className="overflow-x-auto">
            <table className="history-table min-w-[860px]">
              <thead>
                <tr>
                  <th>Contract ID</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Phase</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono text-[0.8rem] text-brown-subtle">{c.id}</td>
                    <td>
                      <Link href="/clients" className="text-brown-rust hover:underline font-medium">
                        {c.client}
                      </Link>
                    </td>
                    <td>{c.type}</td>
                    <td>
                      <span className={`badge ${phaseBadge[c.phase].cls}`}>{phaseBadge[c.phase].label}</span>
                    </td>
                    <td className="font-heading font-bold tabular-nums">€{fmt(c.value)}</td>
                    <td>
                      {c.status === 'signed' ? (
                        <span className="badge badge-success">Signed</span>
                      ) : (
                        <span className="badge badge-warning">Awaiting sig.</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {c.viewable ? (
                          <Link href={`/contracts/${encodeURIComponent(c.id)}`} className="btn btn-ghost btn-sm">View</Link>
                        ) : (
                          <button type="button" className="btn btn-ghost btn-sm" disabled title="Demo contract — no saved snapshot">View</button>
                        )}
                        {c.status === 'signed' ? (
                          <button type="button" className="btn btn-ghost btn-sm">Invoice</button>
                        ) : (
                          <button type="button" className="btn btn-ghost btn-sm">Resend</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
