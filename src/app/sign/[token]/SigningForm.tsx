'use client'

import { useState } from 'react'

/* Contact details, in one place, so the confirmation page and any later addition
   cannot drift from each other. The WhatsApp number is the same line, digits only. */
const PHONE_DISPLAY = '+31 6 12 92 23 16'
const PHONE_DIGITS = '31612922316'
const OWNER_EMAIL = 'info@engaginguxdesign.com'

export default function SigningForm({
  token,
  clientName,
  contractCode,
}: {
  token: string
  clientName: string
  contractCode: string
}) {
  const [typedName, setTypedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')

  async function handleSign() {
    if (!typedName.trim() || !agreed || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: typedName.trim(), agreed }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Something went wrong. Please try again.')
      setReference(typeof j.signingReference === 'string' ? j.signingReference : '')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    const firstName = clientName.split(' ')[0]
    const subject = encodeURIComponent(`Question about contract ${contractCode}`)
    const waText = encodeURIComponent(
      `Hi, I have just signed contract ${contractCode} and I have a question.`,
    )

    /* A page, not a card.
       The confirmation used to appear underneath the contract, so the last thing on
       screen after signing was still the agreement, and the message was something you
       had to scroll to. Signing is the end of this task, so it takes the whole screen
       and says what happens next. */
    return (
      <div className="fixed inset-0 z-50 bg-[#f0e4d8] overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-5 sm:p-8">
          <div className="bg-white rounded-2xl border border-[#d4bfb0] shadow-sm w-full max-w-lg p-7 sm:p-10 text-center">
            <div
              className="w-16 h-16 rounded-full bg-[#e6f4ea] flex items-center justify-center text-3xl text-[#2d6e2d] mx-auto mb-5"
              aria-hidden="true"
            >✓</div>

            <h1 className="font-bold text-2xl text-[#1c1008] m-0 mb-3">Contract signed</h1>
            <p className="text-[#8a6a55] text-[15px] leading-relaxed m-0">
              Thank you, {firstName}. Your agreement is signed and nothing further is
              needed from you.
            </p>

            <div className="mt-7 pt-6 border-t border-[#e8d9cc] text-left">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#b8a090] mb-3">
                What happens next
              </div>
              <ul className="text-sm text-[#5c4433] leading-relaxed m-0 pl-5 space-y-1.5">
                <li>A signed PDF copy is on its way to your inbox. Keep it for your records.</li>
                <li>Engaging UX Design has been notified and will be in touch about starting.</li>
                <li>You can close this page.</li>
              </ul>
            </div>

            <div className="mt-7 pt-6 border-t border-[#e8d9cc]">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#b8a090] mb-1">
                Any questions?
              </div>
              <p className="text-sm text-[#8a6a55] m-0 mb-4">
                Reach Cess directly, whichever suits you.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <a
                  href={`https://wa.me/${PHONE_DIGITS}?text=${waText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#8b3a1e] text-white text-sm font-semibold px-4 py-3 hover:bg-[#7a3219] transition-colors no-underline"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4-.1-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>
                  WhatsApp
                </a>
                <a
                  href={`tel:+${PHONE_DIGITS}`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[#d4bfb0] text-[#5c4433] text-sm font-semibold px-4 py-3 hover:border-[#8b3a1e] hover:text-[#8b3a1e] transition-colors no-underline"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>
                  Call
                </a>
                <a
                  href={`mailto:${OWNER_EMAIL}?subject=${subject}`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[#d4bfb0] text-[#5c4433] text-sm font-semibold px-4 py-3 hover:border-[#8b3a1e] hover:text-[#8b3a1e] transition-colors no-underline"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>
                  Email
                </a>
              </div>

              <p className="text-xs text-[#b8a090] mt-3 m-0">
                {PHONE_DISPLAY} · {OWNER_EMAIL}
              </p>
            </div>

            <div className="mt-7 pt-5 border-t border-[#e8d9cc] text-xs text-[#b8a090] leading-relaxed">
              Signed electronically under EU Regulation 910/2014 (eIDAS).
              <br />
              Contract <span className="font-mono text-[#8a6a55]">{contractCode}</span>
              {reference && (
                <>
                  {' · '}reference{' '}
                  <span className="font-mono text-[#8a6a55]">{reference}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-10 bg-white rounded-2xl border border-[#d4bfb0] shadow-sm overflow-hidden">
      <div className="bg-[#f7ede2] px-5 sm:px-8 py-5 border-b border-[#d4bfb0]">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#8b3a1e] mb-1">
          eIDAS · Simple Electronic Signature
        </div>
        <h2 className="font-bold text-lg text-[#1c1008]">Sign this agreement</h2>
        <p className="text-sm text-[#8a6a55] mt-0.5">
          Signing as <strong className="text-[#1c1008]">{clientName}</strong>
        </p>
      </div>

      <div className="px-5 sm:px-8 py-6 space-y-5">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a7a65] mb-2">
            Type your full legal name to sign
          </label>
          <input
            type="text"
            value={typedName}
            onChange={e => setTypedName(e.target.value)}
            placeholder={clientName}
            autoComplete="name"
            className="w-full border border-[#d4bfb0] rounded-lg px-4 py-3 text-[#1c1008] font-semibold text-base placeholder:text-[#c4a898] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#1c1008]/20 focus:border-[#1c1008]/40"
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            // ! overrides globals.css `input { width: 100% }`, which is unlayered and so
            // outranks Tailwind utilities — otherwise this box stretches to the full
            // width and collapses the consent text beside it.
            className="mt-0.5 !h-4 !w-4 shrink-0 rounded accent-[#1c1008] cursor-pointer"
          />
          <span className="text-sm text-[#3b2110] leading-snug min-w-0 break-words">
            I have read and agree to all terms in this Service Agreement, including the{' '}
            <a
              href="https://engaginguxdesign.com/service-terms-and-conditions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8b3a1e] underline underline-offset-2"
            >
              Service Terms &amp; Project Conditions
            </a>.
          </span>
        </label>

        {error && (
          <div className="text-sm text-[#9b2226] bg-[#fce8e0] border border-[#f0c4b0] rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSign}
          disabled={!typedName.trim() || !agreed || busy}
          className="w-full bg-[#1c1008] text-[#f7ede2] font-bold py-4 rounded-xl text-sm tracking-wide disabled:opacity-35 disabled:cursor-not-allowed hover:bg-[#2d1a0a] transition-colors"
        >
          {busy ? 'Signing…' : 'Sign contract'}
        </button>

        <p className="text-[11px] text-[#b8a090] text-center leading-relaxed">
          By signing, you confirm that you have read and agreed to the terms above.
          This constitutes a legally binding Simple Electronic Signature under EU Regulation 910/2014 (eIDAS).
          A signed PDF copy will be emailed to you immediately.
        </p>
      </div>
    </div>
  )
}
