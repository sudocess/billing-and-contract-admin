import Link from 'next/link'
import { notFound } from 'next/navigation'
import InvoicePreview from '@/components/InvoicePreview'
import StatusBadge from '@/components/StatusBadge'
import { prisma } from '@/lib/prisma'
import InvoiceActions from './InvoiceActions'

export const dynamic = 'force-dynamic'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  })

  if (!invoice) notFound()

  return (
    <>
        {/* Topbar */}
        <div className="bg-white px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
          <div>
            <h1 className="font-heading text-lg font-extrabold text-brown-dark">
              Invoice {invoice.invoiceNumber}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={invoice.status} />
              <span className="text-xs text-brown-subtle">
                {invoice.clientName}
              </span>
            </div>
          </div>
          <div className="flex gap-2.5">
            <Link href={`/invoices/${id}/edit`} className="btn btn-ghost">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Edit
            </Link>
            <a href={`/api/invoices/${id}/pdf`} target="_blank" className="btn btn-secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
              Download PDF
            </a>
            <InvoiceActions invoice={JSON.parse(JSON.stringify(invoice))} />
          </div>
        </div>

        <div className="p-7 flex-1">
          <InvoicePreview invoice={JSON.parse(JSON.stringify(invoice))} />
        </div>
    </>
  )
}
