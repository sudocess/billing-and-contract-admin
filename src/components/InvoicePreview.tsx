import Image from 'next/image'
import { labels, type Language } from '@/lib/labels'

interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  amount: number
}

interface InvoiceData {
  invoiceNumber: string
  clientName: string
  clientContact: string | null
  clientEmail: string
  clientAddress: string | null
  clientCity: string | null
  clientCountry: string
  clientVat: string | null
  invoiceDate: Date | string
  dueDate: Date | string
  reference: string | null
  paymentTerms: string
  currency: string
  language: string
  subtotal: number
  vatTotal: number
  grandTotal: number
  iban: string | null
  bic: string | null
  bankName: string | null
  accountHolder: string | null
  paymentRef: string | null
  ownVat: string | null
  ownKvk: string | null
  lateFee: string | null
  vatTreatment: string
  notes: string | null
  items: InvoiceItem[]
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v)
}

export default function InvoicePreview({ invoice }: { invoice: InvoiceData }) {
  const lang = (invoice.language || 'en') as Language
  const t = labels[lang]
  const c = invoice.currency || '€'
  const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const dateFmt = (d: Date | string) => {
    const dt = toDate(d)
    return dt.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const vatMap: Record<number, number> = {}
  invoice.items.forEach(item => {
    const net = item.quantity * item.unitPrice
    vatMap[item.vatRate] = (vatMap[item.vatRate] || 0) + net * (item.vatRate / 100)
  })

  const vatNote = invoice.vatTreatment === 'reverse' ? t.reverseCharge
    : invoice.vatTreatment === 'exempt' ? t.vatExempt
    : invoice.vatTreatment === 'export' ? t.noVat : ''

  const feeNote = invoice.lateFee === '1% per month' ? t.lateFee1
    : invoice.lateFee === '8% per annum' ? t.lateFee8 : ''

  return (
    <div className="bg-[#e8ddd4] p-6 rounded-xl">
      <div className="bg-white rounded-lg overflow-hidden shadow-lg max-w-[720px] mx-auto text-[0.88rem]">

        {/* Header */}
        <div className="inv-header">
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <Image
                src="/engaginguxdesign-logo-white.svg"
                alt="Engaging UX Design"
                width={210}
                height={58}
                className="object-contain"
                priority
              />
              <div className="text-[0.78rem] text-white/60 leading-relaxed mt-1.5">
                engaginguxdesign.com<br />
                info@engaginguxdesign.com<br />
                +31 6 17 60 24 41<br />
                {invoice.ownVat && <>{t.vatNo}: {invoice.ownVat}<br /></>}
                {invoice.ownKvk && <>{t.kvk}: {invoice.ownKvk}</>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-heading text-3xl font-black text-brown-pale tracking-tight">{t.invoice}</div>
              <div className="text-[0.8rem] text-white/55 mt-1">{invoice.invoiceNumber}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="inv-body">
          {/* Meta Grid */}
          <div className="grid grid-cols-2 gap-6 mb-7">
            <div>
              <div className="text-[0.7rem] font-extrabold uppercase tracking-widest text-brown-subtle mb-1.5">{t.to}</div>
              <div className="text-[0.88rem] text-brown-dark leading-relaxed">
                <strong className="text-[0.92rem] block mb-0.5">{invoice.clientName}</strong>
                {invoice.clientContact && <>{invoice.clientContact}<br /></>}
                {invoice.clientEmail && <>{invoice.clientEmail}<br /></>}
                {invoice.clientAddress && <>{invoice.clientAddress}<br /></>}
                {invoice.clientCity && <>{invoice.clientCity}<br /></>}
                {invoice.clientCountry}
                {invoice.clientVat && <><br />{t.vatNo}: {invoice.clientVat}</>}
              </div>
            </div>
            <div>
              <div className="text-[0.7rem] font-extrabold uppercase tracking-widest text-brown-subtle mb-1.5">{t.invNo}</div>
              <div className="text-[0.88rem] text-brown-dark mb-3"><strong>{invoice.invoiceNumber}</strong></div>
              <div className="text-[0.7rem] font-extrabold uppercase tracking-widest text-brown-subtle mb-1.5">{t.date}</div>
              <div className="text-[0.88rem] text-brown-dark mb-3">{dateFmt(invoice.invoiceDate)}</div>
              <div className="text-[0.7rem] font-extrabold uppercase tracking-widest text-brown-subtle mb-1.5">{t.due}</div>
              <div className="text-[0.88rem] text-danger font-bold mb-3">{dateFmt(invoice.dueDate)}</div>
              {invoice.reference && (
                <>
                  <div className="text-[0.7rem] font-extrabold uppercase tracking-widest text-brown-subtle mb-1.5">{t.ref}</div>
                  <div className="text-[0.88rem] text-brown-dark">{invoice.reference}</div>
                </>
              )}
            </div>
          </div>

          {/* Table */}
          <table className="inv-table">
            <thead>
              <tr>
                <th style={{ width: '42%' }}>{t.desc}</th>
                <th style={{ width: '8%', textAlign: 'center' }}>{t.qty}</th>
                <th style={{ width: '16%', textAlign: 'right' }}>{t.unit}</th>
                <th style={{ width: '10%', textAlign: 'center' }}>{t.vat}</th>
                <th style={{ width: '18%', textAlign: 'right' }}>{t.amount}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right tabular-nums">{c}{fmt(item.unitPrice)}</td>
                  <td className="text-center">{item.vatRate}%</td>
                  <td className="text-right font-bold tabular-nums">{c}{fmt(item.quantity * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="min-w-[240px]">
              <div className="flex justify-between py-1 text-[0.83rem] text-brown-muted">
                <span>{t.subtotal}</span>
                <span className="font-semibold text-brown-dark tabular-nums">{c}{fmt(invoice.subtotal)}</span>
              </div>
              {Object.entries(vatMap).map(([rate, amount]) => (
                <div key={rate} className="flex justify-between py-1 text-[0.83rem] text-brown-muted">
                  <span>{t.vat} {rate}%</span>
                  <span className="tabular-nums">{c}{fmt(amount)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2.5 mt-1.5 border-t-2 border-brown-dark/10 font-heading font-black text-base text-brown-dark">
                <span>{t.total}</span>
                <span className="tabular-nums">{c}{fmt(invoice.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* VAT Note */}
          {vatNote && (
            <div className="bg-warning-bg border-l-[3px] border-warning px-3.5 py-2.5 rounded-r-md text-[0.8rem] text-[#7a3a08] mb-4">
              {vatNote}
            </div>
          )}

          {/* Payment Details */}
          {invoice.iban && (
            <div className="bg-brown-light rounded-lg px-4 py-4 mb-4">
              <div className="text-[0.7rem] font-extrabold uppercase tracking-widest text-brown-subtle mb-2">{t.bank}</div>
              <div className="text-[0.85rem] text-brown-mid leading-relaxed">
                {invoice.accountHolder}<br />
                <strong>{t.iban}:</strong> {invoice.iban}<br />
                {invoice.bic && <><strong>{t.bic}:</strong> {invoice.bic}<br /></>}
                {invoice.bankName && <>{invoice.bankName}<br /></>}
                {invoice.paymentRef && <><strong>{t.paymentRef}:</strong> {invoice.paymentRef}</>}
              </div>
            </div>
          )}

          {/* Terms & Late Fee */}
          {invoice.paymentTerms && (
            <div className="text-[0.8rem] text-brown-muted mb-2"><strong>{t.terms}:</strong> {invoice.paymentTerms}</div>
          )}
          {feeNote && (
            <div className="text-[0.78rem] text-brown-subtle mb-2">{feeNote}</div>
          )}
          {invoice.notes && (
            <div className="text-[0.82rem] text-brown-muted mt-2 pt-3 border-t border-brown-dark/10">
              <strong>{t.notes}:</strong> {invoice.notes}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="inv-footer">
          <strong className="text-brown-dark">Engaging UX Design</strong>
          {' · engaginguxdesign.com · info@engaginguxdesign.com · +31 6 17 60 24 41'}
          {invoice.ownVat && ` · ${t.vatNo}: ${invoice.ownVat}`}
        </div>
      </div>
    </div>
  )
}
