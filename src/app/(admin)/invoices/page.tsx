import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  }) as Array<{
    id: string
    invoiceNumber: string
    status: string
    clientName: string
    clientEmail: string
    invoiceDate: Date
    dueDate: Date
    currency: string
    subtotal: number
    vatTotal: number
    grandTotal: number
    paidAt: Date | null
    sentAt: Date | null
    createdAt: Date
    items: Array<{ id: string }>
  }>

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const thisMonthTotal = invoices
    .filter(i => i.createdAt >= monthStart)
    .reduce((sum, i) => sum + i.grandTotal, 0)

  const outstandingInvoices = invoices.filter(i => ['SENT', 'OVERDUE'].includes(i.status))
  const outstandingTotal = outstandingInvoices.reduce((sum, i) => sum + i.grandTotal, 0)

  const paidThisMonth = invoices.filter(i => i.status === 'PAID' && i.paidAt && i.paidAt >= monthStart)
  const paidTotal = paidThisMonth.reduce((sum, i) => sum + i.grandTotal, 0)

  // Next invoice number
  const lastNumber = invoices[0]?.invoiceNumber
  let nextNumber = `${now.getFullYear()}-001`
  if (lastNumber) {
    const match = lastNumber.match(/(\d+)$/)
    if (match) {
      const next = String(parseInt(match[1]) + 1).padStart(3, '0')
      nextNumber = lastNumber.replace(/(\d+)$/, next)
    }
  }

  const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const dateFmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
        {/* Topbar */}
        <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
          <h1 className="font-heading text-lg font-extrabold text-brown-dark">Invoices</h1>
          <Link href="/invoices/new" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
            <span className="hidden sm:inline">New Invoice</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>

        <div className="p-4 sm:p-7 flex-1">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 border border-brown-dark/10">
              <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-2">Total This Month</div>
              <div className="font-heading text-2xl font-black text-brown-dark tabular-nums">€{fmt(thisMonthTotal)}</div>
              <div className="text-xs text-brown-subtle mt-1">incl. VAT</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-brown-dark/10">
              <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-2">Outstanding</div>
              <div className="font-heading text-2xl font-black text-warning tabular-nums">€{fmt(outstandingTotal)}</div>
              <div className="text-xs text-brown-subtle mt-1">{outstandingInvoices.length} invoice{outstandingInvoices.length !== 1 ? 's' : ''} unpaid</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-brown-dark/10">
              <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-2">Paid This Month</div>
              <div className="font-heading text-2xl font-black text-success tabular-nums">€{fmt(paidTotal)}</div>
              <div className="text-xs text-brown-subtle mt-1">{paidThisMonth.length} invoice{paidThisMonth.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-brown-dark/10">
              <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-2">Next Invoice No.</div>
              <div className="font-heading text-xl font-black text-brown-dark">{nextNumber}</div>
              <span className="badge badge-info mt-1.5">Auto-generated</span>
            </div>
          </div>

          {/* Invoice Table */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Invoice History</div>
              <div className="text-xs text-brown-subtle">{invoices.length} total invoices</div>
            </div>
            {invoices.length === 0 ? (
              <div className="panel-body text-center py-12">
                <div className="text-brown-subtle text-sm mb-4">No invoices yet. Create your first one!</div>
                <Link href="/invoices/new" className="btn btn-primary">Create Invoice</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="history-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Invoice No.</th>
                    <th>Client</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/invoices/${inv.id}`} className="font-bold text-brown-rust hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td>{inv.clientName}</td>
                      <td>{dateFmt(inv.invoiceDate)}</td>
                      <td>{dateFmt(inv.dueDate)}</td>
                      <td className="font-heading font-bold tabular-nums">{inv.currency}{fmt(inv.grandTotal)}</td>
                      <td><StatusBadge status={inv.status} /></td>
                      <td>
                        <div className="flex gap-2">
                          <Link href={`/invoices/${inv.id}`} className="btn btn-ghost btn-sm">View</Link>
                          <Link href={`/invoices/${inv.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
    </>
  )
}
