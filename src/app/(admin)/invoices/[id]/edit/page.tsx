import { notFound } from 'next/navigation'
import InvoiceForm from '@/components/InvoiceForm'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  })

  if (!invoice) notFound()

  return (
    <>
      {/* Topbar */}
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <h1 className="font-heading text-lg font-extrabold text-brown-dark">
          Edit Invoice {invoice.invoiceNumber}
        </h1>
      </div>
      <div className="p-4 sm:p-7 flex-1">
        <InvoiceForm initialData={JSON.parse(JSON.stringify(invoice))} invoiceId={id} />
      </div>
    </>
  )
}
