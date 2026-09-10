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
const VERCEL_HOST = /^https?:\/\/[^/]+\.vercel\.app$/i

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
 * The address bar wins. The domain the admin is actually working on is live by
 * definition, whereas APP_URL is a second place to be wrong and nothing tells you when
 * it goes stale: it sat pointing at the old `billing-and-contract-admin.vercel.app`
 * long after the app moved to its own domain, and every emailed link carried that.
 *
 * APP_URL is still the fallback, and it wins in one case: a `*.vercel.app` host. Those
 * are deployment URLs, they can be access-protected and they change on every deploy, so
 * a custom domain is preferred whenever one of the two is one.
 */
export function emailOrigin(req: Request): { origin: string; error: string | null } {
  const configured = (process.env.APP_URL || '').trim().replace(/\/+$/, '')
  const fromRequest = requestOrigin(req)

  const usable = [fromRequest, configured].filter(
    (u) => /^https?:\/\/.+/i.test(u) && !LOCAL.test(u),
  )

  if (usable.length === 0) {
    const seen = [fromRequest, configured].filter(Boolean).join(', ') || 'nothing'
    return {
      origin: '',
      error: `No public address is available for this app, so the link in the email would be broken. Seen: ${seen}. Set APP_URL to the live domain and redeploy.`,
    }
  }

  return { origin: usable.find((u) => !VERCEL_HOST.test(u)) ?? usable[0], error: null }
}
