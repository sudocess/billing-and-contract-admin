'use client'

import { useState } from 'react'

export default function SigningForm({
  token,
  clientName,
}: {
  token: string
  clientName: string
}) {
  const [typedName, setTypedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSign() {
    if (!typedName.trim() || !agreed || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: typedName.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Something went wrong. Please try again.')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mt-10 bg-white rounded-2xl border border-[#d4bfb0] p-10 text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-[#e6f4ea] flex items-center justify-center text-2xl mx-auto mb-4">✓</div>
        <h2 className="font-bold text-xl text-[#1c1008] mb-2">Contract signed</h2>
        <p className="text-[#8a6a55] text-sm leading-relaxed max-w-sm mx-auto">
          Thank you, {clientName.split(' ')[0]}. A signed copy of the agreement will be emailed to you shortly.
        </p>
        <p className="text-xs text-[#b8a090] mt-6">
          Signed electronically under EU Regulation 910/2014 (eIDAS).
        </p>
      </div>
    )
  }

  return (
    <div className="mt-10 bg-white rounded-2xl border border-[#d4bfb0] shadow-sm overflow-hidden">
      <div className="bg-[#f7ede2] px-8 py-5 border-b border-[#d4bfb0]">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#8b3a1e] mb-1">
          eIDAS · Simple Electronic Signature
        </div>
        <h2 className="font-bold text-lg text-[#1c1008]">Sign this agreement</h2>
        <p className="text-sm text-[#8a6a55] mt-0.5">
          Signing as <strong className="text-[#1c1008]">{clientName}</strong>
        </p>
      </div>

      <div className="px-8 py-6 space-y-5">
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
            className="mt-0.5 h-4 w-4 rounded accent-[#1c1008] cursor-pointer"
          />
          <span className="text-sm text-[#3b2110] leading-snug">
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
