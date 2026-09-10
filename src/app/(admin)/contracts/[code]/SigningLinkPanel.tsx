'use client'

import { useState } from 'react'

/**
 * The signing link, visible and copyable.
 *
 * Previously a token existed only inside the email `send-for-signature` had already
 * dispatched, so a link could not be shared any other way — which is a problem when
 * the client is reached over WhatsApp. Minting is now separate from sending.
 *
 * The token is a bearer credential: whoever holds it can sign as the client. It is
 * shown because the alternative is worse — no link at all — but it is never on screen
 * without saying what it is.
 */
export default function SigningLinkPanel({
  contractCode,
  status,
  initialToken,
  initialExpiresAt,
}: {
  contractCode: string
  status: string
  initialToken: string | null
  initialExpiresAt: string | null
}) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const [url, setUrl] = useState(initialToken ? `${origin}/sign/${initialToken}` : '')
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const expiry = expiresAt ? new Date(expiresAt) : null
  const expired = !!expiry && expiry.getTime() < Date.now()
  const usable = !!url && !expired
  const blocked = status === 'SIGNED' || status === 'CANCELLED'

  async function mint(force: boolean) {
    if (busy) return
    setBusy(true); setError(''); setCopied(false)
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(contractCode)}/signing-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not create a signing link.')
      setUrl(j.url)
      setExpiresAt(j.expiresAt)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a signing link.')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('Could not reach the clipboard, select the link and copy it by hand.')
    }
  }

  if (blocked) {
    return (
      <div className="panel p-5">
        <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider mb-2">Signing link</div>
        <p className="text-[13px] text-brown-subtle">
          {status === 'SIGNED'
            ? 'This contract is signed. The signed PDF is on this page.'
            : 'This contract is cancelled. Reactivate it to create a signing link.'}
        </p>
      </div>
    )
  }

  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="text-xs font-bold text-brown-subtle uppercase tracking-wider">Signing link</div>
        {expiry && (
          <span className={`text-[11px] font-semibold ${expired ? 'text-warning' : 'text-brown-subtle'}`}>
            {expired
              ? 'Expired'
              : `Valid until ${expiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
          </span>
        )}
      </div>

      <p className="text-[13px] text-brown-subtle leading-relaxed mb-3">
        Anyone with this link can sign as the client, so share it the way you would a password.
        Sending it here is not required, <strong className="text-brown-dark">Send for signature</strong> emails
        it to the client directly.
      </p>

      {usable ? (
        <>
          <div className="rounded-lg border border-brown-dark/10 bg-brown-pale/30 p-3 font-mono text-[11px] text-brown-dark break-all select-all">
            {url}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a
              className="btn btn-ghost btn-sm"
              href={`https://wa.me/?text=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on WhatsApp
            </a>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => mint(true)} disabled={busy}>
              {busy ? 'Working…' : 'Regenerate'}
            </button>
          </div>
          <p className="text-[11px] text-brown-subtle mt-2">
            Regenerating breaks the link the client already has, including the one in any email already sent.
          </p>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => mint(false)} disabled={busy}>
            {busy ? 'Creating…' : expired ? 'Create a new link' : 'Create signing link'}
          </button>
          <p className="text-[11px] text-brown-subtle mt-2">
            {expired
              ? 'The previous link has expired. A new one is valid for 14 days.'
              : 'Valid for 14 days. Nothing is emailed.'}
          </p>
        </>
      )}

      {error && (
        <div className="mt-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 text-[13px]">
          {error}
        </div>
      )}
    </div>
  )
}
