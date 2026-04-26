import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { MOCK_CONTRACTS } from '@/lib/contracts'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const fmtInt = (n: number) => n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const dateFmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export default async function DashboardPage() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [invoices, contracts] = await Promise.all([
    prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.contract.findMany({ orderBy: { createdAt: 'desc' } }),
  ])

  /* ── Invoice stats ── */
  const thisMonthRevenue = invoices
    .filter(i => i.createdAt >= monthStart)
    .reduce((s, i) => s + i.grandTotal, 0)

  const outstandingInvoices = invoices.filter(i => ['SENT', 'OVERDUE'].includes(i.status))
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + i.grandTotal, 0)

  const paidThisMonth = invoices.filter(i => i.status === 'PAID' && i.paidAt && i.paidAt >= monthStart)
  const paidTotal = paidThisMonth.reduce((s, i) => s + i.grandTotal, 0)

  /* ── Contract stats ── */
  const mockSigned = MOCK_CONTRACTS.filter(c => c.status === 'signed').length
  const mockPending = MOCK_CONTRACTS.filter(c => c.status === 'pending').length
  const dbSigned = contracts.filter(c => c.status === 'SIGNED').length
  const dbPending = contracts.filter(c => c.status === 'PENDING' || c.status === 'DRAFT').length

  const activeContracts = mockSigned + dbSigned
  const pendingContracts = mockPending + dbPending
  const contractValueThisMonth = contracts
    .filter(c => c.createdAt >= monthStart)
    .reduce((s, c) => s + c.totalValue, 0)

  /* ── Combined activity feed ── */
  type Activity = {
    kind: 'invoice' | 'contract'
    id: string
    date: Date
    title: string
    sub: string
    amount: number
    href: string
    status: string
  }

  const invoiceActivity: Activity[] = invoices.map(i => ({
    kind: 'invoice',
    id: i.id,
    date: i.createdAt,
    title: i.invoiceNumber,
    sub: i.clientName,
    amount: i.grandTotal,
    href: `/invoices/${i.id}`,
    status: i.status,
  }))
  const contractActivity: Activity[] = contracts.map(c => ({
    kind: 'contract',
    id: c.id,
    date: c.createdAt,
    title: c.contractCode,
    sub: c.clientName,
    amount: c.totalValue,
    href: `/contracts`,
    status: c.status,
  }))
  const activity = [...invoiceActivity, ...contractActivity]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8)

  return (
    <>
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <h1 className="font-heading text-lg font-extrabold text-brown-dark">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/contracts/new" className="btn btn-ghost">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            <span className="hidden sm:inline">New Contract</span>
            <span className="sm:hidden">Contract</span>
          </Link>
          <Link href="/invoices/new" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
            <span className="hidden sm:inline">New Invoice</span>
            <span className="sm:hidden">Invoice</span>
          </Link>
        </div>
      </div>

      <div className="p-4 sm:p-7 flex-1">
        {/* ── Top KPI grid ── */}
        <section className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-brown-rust mb-3">Revenue · this month</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Invoiced This Month" value={`€${fmt(thisMonthRevenue)}`} sub="incl. VAT" />
            <Stat label="Paid This Month" value={`€${fmt(paidTotal)}`} sub={`${paidThisMonth.length} invoice${paidThisMonth.length !== 1 ? 's' : ''}`} accent="success" />
            <Stat label="Outstanding" value={`€${fmt(outstandingTotal)}`} sub={`${outstandingInvoices.length} unpaid`} accent="warning" />
            <Stat label="New Contract Value" value={`€${fmt(contractValueThisMonth)}`} sub={`${contracts.filter(c => c.createdAt >= monthStart).length} signed/saved`} />
          </div>
        </section>

        <section className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-brown-rust mb-3">Pipeline</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Active Contracts" value={String(activeContracts)} sub="currently signed" />
            <Stat label="Awaiting Signature" value={String(pendingContracts)} sub={`${pendingContracts === 1 ? 'contract' : 'contracts'} pending`} accent="warning" />
            <Stat label="Total Invoices" value={String(invoices.length)} sub="all time" />
            <Stat label="Saved Contracts" value={String(contracts.length)} sub="in database" />
          </div>
        </section>

        {/* ── Two-column: recent activity + shortcuts ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="panel lg:col-span-2">
            <div className="panel-header">
              <div className="panel-title">Recent Activity</div>
              <div className="text-xs text-brown-subtle">Invoices &amp; contracts combined</div>
            </div>
            {activity.length === 0 ? (
              <div className="panel-body text-center py-10 text-sm text-brown-subtle">
                Nothing yet. Create an invoice or save a contract to see it here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="history-table min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Client</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map(a => (
                      <tr key={`${a.kind}-${a.id}`}>
                        <td>
                          {a.kind === 'invoice'
                            ? <span className="badge badge-info">Invoice</span>
                            : <span className="badge badge-phase2">Contract</span>}
                        </td>
                        <td>
                          <Link href={a.href} className="font-bold text-brown-rust hover:underline">{a.title}</Link>
                        </td>
                        <td>{a.sub}</td>
                        <td>{dateFmt(a.date)}</td>
                        <td className="font-heading font-bold tabular-nums">€{fmtInt(a.amount)}</td>
                        <td>
                          {a.kind === 'invoice' ? (
                            <span className={`badge ${
                              a.status === 'PAID' ? 'badge-success'
                                : a.status === 'OVERDUE' ? 'badge-warning'
                                : 'badge-info'
                            }`}>
                              {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                            </span>
                          ) : (
                            <span className={`badge ${a.status === 'SIGNED' ? 'badge-success' : 'badge-warning'}`}>
                              {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Quick Actions</div></div>
              <div className="p-4 space-y-2">
                <Link href="/invoices/new" className="btn btn-primary w-full justify-center">+ New Invoice</Link>
                <Link href="/contracts/new" className="btn btn-ghost w-full justify-center">+ New Contract</Link>
                <Link href="/clients" className="btn btn-ghost w-full justify-center">Manage Clients</Link>
                <Link href="/settings" className="btn btn-ghost w-full justify-center">Account Settings</Link>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">Browse</div></div>
              <div className="p-4 space-y-1 text-sm">
                <Link href="/invoices" className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-brown-pale">
                  <span className="font-medium text-brown-dark">All invoices</span>
                  <span className="text-xs text-brown-subtle">{invoices.length}</span>
                </Link>
                <Link href="/contracts" className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-brown-pale">
                  <span className="font-medium text-brown-dark">All contracts</span>
                  <span className="text-xs text-brown-subtle">{contracts.length}</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'success' | 'warning' | 'danger'
}) {
  const valueColor =
    accent === 'success' ? 'text-success'
      : accent === 'warning' ? 'text-warning'
      : accent === 'danger' ? 'text-danger'
      : 'text-brown-dark'
  return (
    <div className="bg-white rounded-xl p-5 border border-brown-dark/10">
      <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-2">{label}</div>
      <div className={`font-heading text-2xl font-black tabular-nums ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-brown-subtle mt-1">{sub}</div>}
    </div>
  )
}
