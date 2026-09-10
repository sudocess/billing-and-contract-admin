import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  // On 587 nodemailer will otherwise fall back to plaintext if STARTTLS fails. This
  // channel now carries login codes, so refuse to send rather than send in the clear.
  requireTLS: Number(process.env.SMTP_PORT) !== 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Fail fast and say why. The defaults are minutes long, far past the lifetime of a
  // serverless function, so a stalled handshake used to end as a gateway timeout with
  // no body at all, which reaches the operator as "Failed to send" and nothing more.
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
})

interface SendInvoiceEmailOptions {
  to: string
  subject: string
  message: string
  invoiceHtml: string
  pdfBuffer: Buffer
  pdfFilename: string
  /** Optional payment-request block, already validated and rendered. */
  paymentHtml?: string
}

export async function sendInvoiceEmail(opts: SendInvoiceEmailOptions) {
  const html = buildEmailWrapper(opts.invoiceHtml, opts.message, opts.paymentHtml)

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

function buildEmailWrapper(invoiceBody: string, personalMessage: string, paymentBlock = ''): string {
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

${paymentBlock}

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
    engaginguxdesign.com · info@engaginguxdesign.com · +31 6 12 92 23 16
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

/**
 * The "pay this" block.
 *
 * Two rules hold this together, and both exist because an email from us carrying a
 * link and an amount is indistinguishable in form from a phishing attempt:
 *
 *   - the amount is printed next to the link, so a payment request built for the
 *     wrong figure is visible to the client rather than only to us; and
 *   - the destination is shown in full as readable text, never hidden behind a
 *     friendly label, so the client can see it is their own bank before clicking.
 *
 * The URL is checked against the provider allowlist before it ever reaches here.
 */
export function buildPaymentLinkHTML(input: {
  url: string
  amount: number
  currency: string
  language: string
}): string {
  const isNL = input.language === 'nl'
  const safeUrl = escapeHtml(input.url)
  const amount = `${input.currency}${input.amount.toFixed(2)}`

  return `
<tr><td style="padding:16px 32px 0;">
  <div style="background:#ffffff;border:1px solid rgba(59,33,16,0.14);border-radius:8px;padding:20px 24px;">
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#7a5a40;padding-bottom:10px;">
      ${isNL ? 'Betaalverzoek' : 'Payment request'}
    </div>
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3b2110;line-height:1.6;padding-bottom:14px;">
      ${isNL
        ? `Je kunt <strong>${amount}</strong> voldoen via het onderstaande betaalverzoek.`
        : `You can pay <strong>${amount}</strong> using the payment request below.`}
    </div>
    <div style="padding-bottom:12px;">
      <a href="${safeUrl}" style="display:inline-block;background:#8b3a1e;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:11px 22px;border-radius:6px;">
        ${isNL ? 'Betaal' : 'Pay'} ${amount}
      </a>
    </div>
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7a5a40;line-height:1.6;word-break:break-all;">
      ${isNL ? 'De link gaat naar' : 'This link goes to'}:<br>
      <span style="color:#3b2110;">${safeUrl}</span>
    </div>
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7a5a40;line-height:1.6;padding-top:10px;">
      ${isNL
        ? 'Controleer altijd of het bedrag klopt voordat je betaalt. Bij twijfel, neem contact met ons op via het nummer onderaan.'
        : 'Always check the amount before paying. If anything looks wrong, contact us on the number below.'}
    </div>
  </div>
</td></tr>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* ─────────── Signed contract confirmations ─────────── */

interface SendSignedConfirmationOptions {
  to: string
  clientName: string
  contractCode: string
  projectName: string | null
  signedAt: Date
  pdfBuffer: Buffer
}

export async function sendSignedConfirmationToClient(opts: SendSignedConfirmationOptions) {
  const firstName = opts.clientName.split(' ')[0]
  const dateFmt = opts.signedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0e8de;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e8de;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(28,16,8,0.08);">
<tr><td style="background:#1c1008;padding:28px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:bold;color:#f7ede2;">Engaging UX Design</td>
    <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:rgba(247,237,226,0.6);">engaginguxdesign.com</td>
  </tr></table>
</td></tr>
<tr><td style="padding:32px 32px 8px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:bold;color:#1c1008;margin-bottom:8px;">Contract signed ✓</div>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3b2110;line-height:1.65;">
    Hi ${escapeHtml(firstName)},<br><br>
    Thank you for signing your service agreement with Engaging UX Design. Your signed copy is attached to this email for your records.<br><br>
    <strong>Contract:</strong> <span style="font-family:monospace;">${escapeHtml(opts.contractCode)}</span><br>
    ${opts.projectName ? `<strong>Project:</strong> ${escapeHtml(opts.projectName)}<br>` : ''}
    <strong>Signed on:</strong> ${escapeHtml(dateFmt)}
  </div>
</td></tr>
<tr><td style="padding:16px 32px 32px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a5a40;background:#f7ede2;border-left:3px solid #8b3a1e;padding:10px 14px;border-radius:0 6px 6px 0;">
    📎 Your signed service agreement is attached as a PDF.
  </div>
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid rgba(59,33,16,0.1);">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7a5a40;line-height:1.6;">
    <strong style="color:#3b2110;">Engaging UX Design</strong><br>
    engaginguxdesign.com · info@engaginguxdesign.com · +31 6 12 92 23 16
  </div>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Engaging UX Design <info@engaginguxdesign.com>',
    to: opts.to,
    subject: `Signed: Service Agreement ${opts.contractCode} — Engaging UX Design`,
    html,
    attachments: [{
      filename: `Signed-Agreement-${opts.contractCode}.pdf`,
      content: opts.pdfBuffer,
      contentType: 'application/pdf',
    }],
  })
}

interface SendSignedNotificationOptions {
  contractCode: string
  clientName: string
  clientEmail: string
  signedAt: Date
  signerIp: string
  pdfBuffer: Buffer
}

export async function sendSignedNotificationToAdmin(opts: SendSignedNotificationOptions) {
  const dateFmt = opts.signedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const timeFmt = opts.signedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0e8de;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e8de;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(28,16,8,0.08);">
<tr><td style="background:#1c1008;padding:28px 32px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:bold;color:#f7ede2;">Contract signed — Admin notification</div>
</td></tr>
<tr><td style="padding:28px 32px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3b2110;line-height:1.8;">
    <strong>Contract:</strong> <span style="font-family:monospace;">${escapeHtml(opts.contractCode)}</span><br>
    <strong>Client:</strong> ${escapeHtml(opts.clientName)}<br>
    <strong>Email:</strong> ${escapeHtml(opts.clientEmail)}<br>
    <strong>Signed:</strong> ${escapeHtml(dateFmt)} at ${escapeHtml(timeFmt)}<br>
    <strong>IP address:</strong> <span style="font-family:monospace;">${escapeHtml(opts.signerIp)}</span>
  </div>
</td></tr>
<tr><td style="padding:0 32px 28px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a5a40;background:#f7ede2;border-left:3px solid #8b3a1e;padding:10px 14px;border-radius:0 6px 6px 0;">
    📎 Signed contract attached.
  </div>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`

  const adminEmail = process.env.SMTP_USER || 'info@engaginguxdesign.com'
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Engaging UX Design <info@engaginguxdesign.com>',
    to: adminEmail,
    subject: `✓ Contract signed: ${opts.contractCode} — ${opts.clientName}`,
    html,
    attachments: [{
      filename: `Signed-Agreement-${opts.contractCode}.pdf`,
      content: opts.pdfBuffer,
      contentType: 'application/pdf',
    }],
  })
}

/* ─────────── Contract email ─────────── */

interface SendContractEmailOptions {
  to: string
  subject: string
  message: string
  contractSummaryHtml: string
  viewUrl: string
  /**
   * What the button says. It has to match where the button goes: the signing route
   * links to a page with a real signature field, the send-to-client route links to a
   * read-only preview that tells the reader to reply by email. Both used to promise
   * "Review & sign your contract", so half the clients who clicked it found no way to
   * sign and no explanation.
   */
  ctaLabel?: string
}

export async function sendContractEmail(opts: SendContractEmailOptions) {
  const html = buildContractEmailWrapper(
    opts.contractSummaryHtml,
    opts.message,
    opts.viewUrl,
    opts.ctaLabel || 'Review your contract',
  )

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

function buildContractEmailWrapper(
  summaryBody: string,
  personalMessage: string,
  viewUrl: string,
  ctaLabel: string,
): string {
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
    ${escapeHtml(ctaLabel)} →
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
    engaginguxdesign.com · info@engaginguxdesign.com · +31 6 12 92 23 16
  </div>
</td></tr>

</table>

</td></tr>
</table>
</body></html>`
}

/* ────────────────────────────────────────────────────────────────────────────
   Admin login code
   ──────────────────────────────────────────────────────────────────────────── */

interface SendLoginCodeOptions {
  to: string
  code: string
  ttlMinutes: number
  device: string
}

/**
 * Second factor for the admin panel. Deliberately plain: no tracking pixel, no
 * click-through link, nothing that could be phished into a one-click approval.
 */
export async function sendLoginCodeEmail(opts: SendLoginCodeOptions) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Engaging UX Design <info@engaginguxdesign.com>',
    to: opts.to,
    subject: `${opts.code} is your Engaging UX Design login code`,
    text: [
      `Your login code is ${opts.code}`,
      '',
      `It expires in ${opts.ttlMinutes} minutes and can only be used once.`,
      `Requested from: ${opts.device}`,
      '',
      'If you did not try to sign in, someone knows your password — change it immediately.',
    ].join('\n'),
    html: buildLoginCodeEmail(opts),
  })
}

function buildLoginCodeEmail(opts: SendLoginCodeOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0e8de;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e8de;padding:32px 0;">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(28,16,8,0.08);">

<!-- Header -->
<tr><td style="background:#3b2110;padding:28px 32px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:bold;color:#f7ede2;letter-spacing:0.02em;">Engaging UX Design</div>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:rgba(247,237,226,0.6);margin-top:2px;">Billing &amp; Contract Admin</div>
</td></tr>

<!-- Code -->
<tr><td style="padding:32px 32px 8px;" align="center">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3b2110;line-height:1.65;">Your login code:</div>
  <div style="font-family:'Courier New',Courier,monospace;font-size:38px;font-weight:bold;letter-spacing:0.32em;color:#3b2110;background:#f7ede2;border:1px solid rgba(59,33,16,0.12);border-radius:10px;padding:18px 12px 18px 24px;margin:16px 0 8px;">${escapeHtml(opts.code)}</div>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a5a40;">Expires in ${opts.ttlMinutes} minutes · single use</div>
</td></tr>

<!-- Context -->
<tr><td style="padding:16px 32px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a5a40;line-height:1.6;background:#f7ede2;border-radius:8px;padding:14px 18px;">
    <strong style="color:#3b2110;">Requested from:</strong> ${escapeHtml(opts.device)}
  </div>
</td></tr>

<!-- Warning -->
<tr><td style="padding:8px 32px 24px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a5a40;background:#fff3e0;border-left:3px solid #b5590a;padding:10px 14px;border-radius:0 6px 6px 0;line-height:1.6;">
    Didn't try to sign in? Then someone has your password. Change it as soon as you can — this code alone will not let them in.
  </div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid rgba(59,33,16,0.1);">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7a5a40;line-height:1.6;">
    <strong style="color:#3b2110;">Engaging UX Design</strong><br>
    engaginguxdesign.com · info@engaginguxdesign.com
  </div>
</td></tr>

</table>

</td></tr>
</table>
</body></html>`
}

interface SendNewDeviceAlertOptions {
  to: string
  device: string
  trustDays: number
}

/**
 * Sent whenever a browser is newly trusted. This is the only signal the owner gets
 * that someone has opened a password-only window, so it is deliberately not optional.
 */
export async function sendNewDeviceAlertEmail(opts: SendNewDeviceAlertOptions) {
  const when = new Date().toLocaleString('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Amsterdam',
  })

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Engaging UX Design <info@engaginguxdesign.com>',
    to: opts.to,
    subject: 'New browser trusted on your admin account',
    text: [
      `A new browser was just trusted on your Billing & Contract Admin account.`,
      '',
      `Browser: ${opts.device}`,
      `When:    ${when} (Amsterdam)`,
      '',
      `For the next ${opts.trustDays} days that browser can sign in with your email and password alone, without an emailed code.`,
      '',
      `If this was not you, open Settings and use "Sign out everywhere" immediately, then change your password.`,
    ].join('\n'),
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0e8de;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e8de;padding:32px 0;">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(28,16,8,0.08);">

<tr><td style="background:#3b2110;padding:28px 32px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:bold;color:#f7ede2;letter-spacing:0.02em;">Engaging UX Design</div>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:rgba(247,237,226,0.6);margin-top:2px;">Security notice</div>
</td></tr>

<tr><td style="padding:28px 32px 8px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#3b2110;margin-bottom:10px;">A new browser was trusted on your account</div>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3b2110;line-height:1.65;">
    For the next ${opts.trustDays} days it can sign in with your email and password alone — no emailed code.
  </div>
</td></tr>

<tr><td style="padding:16px 32px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a5a40;line-height:1.8;background:#f7ede2;border-radius:8px;padding:16px 20px;">
    <strong style="color:#3b2110;">Browser:</strong> ${escapeHtml(opts.device)}<br>
    <strong style="color:#3b2110;">When:</strong> ${escapeHtml(when)} (Amsterdam)
  </div>
</td></tr>

<tr><td style="padding:8px 32px 24px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a5a40;background:#fff3e0;border-left:3px solid #b5590a;padding:10px 14px;border-radius:0 6px 6px 0;line-height:1.6;">
    <strong style="color:#3b2110;">Wasn't you?</strong> Open Settings → Trusted browsers and choose <em>Sign out everywhere</em>, then change your password. Someone else knows it.
  </div>
</td></tr>

<tr><td style="padding:20px 32px;border-top:1px solid rgba(59,33,16,0.1);">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7a5a40;line-height:1.6;">
    <strong style="color:#3b2110;">Engaging UX Design</strong><br>
    engaginguxdesign.com · info@engaginguxdesign.com
  </div>
</td></tr>

</table>

</td></tr>
</table>
</body></html>`,
  })
}
