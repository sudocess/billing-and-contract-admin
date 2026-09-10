/**
 * Where this app actually lives, worked out once instead of three different ways.
 *
 * Three routes built the same kind of client-facing link and disagreed about how:
 * the signing-link route used the browsed host, the send route used the request
 * headers with an empty-string fallback, and send-for-signature used APP_URL with a
 * fallback to `http://localhost:3000`. The last two are the dangerous ones. An empty
 * origin produces `/sign/abc` in an email, which is not a link at all, and a missing
 * APP_URL in production emails the client a link to a machine that only exists on
 * this laptop. Both fail in the same way from the client's side: a page that 404s,
 * with nothing on the sender's screen to say so.
 */

const LOCAL = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i

/** The host the admin is actually browsing. Right for a link shown in the admin UI. */
export function requestOrigin(req: Request): string {
  const origin = (req.headers.get('origin') || '').trim().replace(/\/+$/, '')
  if (/^https?:\/\/.+/i.test(origin)) return origin

  const host = (req.headers.get('host') || '').trim()
  if (!host) return ''
  const scheme = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(host) ? 'http' : 'https'
  return `${scheme}://${host}`
}

/**
 * An origin fit to put in an email.
 *
 * APP_URL wins when it is set, because the request host can be a preview deployment,
 * and a preview URL mailed to a client is access-protected and expires. Where APP_URL
 * is missing or unusable this falls back to the request, and where even that leaves a
 * localhost address it reports an error rather than sending a dead link.
 */
export function emailOrigin(req: Request): { origin: string; error: string | null } {
  const configured = (process.env.APP_URL || '').trim().replace(/\/+$/, '')
  const fromRequest = requestOrigin(req)

  // A stale APP_URL pointing at localhost should not stop a send that is being made
  // from the real domain. Prefer whichever of the two a client could actually open.
  const preferred = /^https?:\/\/.+/i.test(configured) ? configured : fromRequest
  const candidate =
    LOCAL.test(preferred) && fromRequest && !LOCAL.test(fromRequest) ? fromRequest : preferred

  if (!candidate) {
    return {
      origin: '',
      error: 'Cannot work out this app\'s public address, so the link in the email would be broken. Set APP_URL and redeploy.',
    }
  }
  if (LOCAL.test(candidate)) {
    return {
      origin: candidate,
      error: `The only address available is ${candidate}, which nobody outside this machine can open. Set APP_URL to the live domain and redeploy.`,
    }
  }
  return { origin: candidate, error: null }
}
