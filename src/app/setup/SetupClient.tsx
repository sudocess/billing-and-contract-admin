'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

/**
 * One-time admin creation. There is no authenticator app to enrol — the second factor
 * is a code emailed at sign-in — so this is just email + password, and the browser
 * that runs setup is trusted for the first 30 days.
 */
export default function SetupClient() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function createAccount(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email || !password) return setError('Email and password required')
    if (password.length < 12) return setError('Password must be at least 12 characters')
    if (password !== confirm) return setError('Passwords do not match')

    setLoading(true)
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Setup failed')
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  const labelClass = 'block text-xs font-semibold !text-white uppercase tracking-wider mb-1.5'
  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-brown-pale text-brown-dark placeholder:text-brown-muted/50 ' +
    'border border-brown-pale focus:outline-none focus:border-brown-rust focus:ring-2 focus:ring-brown-rust/30'

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f0e8de] px-4 py-8">
      <div className="w-full max-w-md bg-brown-mid rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-8 pt-8 pb-6 border-b border-white/10">
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
            Initial Setup
          </h1>
          <p className="text-center text-white/60 text-xs mt-1">
            One-time admin account creation
          </p>
        </div>

        <form onSubmit={createAccount} className="p-8 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-md bg-red-500/15 border border-red-500/40 text-red-200 text-sm">
              {error}
            </div>
          )}

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
              placeholder="you@example.com"
            />
            <p className="text-[11px] text-brown-pale/60 mt-1.5">
              Sign-in codes are sent here, so use an inbox you will always be able to reach.
            </p>
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="At least 12 characters"
            />
          </div>

          <div>
            <label className={labelClass}>Confirm password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-brown-rust hover:bg-brown-rust/90 text-brown-pale font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create admin account'}
          </button>
        </form>
      </div>
    </main>
  )
}
