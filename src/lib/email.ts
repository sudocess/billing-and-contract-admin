import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

interface SendInvoiceEmailOptions {
  to: string
  subject: string
  message: string
  invoiceHtml: string
  pdfBuffer: Buffer
  pdfFilename: string
}

export async function sendInvoiceEmail(opts: SendInvoiceEmailOptions) {
  const html = buildEmailWrapper(opts.invoiceHtml, opts.message)

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Engaging UX Design <info@engaginguxdesign.com>',
    to: opts.to,
    subject: opts.subject,
    html,
    attachments: [
      {
        filename: opts.pdfFilename,
        content: opts.pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}

function buildEmailWrapper(invoiceBody: string, personalMessage: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0e8de;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e8de;padding:32px 0;">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(28,16,8,0.08);">

<!-- Header -->
<tr><td style="background:#3b2110;padding:28px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:bold;color:#f7ede2;letter-spacing:0.02em;">Engaging UX Design</td>
    <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:rgba(247,237,226,0.6);">engaginguxdesign.com</td>
  </tr>
  </table>
</td></tr>

<!-- Personal message -->
<tr><td style="padding:28px 32px 8px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3b2110;line-height:1.65;white-space:pre-line;">${escapeHtml(personalMessage)}</div>
</td></tr>

<!-- Invoice summary -->
<tr><td style="padding:16px 32px;">
  <div style="background:#f7ede2;border-radius:8px;padding:20px 24px;border:1px solid rgba(59,33,16,0.1);">
    ${invoiceBody}
  </div>
</td></tr>

<!-- PDF note -->
<tr><td style="padding:16px 32px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a5a40;background:#fff3e0;border-left:3px solid #b5590a;padding:10px 14px;border-radius:0 6px 6px 0;">
    📎 Please find the full invoice attached as a PDF document.
  </div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid rgba(59,33,16,0.1);">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7a5a40;line-height:1.6;">
    <strong style="color:#3b2110;">Engaging UX Design</strong><br>
    engaginguxdesign.com · info@engaginguxdesign.com · +31 6 17 60 24 41
  </div>
</td></tr>

</table>

</td></tr>
</table>
</body></html>`
}

export function buildInvoiceSummaryHTML(invoice: {
  invoiceNumber: string
  clientName: string
  invoiceDate: Date
  dueDate: Date
  grandTotal: number
  currency: string
  language: string
}): string {
  const isNL = invoice.language === 'nl'
  const dateFmt = (d: Date) => d.toLocaleDateString(isNL ? 'nl-NL' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Helvetica,Arial,sans-serif;">
    <tr>
      <td style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#7a5a40;padding-bottom:6px;">
        ${isNL ? 'Factuuroverzicht' : 'Invoice Summary'}
      </td>
    </tr>
    <tr><td style="padding:4px 0;font-size:13px;color:#3b2110;">
      <strong>${isNL ? 'Factuurnummer' : 'Invoice Number'}:</strong> ${escapeHtml(invoice.invoiceNumber)}
    </td></tr>
    <tr><td style="padding:4px 0;font-size:13px;color:#3b2110;">
      <strong>${isNL ? 'Klant' : 'Client'}:</strong> ${escapeHtml(invoice.clientName)}
    </td></tr>
    <tr><td style="padding:4px 0;font-size:13px;color:#3b2110;">
      <strong>${isNL ? 'Factuurdatum' : 'Issue Date'}:</strong> ${dateFmt(invoice.invoiceDate)}
    </td></tr>
    <tr><td style="padding:4px 0;font-size:13px;color:#3b2110;">
      <strong>${isNL ? 'Vervaldatum' : 'Due Date'}:</strong> <span style="color:#9b2226;font-weight:bold;">${dateFmt(invoice.dueDate)}</span>
    </td></tr>
    <tr><td style="padding:10px 0 0;font-size:16px;font-weight:bold;color:#1c1008;border-top:2px solid rgba(59,33,16,0.12);margin-top:8px;">
      ${isNL ? 'Totaal te betalen' : 'Total Due'}: ${invoice.currency}${invoice.grandTotal.toFixed(2)}
    </td></tr>
    </table>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* ─────────── Contract email ─────────── */

interface SendContractEmailOptions {
  to: string
  subject: string
  message: string
  contractSummaryHtml: string
  viewUrl: string
}

export async function sendContractEmail(opts: SendContractEmailOptions) {
  const html = buildContractEmailWrapper(opts.contractSummaryHtml, opts.message, opts.viewUrl)

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Engaging UX Design <info@engaginguxdesign.com>',
    to: opts.to,
    subject: opts.subject,
    html,
  })
}

export function buildContractSummaryHTML(input: {
  contractCode: string
  projectName: string | null
  clientName: string
  totalValue: number
  initFee: number
  phaseLabel: string
  language: string
}): string {
  const isNL = input.language === 'nl'
  const fmt = (n: number) => '€' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Helvetica,Arial,sans-serif;">
    <tr>
      <td style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#7a5a40;padding-bottom:6px;">
        ${isNL ? 'Contractoverzicht' : 'Contract Summary'}
      </td>
    </tr>
    <tr><td style="padding:4px 0;font-size:13px;color:#3b2110;">
      <strong>${isNL ? 'Contractnummer' : 'Contract Number'}:</strong> <span style="font-family:monospace;">${escapeHtml(input.contractCode)}</span>
    </td></tr>
    ${input.projectName ? `<tr><td style="padding:4px 0;font-size:13px;color:#3b2110;">
      <strong>${isNL ? 'Project' : 'Project'}:</strong> ${escapeHtml(input.projectName)}
    </td></tr>` : ''}
    <tr><td style="padding:4px 0;font-size:13px;color:#3b2110;">
      <strong>${isNL ? 'Klant' : 'Client'}:</strong> ${escapeHtml(input.clientName)}
    </td></tr>
    <tr><td style="padding:4px 0;font-size:13px;color:#3b2110;">
      <strong>${isNL ? 'Fase' : 'Phase'}:</strong> ${escapeHtml(input.phaseLabel)}
    </td></tr>
    ${input.initFee > 0 ? `<tr><td style="padding:4px 0;font-size:13px;color:#3b2110;">
      <strong>${isNL ? 'Aanvangshonorarium' : 'Initiation Fee'}:</strong> ${fmt(input.initFee)}
    </td></tr>` : ''}
    <tr><td style="padding:10px 0 0;font-size:16px;font-weight:bold;color:#1c1008;border-top:2px solid rgba(59,33,16,0.12);">
      ${isNL ? 'Totale waarde' : 'Total Contract Value'}: ${fmt(input.totalValue)}
    </td></tr>
    </table>`
}

function buildContractEmailWrapper(summaryBody: string, personalMessage: string, viewUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0e8de;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e8de;padding:32px 0;">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(28,16,8,0.08);">

<!-- Header -->
<tr><td style="background:#3b2110;padding:28px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:bold;color:#f7ede2;letter-spacing:0.02em;">Engaging UX Design</td>
    <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:rgba(247,237,226,0.6);">engaginguxdesign.com</td>
  </tr>
  </table>
</td></tr>

${personalMessage ? `<!-- Personal message -->
<tr><td style="padding:28px 32px 8px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3b2110;line-height:1.65;white-space:pre-line;">${escapeHtml(personalMessage)}</div>
</td></tr>` : ''}

<!-- Contract summary -->
<tr><td style="padding:16px 32px;">
  <div style="background:#f7ede2;border-radius:8px;padding:20px 24px;border:1px solid rgba(59,33,16,0.1);">
    ${summaryBody}
  </div>
</td></tr>

<!-- CTA -->
<tr><td align="center" style="padding:8px 32px 24px;">
  <a href="${viewUrl}" style="display:inline-block;background:#b5590a;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:8px;">
    Review &amp; sign your contract →
  </a>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#7a5a40;margin-top:10px;">
    Or open in your browser:<br>
    <a href="${viewUrl}" style="color:#b5590a;word-break:break-all;">${escapeHtml(viewUrl)}</a>
  </div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid rgba(59,33,16,0.1);">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7a5a40;line-height:1.6;">
    <strong style="color:#3b2110;">Engaging UX Design</strong><br>
    engaginguxdesign.com · info@engaginguxdesign.com · +31 6 17 60 24 41
  </div>
</td></tr>

</table>

</td></tr>
</table>
</body></html>`
}
