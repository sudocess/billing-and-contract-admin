import PDFDocument from 'pdfkit'

export interface ContractPdfData {
  contractCode: string
  clientName: string
  clientCompany?: string | null
  clientEmail?: string | null
  clientAddress?: string | null
  clientCity?: string | null
  clientCountry?: string | null
  projectName?: string | null
  phaseLabel: string
  phaseStart?: string | null
  phaseEnd?: string | null
  deliverables?: string | null
  totalValue: number
  initFee: number
  p1: number
  p2: number
  p3: number
}

// Brand colours
const C = {
  dark:    '#1c1008',
  rust:    '#8b3a1e',
  cream:   '#f7ede2',
  border:  '#ecddd4',
  text:    '#3b2110',
  muted:   '#8a6a55',
  subtle:  '#9a7a65',
  headerAccent: '#c4a898',
  headerMuted:  '#7a5a48',
  idColor: '#d4bfb0',
  rowAlt:  '#fdf5ef',
}

const fmtEur = (n: number) => `€${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

function fmtDate(s?: string | null): string {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return s
  }
}

// Hex colour → pdfkit-compatible [r, g, b] or just pass the hex string
// pdfkit accepts '#rrggbb' strings directly

export function buildContractSignaturePdf(data: ContractPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const PAGE_W = 595.28
    const ML = 45            // left margin
    const MR = 45            // right margin
    const CW = PAGE_W - ML - MR  // content width ≈ 505

    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const today = fmtDate(new Date().toISOString())

    // ────────────────────────────────────────────────────────────────────
    // HEADER — dark branded bar
    // ────────────────────────────────────────────────────────────────────
    const HEADER_H = 72
    doc.rect(0, 0, PAGE_W, HEADER_H).fill(C.dark)

    // Brand name — left side
    doc.fontSize(7.5).fillColor(C.headerAccent).font('Helvetica-Bold')
       .text('ENGAGING UX DESIGN', ML, 20, { characterSpacing: 1.5, width: CW * 0.6 })
    doc.fontSize(7).fillColor(C.headerMuted).font('Helvetica')
       .text('SERVICE AGREEMENT', ML, 33, { characterSpacing: 0.8, width: CW * 0.6 })

    // Contract reference — right side
    doc.fontSize(8.5).fillColor(C.idColor).font('Helvetica')
       .text(data.contractCode, ML, 20, { align: 'right', width: CW, characterSpacing: 0.3 })
    doc.fontSize(7.5).fillColor(C.headerMuted).font('Helvetica')
       .text(today, ML, 33, { align: 'right', width: CW })

    // ────────────────────────────────────────────────────────────────────
    // TITLE BAR — cream background
    // ────────────────────────────────────────────────────────────────────
    const TITLE_H = 56
    doc.rect(0, HEADER_H, PAGE_W, TITLE_H).fill(C.cream)

    const projectName = data.projectName || 'Service Agreement'
    doc.fontSize(17).fillColor(C.dark).font('Helvetica-Bold')
       .text(projectName, ML, HEADER_H + 11, { width: CW })
    doc.fontSize(8.5).fillColor(C.muted).font('Helvetica')
       .text(`${data.phaseLabel}   ·   Reference: ${data.contractCode}`, ML, HEADER_H + 34, { width: CW })

    // ────────────────────────────────────────────────────────────────────
    // CONTENT — flowing sections
    // ────────────────────────────────────────────────────────────────────
    let y = HEADER_H + TITLE_H + 22

    // Thin separator line under title bar
    doc.moveTo(0, HEADER_H + TITLE_H).lineTo(PAGE_W, HEADER_H + TITLE_H)
       .strokeColor(C.border).lineWidth(0.5).stroke()

    // ─── helper: draw a rust-coloured section label with underline
    function sectionLabel(label: string) {
      doc.fontSize(7).fillColor(C.rust).font('Helvetica-Bold')
         .text(label, ML, y, { characterSpacing: 1.5, width: CW })
      y += 11
      doc.moveTo(ML, y).lineTo(PAGE_W - MR, y).strokeColor(C.border).lineWidth(0.5).stroke()
      y += 10
    }

    // ─── helper: horizontal divider with spacing
    function divider() {
      y += 12
      doc.moveTo(ML, y).lineTo(PAGE_W - MR, y).strokeColor(C.border).lineWidth(0.5).stroke()
      y += 14
    }

    // ── PARTIES ──────────────────────────────────────────────────────────
    sectionLabel('PARTIES')

    const colMid = PAGE_W / 2 + 10
    const partiesStartY = y

    // Provider (left column)
    doc.fontSize(8).fillColor(C.dark).font('Helvetica-Bold')
       .text('Service Provider', ML, partiesStartY)
    doc.fontSize(9).fillColor(C.text).font('Helvetica')
    let provY = partiesStartY + 13
    doc.text('Engaging UX Design', ML, provY); provY += 12
    doc.text('Cess Garcia - de Laat', ML, provY); provY += 12
    doc.text('info@engaginguxdesign.com', ML, provY); provY += 12

    // Client (right column)
    doc.fontSize(8).fillColor(C.dark).font('Helvetica-Bold')
       .text('Client', colMid, partiesStartY)
    doc.fontSize(9).fillColor(C.text).font('Helvetica')
    let cliY = partiesStartY + 13
    doc.text(data.clientCompany || data.clientName, colMid, cliY, { width: PAGE_W - MR - colMid }); cliY += 12
    if (data.clientCompany) { doc.text(data.clientName, colMid, cliY, { width: PAGE_W - MR - colMid }); cliY += 12 }
    if (data.clientEmail)   { doc.text(data.clientEmail, colMid, cliY, { width: PAGE_W - MR - colMid }); cliY += 12 }
    if (data.clientAddress) { doc.text(data.clientAddress, colMid, cliY, { width: PAGE_W - MR - colMid }); cliY += 12 }
    if (data.clientCity || data.clientCountry) {
      doc.text([data.clientCity, data.clientCountry].filter(Boolean).join(', '), colMid, cliY, { width: PAGE_W - MR - colMid })
      cliY += 12
    }

    y = Math.max(provY, cliY) + 4
    divider()

    // ── PROJECT SCOPE ─────────────────────────────────────────────────────
    sectionLabel('PROJECT SCOPE')

    doc.fontSize(9).fillColor(C.text).font('Helvetica')
    doc.text(`Phase:  ${data.phaseLabel}`, ML, y); y += 13
    doc.text(`Start:  ${fmtDate(data.phaseStart)}   ·   End: ${fmtDate(data.phaseEnd)}`, ML, y); y += 13

    if (data.deliverables) {
      y += 4
      doc.fontSize(8.5).fillColor(C.dark).font('Helvetica-Bold').text('Deliverables:', ML, y); y += 13
      doc.fontSize(9).fillColor(C.text).font('Helvetica')
         .text(data.deliverables, ML + 12, y, { width: CW - 12 })
      y = doc.y + 6
    } else {
      y += 4
    }

    divider()

    // ── PAYMENT SCHEDULE ──────────────────────────────────────────────────
    sectionLabel('PAYMENT SCHEDULE')

    // Table header row
    doc.rect(ML - 8, y - 2, CW + 16, 18).fill(C.cream)
    doc.fontSize(7.5).fillColor(C.muted).font('Helvetica-Bold')
    doc.text('MILESTONE', ML, y + 2, { width: 130 })
    doc.text('TIMING', ML + 135, y + 2, { width: 190 })
    doc.text('AMOUNT', ML, y + 2, { width: CW, align: 'right' })
    y += 20

    const payRows: [string, string, number][] = []
    if (data.p1 > 0) payRows.push(['Payment 1', 'Due before work begins', data.p1])
    if (data.p2 > 0) payRows.push(['Payment 2', 'Due at agreed midpoint', data.p2])
    if (data.p3 > 0) payRows.push(['Payment 3', 'Due before final delivery', data.p3])

    payRows.forEach((row, i) => {
      if (i % 2 === 1) {
        doc.rect(ML - 8, y - 2, CW + 16, 18).fill(C.rowAlt)
      }
      doc.fontSize(9).fillColor(C.text).font('Helvetica')
         .text(row[0], ML, y, { width: 130 })
         .text(row[1], ML + 135, y, { width: 190 })
      doc.fontSize(9).fillColor(C.dark).font('Helvetica-Bold')
         .text(fmtEur(row[2]), ML, y, { width: CW, align: 'right' })
      y += 18
    })

    // Total row (highlighted with rust accent)
    y += 4
    doc.rect(ML - 8, y - 3, CW + 16, 22).fill(C.cream)
    doc.moveTo(ML - 8, y - 3).lineTo(PAGE_W - MR + 8, y - 3)
       .strokeColor(C.rust).lineWidth(0.7).stroke()
    doc.fontSize(10).fillColor(C.rust).font('Helvetica-Bold')
       .text(`Total:  ${fmtEur(data.totalValue)}`, ML, y + 1, { width: CW, align: 'right' })
    y += 24

    if (data.initFee > 0) {
      doc.fontSize(8).fillColor(C.subtle).font('Helvetica')
         .text(`Includes non-refundable initiation fee of ${fmtEur(data.initFee)}`, ML, y, { width: CW, align: 'right' })
      y += 14
    }

    divider()

    // ── AGREEMENT STATEMENT ────────────────────────────────────────────────
    doc.fontSize(8.5).fillColor(C.text).font('Helvetica')
       .text(
         'By signing below, the Client confirms that they have read, understood, and agree to the full terms and ' +
         'conditions of this service agreement as prepared by Engaging UX Design. The full agreement document is ' +
         'binding upon signature.',
         ML, y, { align: 'justify', width: CW },
       )
    y = doc.y + 28

    // ── SIGNATURE BLOCK ────────────────────────────────────────────────────
    // DocuSign anchor strings — keep them intact so tabs auto-position
    const sigColLeft  = ML
    const sigColRight = ML + CW / 2 + 20
    const sigLineW    = 185
    const dateLineW   = 130

    // Labels in rust (match section style)
    doc.fontSize(7).fillColor(C.rust).font('Helvetica-Bold')
       .text('CLIENT SIGNATURE', sigColLeft, y, { characterSpacing: 1.5, width: sigLineW })
    doc.fontSize(7).fillColor(C.rust).font('Helvetica-Bold')
       .text('DATE SIGNED', sigColRight, y, { characterSpacing: 1.5, width: dateLineW })

    // Space where DocuSign places the signature image / date field
    y += 44
    doc.moveTo(sigColLeft, y).lineTo(sigColLeft + sigLineW, y)
       .strokeColor(C.dark).lineWidth(0.5).stroke()
    doc.moveTo(sigColRight, y).lineTo(sigColRight + dateLineW, y)
       .strokeColor(C.dark).lineWidth(0.5).stroke()

    y += 6
    doc.fontSize(8.5).fillColor(C.subtle).font('Helvetica')
       .text(data.clientName, sigColLeft, y, { width: sigLineW })

    // ── FOOTER BAR ─────────────────────────────────────────────────────────
    const FOOTER_Y = 841.89 - 32
    doc.rect(0, FOOTER_Y, PAGE_W, 32).fill(C.cream)
    doc.moveTo(0, FOOTER_Y).lineTo(PAGE_W, FOOTER_Y).strokeColor(C.border).lineWidth(0.5).stroke()
    doc.fontSize(7.5).fillColor(C.muted).font('Helvetica')
       .text('engaginguxdesign.com  ·  info@engaginguxdesign.com', ML, FOOTER_Y + 10, { width: CW * 0.6 })
    doc.fontSize(7.5).fillColor(C.subtle).font('Helvetica')
       .text(`Contract ID: ${data.contractCode}`, ML, FOOTER_Y + 10, { width: CW, align: 'right' })

    doc.end()
  })
}
