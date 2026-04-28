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

const fmtEur = (n: number) => `€${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

function fmtDate(s?: string | null): string {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return s
  }
}

export function buildContractSignaturePdf(data: ContractPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 595 - 120

    // ── Header ──────────────────────────────────────────────────────────
    doc
      .fontSize(8)
      .fillColor('#999999')
      .font('Helvetica-Bold')
      .text('ENGAGING UX DESIGN — SERVICE AGREEMENT', { characterSpacing: 1 })

    doc.moveDown(0.3)
    doc
      .fontSize(18)
      .fillColor('#1a1a1a')
      .font('Helvetica-Bold')
      .text(data.projectName || 'Service Agreement')

    doc.moveDown(0.2)
    doc
      .fontSize(9)
      .fillColor('#888888')
      .font('Helvetica')
      .text(`Reference: ${data.contractCode}   ·   Date: ${fmtDate(new Date().toISOString())}`)

    doc.moveDown(0.8)
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#dddddd').lineWidth(1).stroke()
    doc.moveDown(0.8)

    // ── Parties ──────────────────────────────────────────────────────────
    doc
      .fontSize(7)
      .fillColor('#999999')
      .font('Helvetica-Bold')
      .text('PARTIES', { characterSpacing: 1.5 })
    doc.moveDown(0.4)

    // Two-column layout
    const colLeft = 60
    const colRight = 310
    const partyStartY = doc.y

    doc.fontSize(9).fillColor('#1a1a1a').font('Helvetica-Bold').text('Service Provider', colLeft, partyStartY)
    doc.fontSize(9).fillColor('#333333').font('Helvetica')
    doc.text('Engaging UX Design', colLeft)
    doc.text('Cess Garcia', colLeft)
    doc.text('info@engaginguxdesign.com', colLeft)

    doc.fontSize(9).fillColor('#1a1a1a').font('Helvetica-Bold').text('Client', colRight, partyStartY)
    doc.fontSize(9).fillColor('#333333').font('Helvetica')
    doc.text(data.clientCompany || data.clientName, colRight)
    if (data.clientCompany) doc.text(data.clientName, colRight)
    if (data.clientEmail) doc.text(data.clientEmail, colRight)
    if (data.clientAddress) doc.text(data.clientAddress, colRight)
    if (data.clientCity || data.clientCountry) {
      doc.text([data.clientCity, data.clientCountry].filter(Boolean).join(', '), colRight)
    }

    doc.moveDown(1.5)
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#dddddd').lineWidth(1).stroke()
    doc.moveDown(0.8)

    // ── Project Scope ────────────────────────────────────────────────────
    doc
      .fontSize(7)
      .fillColor('#999999')
      .font('Helvetica-Bold')
      .text('PROJECT SCOPE', { characterSpacing: 1.5 })
    doc.moveDown(0.4)

    doc.fontSize(9).fillColor('#333333').font('Helvetica')
    doc.text(`Phase:  ${data.phaseLabel}`)
    doc.text(`Start:  ${fmtDate(data.phaseStart)}   ·   End: ${fmtDate(data.phaseEnd)}`)

    if (data.deliverables) {
      doc.moveDown(0.4)
      doc.font('Helvetica-Bold').fillColor('#1a1a1a').text('Deliverables:')
      doc.font('Helvetica').fillColor('#333333').text(data.deliverables, { indent: 12, width: W })
    }

    doc.moveDown(1)
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#dddddd').lineWidth(1).stroke()
    doc.moveDown(0.8)

    // ── Payment schedule ─────────────────────────────────────────────────
    doc
      .fontSize(7)
      .fillColor('#999999')
      .font('Helvetica-Bold')
      .text('PAYMENT SCHEDULE', { characterSpacing: 1.5 })
    doc.moveDown(0.4)

    doc.fontSize(9).fillColor('#333333').font('Helvetica')
    if (data.p1 > 0) doc.text(`Payment 1 — Before work begins:   ${fmtEur(data.p1)}`)
    if (data.p2 > 0) doc.text(`Payment 2 — At agreed midpoint:   ${fmtEur(data.p2)}`)
    if (data.p3 > 0) doc.text(`Payment 3 — On final delivery:   ${fmtEur(data.p3)}`)

    doc.moveDown(0.4)
    doc
      .fontSize(10)
      .fillColor('#1a1a1a')
      .font('Helvetica-Bold')
      .text(`Total contract value:   ${fmtEur(data.totalValue)}`)

    if (data.initFee > 0) {
      doc
        .fontSize(8)
        .fillColor('#888888')
        .font('Helvetica')
        .text(`(includes initial fee of ${fmtEur(data.initFee)})`)
    }

    doc.moveDown(1)
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#dddddd').lineWidth(1).stroke()
    doc.moveDown(0.8)

    // ── Agreement statement ───────────────────────────────────────────────
    doc
      .fontSize(8.5)
      .fillColor('#444444')
      .font('Helvetica')
      .text(
        'By signing below, the Client confirms that they have read, understood, and agree to the full terms and conditions ' +
        'of this service agreement as prepared by Engaging UX Design. The full agreement document is binding upon signature.',
        { align: 'justify', width: W },
      )

    doc.moveDown(2)
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#dddddd').lineWidth(1).stroke()
    doc.moveDown(1.5)

    // ── Signature block ───────────────────────────────────────────────────
    // Anchor strings are detected by DocuSign to place sign-here / date tabs
    const sigY = doc.y

    // Client signature
    doc
      .fontSize(7)
      .fillColor('#999999')
      .font('Helvetica-Bold')
      .text('CLIENT SIGNATURE', colLeft, sigY, { characterSpacing: 1.5 })

    doc.moveDown(2.5)
    doc.moveTo(colLeft, doc.y).lineTo(colLeft + 200, doc.y).strokeColor('#1a1a1a').lineWidth(0.5).stroke()
    doc.moveDown(0.3)
    doc.fontSize(8).fillColor('#888888').font('Helvetica').text(data.clientName, colLeft)

    // Date
    doc
      .fontSize(7)
      .fillColor('#999999')
      .font('Helvetica-Bold')
      .text('DATE SIGNED', colRight, sigY, { characterSpacing: 1.5 })

    doc.moveDown(2.5)
    doc.moveTo(colRight, doc.y - 14).lineTo(colRight + 140, doc.y - 14).strokeColor('#1a1a1a').lineWidth(0.5).stroke()

    doc.end()
  })
}
