import InvoiceForm from '@/components/InvoiceForm'

export default function NewInvoicePage() {
  return (
    <>
      {/* Topbar */}
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <h1 className="font-heading text-lg font-extrabold text-brown-dark">New Invoice</h1>
      </div>
      <div className="p-4 sm:p-7 flex-1">
        <InvoiceForm />
      </div>
    </>
  )
}
