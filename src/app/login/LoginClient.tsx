'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginClient() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
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
            Sign In
          </h1>
          <p className="text-center text-brown-pale/70 text-xs mt-1">Invoice Admin</p>
        </div>

        <form onSubmit={onSubmit} className="p-6 sm:p-8 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-md bg-red-500/15 border border-red-500/40 text-red-200 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>
              Email
            </label>
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
            <label className={labelClass}>
              Password
            </label>
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

          <div>
            <label className={labelClass}>
              2FA Code or Recovery Code
            </label>
            <input
              type="text"
              required
              inputMode="text"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClass + ' text-center text-lg tracking-[0.3em] font-mono'}
              placeholder="000000"
            />
            <p className="text-[11px] text-brown-pale/60 mt-1.5">
              6-digit code from your authenticator app, or one of your recovery codes.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-brown-rust hover:bg-brown-rust/90 text-brown-pale font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  )
}
