import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'
import { labels, type Language } from './labels'

interface PdfInvoice {
  invoiceNumber: string
  status: string
  clientName: string
  clientEmail: string
  clientContact: string | null
  clientPhone: string | null
  clientAddress: string | null
  clientCity: string | null
  clientCountry: string
  clientVat: string | null
  invoiceDate: Date
  dueDate: Date
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
  items: {
    description: string
    quantity: number
    unitPrice: number
    vatRate: number
    amount: number
  }[]
}

export async function generateInvoicePdf(invoice: PdfInvoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const lang = (invoice.language || 'en') as Language
    const t = labels[lang]
    const c = invoice.currency || '€'
    const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const dateFmt = (d: Date) => d.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

    const pageW = 595.28
    const margin = 50
    const headerHeight = 140

    // ── HEADER BAR ──
    doc.rect(0, 0, pageW, headerHeight).fill('#3b2110')

    const svgLogoPath = path.join(process.cwd(), 'public', 'engaginguxdesign-logo-white.svg')
    const pngLogoPath = path.join(process.cwd(), 'public', 'logo-white.png')
    const hasSvgLogo = fs.existsSync(svgLogoPath)
    const hasPngLogo = fs.existsSync(pngLogoPath)

    if (hasSvgLogo) {
      const svgMarkup = fs.readFileSync(svgLogoPath, 'utf8')
      SVGtoPDF(doc, svgMarkup, margin, 26, { width: 180, height: 44, preserveAspectRatio: 'xMinYMin meet' })
    } else if (hasPngLogo) {
      doc.image(pngLogoPath, margin, 26, { fit: [180, 44] })
    } else {
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#f7ede2')
        .text('Engaging UX Design', margin, 30)
    }

    const contactStartY = hasSvgLogo || hasPngLogo ? 72 : 52
    doc.font('Helvetica').fontSize(8).fillColor('#c4b5a5')
      .text('engaginguxdesign.com', margin, contactStartY)
      .text('info@engaginguxdesign.com · +31 6 17 60 24 41', margin, contactStartY + 10)
    if (invoice.ownVat) doc.text(`${t.vatNo}: ${invoice.ownVat}`, margin, contactStartY + 20)
    if (invoice.ownKvk) doc.text(`${t.kvk}: ${invoice.ownKvk}`, margin, contactStartY + 30)

    doc.font('Helvetica-Bold').fontSize(28).fillColor('#f7ede2')
      .text(t.invoice, pageW - margin - 200, 28, { width: 200, align: 'right' })
    doc.font('Helvetica').fontSize(10).fillColor('#c4b5a5')
      .text(invoice.invoiceNumber, pageW - margin - 200, 62, { width: 200, align: 'right' })

    // ── BILL TO / INVOICE META ──
    const contentStartY = headerHeight + 20
    let y = contentStartY

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#7a5a40')
      .text(t.to.toUpperCase(), margin, y)
    y += 14
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1c1008')
      .text(invoice.clientName, margin, y)
    y += 16
    doc.font('Helvetica').fontSize(9).fillColor('#3b2110')
    if (invoice.clientContact) { doc.text(invoice.clientContact, margin, y); y += 13 }
    if (invoice.clientEmail) { doc.text(invoice.clientEmail, margin, y); y += 13 }
    if (invoice.clientAddress) { doc.text(invoice.clientAddress, margin, y); y += 13 }
    if (invoice.clientCity) { doc.text(invoice.clientCity, margin, y); y += 13 }
    doc.text(invoice.clientCountry, margin, y); y += 13
    if (invoice.clientVat) { doc.text(`${t.vatNo}: ${invoice.clientVat}`, margin, y); y += 13 }

    // Right column: invoice meta
    const rightX = 360
    let ry = contentStartY

    const metaField = (label: string, value: string, color?: string) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#7a5a40')
        .text(label.toUpperCase(), rightX, ry)
      ry += 13
      doc.font('Helvetica-Bold').fontSize(10).fillColor(color || '#1c1008')
        .text(value, rightX, ry)
      ry += 18
    }

    metaField(t.invNo, invoice.invoiceNumber)
    metaField(t.date, dateFmt(invoice.invoiceDate))
    metaField(t.due, dateFmt(invoice.dueDate), '#9b2226')
    if (invoice.reference) metaField(t.ref, invoice.reference)

    // ── LINE ITEMS TABLE ──
    y = Math.max(y, ry) + 20

    // Table header
    const colX = [margin, 300, 360, 420, pageW - margin]
    const colW = [250, 60, 60, 60, 65]

    doc.rect(margin, y, pageW - margin * 2, 22).fill('#f7ede2')
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#7a5a40')
    doc.text(t.desc.toUpperCase(), colX[0] + 8, y + 7)
    doc.text(t.qty.toUpperCase(), colX[1], y + 7, { width: colW[1], align: 'center' })
    doc.text(t.unit.toUpperCase(), colX[2], y + 7, { width: colW[2], align: 'right' })
    doc.text(t.vat.toUpperCase(), colX[3], y + 7, { width: colW[3], align: 'center' })
    doc.text(t.amount.toUpperCase(), colX[4] - colW[4], y + 7, { width: colW[4], align: 'right' })
    y += 22

    // Table rows
    doc.font('Helvetica').fontSize(9).fillColor('#1c1008')
    for (const item of invoice.items) {
      if (y > 700) { doc.addPage(); y = 50 }
      doc.text(item.description, colX[0] + 8, y + 8, { width: colW[0] - 8 })
      doc.text(String(item.quantity), colX[1], y + 8, { width: colW[1], align: 'center' })
      doc.text(`${c}${fmt(item.unitPrice)}`, colX[2], y + 8, { width: colW[2], align: 'right' })
      doc.text(`${item.vatRate}%`, colX[3], y + 8, { width: colW[3], align: 'center' })
      doc.font('Helvetica-Bold')
        .text(`${c}${fmt(item.amount)}`, colX[4] - colW[4], y + 8, { width: colW[4], align: 'right' })
      doc.font('Helvetica')
      y += 26
      doc.moveTo(margin, y).lineTo(pageW - margin, y).lineWidth(0.5).strokeColor('#e0d0c0').stroke()
    }

    // ── TOTALS ──
    y += 16
    const totX = 370
    const totW = pageW - margin - totX

    const totRow = (label: string, value: string, bold?: boolean) => {
      if (bold) doc.font('Helvetica-Bold').fontSize(12)
      else doc.font('Helvetica').fontSize(9)
      doc.fillColor('#5c3a28').text(label, totX, y)
      doc.fillColor('#1c1008').text(value, totX, y, { width: totW, align: 'right' })
      y += bold ? 20 : 16
    }

    totRow(t.subtotal, `${c}${fmt(invoice.subtotal)}`)

    // VAT breakdown
    const vatMap: Record<number, number> = {}
    for (const item of invoice.items) {
      const net = item.quantity * item.unitPrice
      vatMap[item.vatRate] = (vatMap[item.vatRate] || 0) + net * (item.vatRate / 100)
    }
    for (const [rate, amount] of Object.entries(vatMap)) {
      totRow(`${t.vat} ${rate}%`, `${c}${fmt(amount as number)}`)
    }

    doc.moveTo(totX, y).lineTo(pageW - margin, y).lineWidth(1.5).strokeColor('#3b2110').stroke()
    y += 8
    totRow(t.total, `${c}${fmt(invoice.grandTotal)}`, true)

    // ── VAT TREATMENT NOTE ──
    const vatNote = invoice.vatTreatment === 'reverse' ? t.reverseCharge
      : invoice.vatTreatment === 'exempt' ? t.vatExempt
      : invoice.vatTreatment === 'export' ? t.noVat : ''

    if (vatNote) {
      y += 4
      doc.rect(margin, y, pageW - margin * 2, 24).fill('#fff3e0')
      doc.rect(margin, y, 3, 24).fill('#b5590a')
      doc.font('Helvetica').fontSize(8).fillColor('#7a3a08')
        .text(vatNote, margin + 12, y + 7, { width: pageW - margin * 2 - 20 })
      y += 32
    }

    // ── PAYMENT DETAILS ──
    if (invoice.iban) {
      if (y > 680) { doc.addPage(); y = 50 }
      y += 8
      doc.rect(margin, y, pageW - margin * 2, 80).fill('#f0e4d8')
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#7a5a40')
        .text(t.bank.toUpperCase(), margin + 14, y + 10)
      doc.font('Helvetica').fontSize(9).fillColor('#3b2110')
      let bankY = y + 24
      if (invoice.accountHolder) { doc.text(invoice.accountHolder, margin + 14, bankY); bankY += 14 }
      doc.font('Helvetica-Bold').text(`${t.iban}: `, margin + 14, bankY, { continued: true })
      doc.font('Helvetica').text(invoice.iban); bankY += 14
      if (invoice.bic) {
        doc.font('Helvetica-Bold').text(`${t.bic}: `, margin + 14, bankY, { continued: true })
        doc.font('Helvetica').text(invoice.bic); bankY += 14
      }
      if (invoice.paymentRef) {
        doc.font('Helvetica-Bold').text(`${t.paymentRef}: `, margin + 14, bankY, { continued: true })
        doc.font('Helvetica').text(invoice.paymentRef)
      }
      y += 88
    }

    // ── TERMS & LATE FEE ──
    if (invoice.paymentTerms) {
      doc.font('Helvetica').fontSize(8).fillColor('#5c3a28')
        .text(`${t.terms}: ${invoice.paymentTerms}`, margin, y + 4)
      y += 16
    }

    const feeNote = invoice.lateFee === '1% per month' ? t.lateFee1
      : invoice.lateFee === '8% per annum' ? t.lateFee8 : ''
    if (feeNote) {
      doc.font('Helvetica').fontSize(7.5).fillColor('#7a5a40').text(feeNote, margin, y)
      y += 14
    }

    // ── NOTES ──
    if (invoice.notes) {
      doc.moveTo(margin, y + 4).lineTo(pageW - margin, y + 4).lineWidth(0.5).strokeColor('#e0d0c0').stroke()
      y += 12
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#5c3a28')
        .text(`${t.notes}: `, margin, y, { continued: true })
      doc.font('Helvetica').text(invoice.notes)
      y += 20
    }

    // ── FOOTER ──
    const footerY = 800
    doc.moveTo(margin, footerY).lineTo(pageW - margin, footerY).lineWidth(0.5).strokeColor('#e0d0c0').stroke()
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1c1008')
      .text('Engaging UX Design', margin, footerY + 8, { continued: true })
    doc.font('Helvetica').fontSize(7.5).fillColor('#7a5a40')
      .text('  ·  engaginguxdesign.com  ·  info@engaginguxdesign.com  ·  +31 6 17 60 24 41')

    doc.end()
  })
}
