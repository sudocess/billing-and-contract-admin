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

/**
 * The wordmark, for the header of every email that reaches a client.
 *
 * Absolute and hard-coded rather than derived from the request, because an email is
 * read days after it is sent and the address has to keep resolving long after the
 * process that sent it is gone. Served from `public/`, which the auth proxy exempts by
 * file extension, so it needs no session. 300x84 for a 150x42 display size, so it stays
 * sharp on a phone.
 *
 * PNG, not the SVG that sits beside it: no mail client renders SVG.
 */
const EMAIL_LOGO = 'https://studio.engaginguxdesign.com/email-logo.png'

/**
 * Where "a client signed" notifications go unless Settings overrides it.
 *
 * Named rather than read from SMTP_USER. It resolved to the same address, but only
 * because the notification inbox and the sending mailbox happen to be the same one,
 * and changing which account the app sends from would then have silently moved where
 * these land.
 */
export const NOTIFY_DEFAULT = 'info@engaginguxdesign.com'

/**
 * Images are blocked by default in plenty of mail clients, so the alt text is the
 * header for a good share of readers. It carries the type styling the wordmark would
 * have had, which most clients apply to alt text, so a blocked image still reads as
 * the brand name rather than as a broken box.
 */
function logoImg(): string {
  return `<img src="${EMAIL_LOGO}" width="150" height="42" alt="Engaging UX Design" style="display:block;width:150px;height:42px;border:0;outline:none;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:19px;font-weight:bold;color:#f7ede2;">`
}

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
  ${logoImg()}
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#d9c3af;padding-top:8px;">engaginguxdesign.com</div>
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
  /**
   * Null where the render failed. The confirmation still goes out: telling the client
   * their signature was recorded matters more than the attachment, and withholding the
   * whole email over a missing file leaves them with no confirmation at all.
   */
  pdfBuffer: Buffer | null
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
  ${logoImg()}
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#d9c3af;padding-top:8px;">engaginguxdesign.com</div>
</td></tr>
<tr><td style="padding:32px 32px 8px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:bold;color:#1c1008;margin-bottom:8px;">Contract signed ✓</div>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3b2110;line-height:1.65;">
    Hi ${escapeHtml(firstName)},<br><br>
    Thank you for signing your service agreement with Engaging UX Design. ${opts.pdfBuffer
      ? 'Your signed copy is attached to this email for your records.'
      : 'Your signed copy will follow shortly in a separate email.'}<br><br>
    <strong>Contract:</strong> <span style="font-family:monospace;">${escapeHtml(opts.contractCode)}</span><br>
    ${opts.projectName ? `<strong>Project:</strong> ${escapeHtml(opts.projectName)}<br>` : ''}
    <strong>Signed on:</strong> ${escapeHtml(dateFmt)}
  </div>
</td></tr>
<tr><td style="padding:16px 32px 32px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a5a40;background:#f7ede2;border-left:3px solid #8b3a1e;padding:10px 14px;border-radius:0 6px 6px 0;">
    ${opts.pdfBuffer
      ? '&#128206; Your signed service agreement is attached as a PDF.'
      : 'Your signature was recorded successfully. The PDF copy could not be generated automatically and will be sent to you separately.'}
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
    subject: `Signed: Service Agreement ${opts.contractCode}, Engaging UX Design`,
    html,
    ...(opts.pdfBuffer
      ? {
          attachments: [{
            filename: `Signed-Agreement-${opts.contractCode}.pdf`,
            content: opts.pdfBuffer,
            contentType: 'application/pdf',
          }],
        }
      : {}),
  })
}

interface SendSignedNotificationOptions {
  contractCode: string
  clientName: string
  clientEmail: string
  signedAt: Date
  signerIp: string
  /** Null where the render failed; the notification still goes out. */
  pdfBuffer: Buffer | null
  /**
   * Where the notification goes. Empty means NOTIFY_DEFAULT.
   */
  to?: string
  /** Link straight to the contract in the admin app, so the mail is actionable. */
  contractUrl?: string
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
<tr><td style="background:#1c1008;padding:28px 24px;">
  ${logoImg()}
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:19px;font-weight:bold;color:#f7ede2;padding-top:14px;">Contract signed</div>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#d9c3af;padding-top:4px;">${escapeHtml(opts.clientName)} signed ${escapeHtml(opts.contractCode)}</div>
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
    ${opts.pdfBuffer
      ? 'The signed contract is attached, and the same copy is stored on the contract record.'
      : 'The signature is recorded, but the PDF could not be produced and is not attached. The contract page says so on its timeline.'}
  </div>
  ${opts.contractUrl ? `<div style="padding-top:18px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="#8b3a1e" style="background:#8b3a1e;border-radius:8px;">
        <a href="${escapeHtml(opts.contractUrl)}" style="display:block;padding:13px 24px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">Open the contract &rarr;</a>
      </td></tr>
    </table>
  </div>` : ''}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`

  const adminEmail = (opts.to || '').trim() || NOTIFY_DEFAULT
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Engaging UX Design <info@engaginguxdesign.com>',
    to: adminEmail,
    replyTo: opts.clientEmail || undefined,
    subject: `Signed: ${opts.contractCode}, ${opts.clientName}`,
    html,
    ...(opts.pdfBuffer
      ? {
          attachments: [{
            filename: `Signed-Agreement-${opts.contractCode}.pdf`,
            content: opts.pdfBuffer,
            contentType: 'application/pdf',
          }],
        }
      : {}),
  })
}

/* ─────────── Contract email ─────────── */

interface SendContractEmailOptions {
  to: string
  subject: string
  message: string
  contractSummaryHtml: string
  viewUrl: string
  contractCode: string
  language: string
  /**
   * Which of the two contract emails this is.
   *
   * Passed in rather than inferred from whether an expiry happens to be set, because
   * the copy and the promise differ: 'signature' links to a page with a real signature
   * field, 'readonly' links to a preview that cannot be signed and says to reply by
   * email instead. Both used to claim "Review & sign your contract", so half the
   * clients who clicked found no way to sign and no explanation.
   */
  variant: 'readonly' | 'signature'
  /** Signature variant only: when the link stops working. */
  expiresAt?: Date | null
  ctaLabel?: string
}

export async function sendContractEmail(opts: SendContractEmailOptions) {
  const html = buildContractEmailWrapper(
    opts.contractSummaryHtml,
    opts.message,
    opts.viewUrl,
    opts.ctaLabel || (opts.variant === 'signature' ? 'Review & sign your contract' : 'Review your contract'),
    {
      contractCode: opts.contractCode,
      language: opts.language === 'nl' ? 'nl' : 'en',
      variant: opts.variant,
      expiresAt: opts.expiresAt ?? null,
    },
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
  const fmt = (n: number) => '\u20ac' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const title = input.projectName
    ? escapeHtml(input.projectName)
    : (isNL ? 'Dienstverleningsovereenkomst' : 'Service agreement')

  /* Ordered by what a client actually needs first. The contract number used to sit at
     the top carrying the same weight as everything else; it is a lookup key for a
     support conversation, not the thing a first-time reader is looking for, so it now
     sits last and quiet, and the money is the number that carries the block. */
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Helvetica,Arial,sans-serif;">
    <tr><td style="font-size:11px;font-weight:bold;letter-spacing:0.08em;color:#7a5a40;padding-bottom:10px;">
      ${isNL ? 'CONTRACTOVERZICHT' : 'CONTRACT SUMMARY'}
    </td></tr>

    <tr><td style="padding-bottom:4px;font-size:19px;font-weight:bold;color:#1c1008;line-height:1.3;">
      ${title}
    </td></tr>
    <tr><td style="padding-bottom:16px;font-size:13px;color:#7a5a40;">
      ${isNL ? 'Voor' : 'For'} ${escapeHtml(input.clientName)}
    </td></tr>

    <tr><td style="border-top:1px solid rgba(59,33,16,0.14);padding-top:14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="font-size:11px;letter-spacing:0.06em;color:#7a5a40;padding-bottom:4px;">
          ${isNL ? 'TOTALE CONTRACTWAARDE' : 'TOTAL CONTRACT VALUE'}
        </td></tr>
        <tr><td style="font-size:26px;font-weight:bold;color:#1c1008;padding-bottom:${input.initFee > 0 ? '2px' : '14px'};">
          ${fmt(input.totalValue)}
        </td></tr>
        ${input.initFee > 0 ? `<tr><td style="font-size:12px;color:#7a5a40;padding-bottom:14px;">
          ${isNL
            ? `Inclusief een aanvangshonorarium van ${fmt(input.initFee)}`
            : `Includes an initiation fee of ${fmt(input.initFee)}`}
        </td></tr>` : ''}
      </table>
    </td></tr>

    <tr><td style="border-top:1px solid rgba(59,33,16,0.14);padding-top:14px;">
      <span style="display:inline-block;font-size:11px;font-weight:bold;color:#8b3a1e;background:#fdf0e8;border-radius:100px;padding:4px 12px;">
        ${escapeHtml(input.phaseLabel)}
      </span>
      <div style="padding-top:12px;font-size:12px;color:#7a5a40;">
        ${isNL ? 'Contractnr.' : 'Contract no.'}
        <span style="font-family:'Courier New',Courier,monospace;color:#7a5a40;">${escapeHtml(input.contractCode)}</span>
      </div>
    </td></tr>
    </table>`
}

/**
 * Let a long URL break where a URL is allowed to break.
 *
 * Two problems at once. `word-break:break-all` alone splits anywhere, so the link tore
 * the domain and the contract number mid-word and read as a corrupted string. But
 * `<wbr>` alone is not enough either: a 48-character signing token contains no slash
 * and no hyphen, so it stays one unbreakable run, and in table layout that run sets
 * the minimum width of the whole email. The card then renders 600px wide inside a
 * 360px phone and everything overflows off the right edge.
 *
 * So: break at every slash and hyphen, which is where a reader expects a URL to wrap,
 * and inside any run still longer than 24 characters break it up as well, which keeps
 * the minimum width small without touching the readable parts.
 */
function breakableUrl(escapedUrl: string): string {
  return escapedUrl
    .replace(/([/-])/g, '$1\u0000')
    .split('\u0000')
    .map(part => part.replace(/([^/-]{24})(?=[^/-])/g, '$1\u0000'))
    .join('\u0000')
    .split('\u0000')
    .join('<wbr>')
}

interface ContractEmailContext {
  contractCode: string
  language: 'en' | 'nl'
  variant: 'readonly' | 'signature'
  expiresAt?: Date | null
}

/** Exported so the rendered email can be inspected without sending one. */
export function buildContractEmailWrapper(
  summaryBody: string,
  personalMessage: string,
  viewUrl: string,
  ctaLabel: string,
  ctx: ContractEmailContext,
): string {
  const isNL = ctx.language === 'nl'
  const isSignature = ctx.variant === 'signature'
  const safeCode = escapeHtml(ctx.contractCode)
  // Escaped once, here, and used for both the href and the visible copy. The href was
  // previously interpolated raw while only the display text was escaped.
  const safeUrl = escapeHtml(viewUrl)
  const safeCta = escapeHtml(ctaLabel)

  const preheaderText = isNL
    ? isSignature
      ? `Je overeenkomst staat klaar om te ondertekenen. Contract ${safeCode}, geldig voor 14 dagen.`
      : `Je overeenkomst staat klaar om te bekijken. Contract ${safeCode}.`
    : isSignature
      ? `Your service agreement is ready to sign. Contract ${safeCode}, valid for 14 days.`
      : `Your service agreement is ready to review. Contract ${safeCode}.`

  const ctaHelperText = isNL
    ? isSignature
      ? 'Deze link opent een beveiligde pagina waar je de overeenkomst kunt bekijken en digitaal kunt ondertekenen.'
      : 'Deze link opent een alleen-lezen kopie. Wil je iets laten aanpassen of heb je een vraag? Antwoord gewoon op deze e-mail.'
    : isSignature
      ? 'This link opens a secure page where you can review the agreement and sign it electronically.'
      : 'This link opens a read-only copy. To request changes or ask a question, just reply to this email.'

  const fallbackLabel = isNL
    ? 'Werkt de knop niet? Kopieer deze link naar je browser:'
    : 'If the button does not work, copy this link into your browser:'

  const expiryNote = isSignature && ctx.expiresAt
    ? (() => {
        const when = ctx.expiresAt!.toLocaleDateString(isNL ? 'nl-NL' : 'en-GB', {
          day: '2-digit', month: 'long', year: 'numeric',
        })
        return isNL
          ? `Deze link is geldig tot ${when}. Vraag me daarna om hem opnieuw te sturen.`
          : `This link is valid until ${when}. After that, ask me to resend it.`
      })()
    : ''

  /* Three things about the markup below, since none of it can carry a comment:
     the wordmark and the domain are stacked rather than side by side, because two
     cells in a 600px table collapse on a narrow screen and render as
     "Engaging UX Designengaginguxdesign.com"; the button is #8b3a1e, not the #b5590a
     it used to be, which is this product's warning colour and the wrong thing to
     teach on the primary action of a legal document; and the sign-off is fixed rather
     than left to the sender, so a closing is always present. */
  return `<!DOCTYPE html>
<html lang="${ctx.language}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#f0e4d8;font-family:Helvetica,Arial,sans-serif;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
  ${preheaderText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e4d8;padding:24px 0;">
<tr><td align="center">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(28,16,8,0.08);">

<tr><td style="background:#3b2110;padding:28px 24px;">
  ${logoImg()}
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#d9c3af;padding-top:8px;">engaginguxdesign.com</div>
</td></tr>

${personalMessage ? `<tr><td style="padding:28px 24px 4px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#3b2110;line-height:1.7;white-space:pre-line;">${escapeHtml(personalMessage)}</div>
</td></tr>` : ''}

<tr><td style="padding:20px 24px 8px;">
  <div style="background:#f7ede2;border-radius:8px;padding:20px;border:1px solid rgba(59,33,16,0.1);">
    ${summaryBody}
  </div>
</td></tr>

<tr><td align="center" style="padding:12px 24px 8px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a5a40;line-height:1.6;padding-bottom:16px;">
    ${ctaHelperText}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:360px;">
    <tr>
      <td bgcolor="#8b3a1e" align="center" style="background:#8b3a1e;border-radius:8px;">
        <a href="${safeUrl}" style="display:block;padding:15px 18px;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;line-height:1.3;">${safeCta} &rarr;</a>
      </td>
    </tr>
  </table>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7a5a40;line-height:1.6;padding-top:18px;word-break:break-word;overflow-wrap:break-word;">
    ${fallbackLabel}<br>
    <a href="${safeUrl}" style="display:inline-block;max-width:100%;color:#8b3a1e;text-decoration:underline;font-family:'Courier New',Courier,monospace;word-break:break-word;overflow-wrap:break-word;">${breakableUrl(safeUrl)}</a>
  </div>
  ${expiryNote ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7a5a40;line-height:1.6;padding-top:10px;">${expiryNote}</div>` : ''}
</td></tr>

<tr><td style="padding:20px 24px 0;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3b2110;line-height:1.6;">
    ${isNL ? 'Met vriendelijke groet,' : 'Kind regards,'}<br>
    <strong>Cess Garcia - de Laat</strong><br>
    Engaging UX Design
  </div>
</td></tr>

<tr><td style="padding:24px 24px 28px;border-top:1px solid rgba(59,33,16,0.14);">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:bold;color:#1c1008;padding-bottom:6px;">Engaging UX Design</div>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:2;">
    <a href="https://engaginguxdesign.com" style="color:#7a5a40;text-decoration:underline;">engaginguxdesign.com</a><br>
    <a href="mailto:info@engaginguxdesign.com" style="color:#7a5a40;text-decoration:underline;">info@engaginguxdesign.com</a><br>
    <a href="tel:+31612922316" style="color:#7a5a40;text-decoration:underline;">+31 6 12 92 23 16</a>
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
