'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Step = 'account' | 'qr' | 'verify' | 'recovery'

export default function SetupClient() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('account')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [secret, setSecret] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch base secret on mount
  useEffect(() => {
    fetch('/api/auth/setup-secret')
      .then((r) => r.json())
      .then((d) => {
        if (d.secret) setSecret(d.secret)
      })
      .catch(() => setError('Could not initialize setup. Refresh and try again.'))
  }, [])

  async function continueToQr(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) return setError('Email and password required')
    if (password.length < 12) return setError('Password must be at least 12 characters')
    if (password !== confirm) return setError('Passwords do not match')

    setLoading(true)
    try {
      const res = await fetch('/api/auth/setup-secret', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, secret }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setQrDataUrl(data.qrDataUrl)
      setStep('qr')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function verifyAndCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, secret, totpCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setRecoveryCodes(data.recoveryCodes)
      setStep('recovery')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  function downloadCodes() {
    const text = [
      `Engaging UX Design — Invoice Admin Recovery Codes`,
      `Account: ${email}`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `Each code can be used ONCE if you lose your authenticator device.`,
      `Store these somewhere safe (e.g., your password manager).`,
      ``,
      ...recoveryCodes,
    ].join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'billing-and-contract-admin-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f0e8de] px-4">
      <div className="w-full max-w-md bg-brown-mid rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-8 pt-8 pb-6 border-b border-white/10">
          <div className="flex justify-center mb-4">
            <Image
              src="/engaginguxdesign-logo-white.svg"
              alt="Engaging UX Design"
              width={170}
              height={62}
              className="object-contain"
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

        <div className="p-8">
          {error && (
            <div className="mb-4 px-3 py-2 rounded-md bg-red-500/15 border border-red-500/40 text-red-200 text-sm">
              {error}
            </div>
          )}

          {step === 'account' && (
            <form onSubmit={continueToQr} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-brown-pale focus:outline-none focus:border-brown-rust"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                  Password (min 12 chars)
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-brown-pale focus:outline-none focus:border-brown-rust"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-brown-pale focus:outline-none focus:border-brown-rust"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-brown-rust hover:bg-brown-rust/90 text-brown-pale font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'qr' && (
            <div className="space-y-4">
              <p className="text-sm text-white/80 leading-relaxed">
                Scan this QR code with your authenticator app
                (<strong className="text-brown-pale">Apple Passwords</strong>, 1Password,
                Authy, Google Authenticator, etc.).
              </p>
              {qrDataUrl && (
                <div className="bg-white p-3 rounded-lg flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="2FA QR Code" width={240} height={240} />
                </div>
              )}
              <details className="text-xs text-white/60">
                <summary className="cursor-pointer hover:text-white/80">
                  Can&apos;t scan? Show secret manually
                </summary>
                <code className="block mt-2 p-2 bg-black/30 rounded text-brown-pale break-all">
                  {secret}
                </code>
              </details>
              <button
                onClick={() => setStep('verify')}
                className="w-full py-2.5 rounded-lg bg-brown-rust hover:bg-brown-rust/90 text-brown-pale font-semibold transition-colors"
              >
                I&apos;ve added the account
              </button>
            </div>
          )}

          {step === 'verify' && (
            <form onSubmit={verifyAndCreate} className="space-y-4">
              <p className="text-sm text-white/80">
                Enter the 6-digit code from your authenticator app to verify the setup.
              </p>
              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-brown-pale focus:outline-none focus:border-brown-rust text-center text-xl tracking-[0.4em] font-mono"
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full py-2.5 rounded-lg bg-brown-rust hover:bg-brown-rust/90 text-brown-pale font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify & Create Account'}
              </button>
            </form>
          )}

          {step === 'recovery' && (
            <div className="space-y-4">
              <div className="px-3 py-2 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-100 text-xs">
                Save these recovery codes in a safe place. Each can be used <strong>once</strong>{' '}
                if you lose access to your authenticator device.
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 bg-black/30 rounded-lg">
                {recoveryCodes.map((c) => (
                  <code key={c} className="text-brown-pale text-sm font-mono text-center py-1">
                    {c}
                  </code>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={downloadCodes}
                  className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-brown-pale font-semibold transition-colors"
                >
                  Download .txt
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="flex-1 py-2.5 rounded-lg bg-brown-rust hover:bg-brown-rust/90 text-brown-pale font-semibold transition-colors"
                >
                  Continue to App
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
