'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SendModal from '@/components/SendModal'

interface InvoiceActionsProps {
  invoice: {
    id: string
    invoiceNumber: string
    clientEmail: string
    clientName: string
    language: string
    status: string
  }
}

export default function InvoiceActions({ invoice }: InvoiceActionsProps) {
  const router = useRouter()
  const [sendModal, setSendModal] = useState(false)
  const [toast, setToast] = useState('')

  const markPaid = async () => {
    await fetch(`/api/invoices/${invoice.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID', paidAt: new Date().toISOString() }),
    })
    router.refresh()
  }

  return (
    <>
      {invoice.status !== 'PAID' && (
        <button className="btn btn-success btn-sm" onClick={markPaid}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          Mark Paid
        </button>
      )}
      <button className="btn btn-primary" onClick={() => setSendModal(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        Send Invoice
      </button>

      {sendModal && (
        <SendModal
          invoiceId={invoice.id}
          clientEmail={invoice.clientEmail}
          clientName={invoice.clientName}
          invoiceNumber={invoice.invoiceNumber}
          language={invoice.language}
          onClose={() => setSendModal(false)}
          onSent={() => {
            setSendModal(false)
            setToast('Invoice sent successfully!')
            router.refresh()
            setTimeout(() => setToast(''), 3500)
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-brown-mid text-brown-pale px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-2.5 z-[300] toast-enter font-semibold text-sm">
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          {toast}
        </div>
      )}
    </>
  )
}
