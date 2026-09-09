/**
 * Validation for the payment-request link pasted onto an invoice.
 *
 * This link is emailed to a client from our own domain, alongside an amount, asking
 * them to pay. That is the exact shape of a phishing message, and the only thing
 * separating the two is that the destination is genuinely the bank. So the host is
 * checked against an allowlist rather than merely required to be https: an attacker —
 * or a mistyped paste — that put any other domain in front of a client would be using
 * our sender reputation to do it.
 *
 * The rendered email always shows the full URL as visible text. A link whose label
 * hides where it goes is the other half of the same trick, and it costs nothing to
 * let the client read the hostname before they click.
 */

/** Hosts permitted to appear in a payment link. Exact host or a subdomain of one. */
export const ALLOWED_PAYMENT_HOSTS = [
  'betaalverzoek.rabobank.nl',
  'betaalverzoek.abnamro.nl',
  'tikkie.me',
  'pay.mollie.com',
] as const

export interface LinkCheck {
  ok: boolean
  /** Normalised URL, safe to store and render. Only set when ok. */
  url?: string
  host?: string
  error?: string
}

export function checkPaymentLink(raw: string): LinkCheck {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'Paste a payment link first.' }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: 'That is not a valid URL.' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Payment links must be https.' }
  }

  // user:pass@host is a classic way to make a hostile host read as a familiar one.
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'That URL carries embedded credentials and was not accepted.' }
  }

  const host = parsed.hostname.toLowerCase()
  const allowed = ALLOWED_PAYMENT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  if (!allowed) {
    return {
      ok: false,
      error: `${host} is not a recognised payment provider. Allowed: ${ALLOWED_PAYMENT_HOSTS.join(', ')}.`,
    }
  }

  return { ok: true, url: parsed.toString(), host }
}

/** How old a stored link is, in whole days. These requests expire. */
export function linkAgeDays(addedAt: Date | string | null | undefined): number | null {
  if (!addedAt) return null
  const t = new Date(addedAt).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86_400_000)
}

/** Rabobank payment requests lapse; warn before one is sent again in a reminder. */
export const LINK_STALE_AFTER_DAYS = 14
