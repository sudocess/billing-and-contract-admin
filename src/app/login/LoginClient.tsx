'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Step = 'credentials' | 'code'

export default function LoginClient({ next }: { next: string }) {
  const router = useRouter()

  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [rememberDevice, setRememberDevice] = useState(true)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const codeRef = useRef<HTMLInputElement>(null)

  // Resend countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  function goHome() {
    router.push(next)
    router.refresh()
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (typeof data.retryAfter === 'number') setCooldown(data.retryAfter)
        throw new Error(data.error || 'Sign in failed')
      }

      // Browser is still inside its trust window — no code needed.
      if (data.trusted) {
        goHome()
        return
      }

      setMaskedEmail(data.maskedEmail || '')
      setCooldown(60)
      setStep('code')
      setNotice(`Code sent to ${data.maskedEmail}. It expires in ${data.expiresInMinutes} minutes.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, code, rememberDevice }),
      })
      const data = await res.json()
      if (!res.ok) {
        // A burnt or lapsed code means starting over, not guessing again.
        if (data.reason === 'expired' || data.reason === 'too-many-attempts' || data.reason === 'no-code') {
          setCode('')
          setCooldown(0)
        }
        throw new Error(data.error || 'Sign in failed')
      }
      goHome()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    if (cooldown > 0 || loading) return
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (typeof data.retryAfter === 'number') setCooldown(data.retryAfter)
        throw new Error(data.error || 'Could not resend the code')
      }
      if (data.trusted) {
        goHome()
        return
      }
      setCode('')
      setCooldown(60)
      setNotice(`New code sent to ${data.maskedEmail || maskedEmail}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code')
    } finally {
      setLoading(false)
    }
  }

  function startOver() {
    setStep('credentials')
    setCode('')
    setError('')
    setNotice('')
  }

  // Note: globals.css has a `label { color: var(--color-brown-muted) }` rule that
  // would otherwise override these. Using `!text-white` to force the white color.
  const labelClass =
    'block text-xs font-semibold !text-white uppercase tracking-wider mb-1.5'
  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-brown-pale text-brown-dark placeholder:text-brown-muted/50 ' +
    'border border-brown-pale focus:outline-none focus:border-brown-rust focus:ring-2 focus:ring-brown-rust/30 ' +
    'autofill:[-webkit-text-fill-color:#1c1008] autofill:shadow-[inset_0_0_0_1000px_#f7ede2]'

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f0e8de] px-4 py-8">
      <div className="w-full max-w-md bg-brown-mid rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-white/10">
          <div className="flex justify-center mb-4">
            <Image
              src="/engaginguxdesign-logo-white.svg"
              alt="Engaging UX Design"
              width={170}
              height={62}
              className="object-contain h-auto w-[140px] sm:w-[170px]"
              priority
            />
          </div>
          <h1 className="text-center text-brown-pale font-heading text-lg font-bold">
            {step === 'credentials' ? 'Sign In' : 'Check your email'}
          </h1>
          <p className="text-center text-brown-pale/70 text-xs mt-1">
            {step === 'credentials'
              ? 'Billing & Contract Admin'
              : maskedEmail
                ? `We sent a 6-digit code to ${maskedEmail}`
                : 'We sent you a 6-digit code'}
          </p>
        </div>

        {step === 'credentials' ? (
          <form onSubmit={submitCredentials} className="p-6 sm:p-8 space-y-4">
            {error && <ErrorBox>{error}</ErrorBox>}

            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                required
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass + ' pr-11'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-brown-muted hover:text-brown-dark transition-colors"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a19.77 19.77 0 015.06-5.94" />
                      <path d="M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a19.86 19.86 0 01-3.17 4.19" />
                      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-brown-rust hover:bg-brown-rust/90 text-brown-pale font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Checking…' : 'Continue'}
            </button>

            <p className="text-[11px] text-brown-pale/60 text-center leading-relaxed">
              If this browser was verified in the last 30 days you go straight in.
              Otherwise we email you a one-time code.
            </p>
          </form>
        ) : (
          <form onSubmit={submitCode} className="p-6 sm:p-8 space-y-4">
            {error && <ErrorBox>{error}</ErrorBox>}
            {notice && !error && (
              <div className="px-3 py-2 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-100 text-sm">
                {notice}
              </div>
            )}

            <div>
              <label className={labelClass}>6-digit code</label>
              <input
                ref={codeRef}
                type="text"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={inputClass + ' text-center text-2xl tracking-[0.4em] font-mono'}
                placeholder="000000"
              />
            </div>

            {/*
              globals.css styles bare `input` with width:100% and bare `label` with
              uppercase + bold, both unlayered — and unlayered CSS outranks Tailwind's
              @layer utilities. Without the ! overrides the checkbox stretches to the
              full card width, squeezing this text into a one-character column that
              overflows the card, in shouty caps. Same conflict the `!text-white` in
              labelClass above works around.
            */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none !normal-case !tracking-normal !font-normal">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="mt-0.5 !w-4 !h-4 accent-[#b5590a] shrink-0 cursor-pointer"
              />
              <span className="text-xs !text-brown-pale/80 leading-relaxed min-w-0 break-words">
                Remember this browser for 30 days
                <span className="block text-brown-pale/50 text-[11px]">
                  Skip the code on this device until the 30 days are up. Leave off on a shared computer.
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-2.5 rounded-lg bg-brown-rust hover:bg-brown-rust/90 text-brown-pale font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Sign In'}
            </button>

            <div className="flex items-center justify-between text-[11px] pt-1">
              <button
                type="button"
                onClick={startOver}
                className="text-brown-pale/60 hover:text-brown-pale underline underline-offset-2 transition-colors"
              >
                ← Use a different account
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={cooldown > 0 || loading}
                className="text-brown-pale/60 hover:text-brown-pale underline underline-offset-2 transition-colors disabled:no-underline disabled:opacity-50"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 rounded-md bg-red-500/15 border border-red-500/40 text-red-200 text-sm">
      {children}
    </div>
  )
}
