'use client'

import { useState } from 'react'

type Banner = { type: 'success' | 'error'; text: string } | null

export default function SettingsClient({ currentEmail }: { currentEmail: string }) {
  // Shared re-auth fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [code, setCode] = useState('')

  // Email + password forms
  const [newEmail, setNewEmail] = useState(currentEmail)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountBanner, setAccountBanner] = useState<Banner>(null)

  // Recovery codes
  const [regenLoading, setRegenLoading] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [recoveryBanner, setRecoveryBanner] = useState<Banner>(null)

  function clearReauth() {
    setCurrentPassword('')
    setCode('')
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault()
    setAccountBanner(null)

    const emailChanged = newEmail.trim().toLowerCase() !== currentEmail.toLowerCase()
    const passwordChanged = newPassword.length > 0

    if (!emailChanged && !passwordChanged) {
      setAccountBanner({ type: 'error', text: 'Nothing to update.' })
      return
    }
    if (passwordChanged && newPassword !== confirmPassword) {
      setAccountBanner({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    if (passwordChanged && newPassword.length < 10) {
      setAccountBanner({ type: 'error', text: 'New password must be at least 10 characters.' })
      return
    }
    if (!currentPassword || !code) {
      setAccountBanner({ type: 'error', text: 'Re-enter your current password and 2FA code.' })
      return
    }

    setSavingAccount(true)
    try {
      const res = await fetch('/api/auth/account', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          code,
          newEmail: emailChanged ? newEmail : undefined,
          newPassword: passwordChanged ? newPassword : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')

      const parts: string[] = []
      if (emailChanged) parts.push(`email updated to ${data.email}`)
      if (passwordChanged) parts.push('password changed')
      setAccountBanner({ type: 'success', text: `Saved — ${parts.join(' and ')}.` })

      setNewPassword('')
      setConfirmPassword('')
      clearReauth()
      // If email changed, reload so the new value is reflected from the server
      if (emailChanged) {
        setTimeout(() => window.location.reload(), 1200)
      }
    } catch (err) {
      setAccountBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Update failed',
      })
    } finally {
      setSavingAccount(false)
    }
  }

  async function regenerate(e: React.FormEvent) {
    e.preventDefault()
    setRecoveryBanner(null)
    setRecoveryCodes(null)
    if (!currentPassword || !code) {
      setRecoveryBanner({
        type: 'error',
        text: 'Enter your current password and 2FA code below first.',
      })
      return
    }
    setRegenLoading(true)
    try {
      const res = await fetch('/api/auth/recovery-codes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Regeneration failed')
      setRecoveryCodes(data.recoveryCodes as string[])
      setRecoveryBanner({
        type: 'success',
        text: 'New codes generated. Save them now — they will not be shown again.',
      })
      clearReauth()
    } catch (err) {
      setRecoveryBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Regeneration failed',
      })
    } finally {
      setRegenLoading(false)
    }
  }

  function copyCodes() {
    if (!recoveryCodes) return
    navigator.clipboard.writeText(recoveryCodes.join('\n'))
  }

  return (
    <div className="space-y-6">
      {/* ── Section 1: Account (email + password) ── */}
      <section className="bg-white border border-brown-light rounded-2xl p-6 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-brown-dark mb-1">Email &amp; password</h2>
        <p className="text-xs text-brown-subtle mb-5">
          Current email: <span className="font-mono text-brown-dark">{currentEmail}</span>
        </p>

        <form onSubmit={saveAccount} className="grid gap-4">
          <Field label="New email">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="New password" hint="Minimum 10 characters. Leave blank to keep current.">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••••"
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••••"
              />
            </Field>
          </div>

          <ReauthBlock
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            code={code}
            setCode={setCode}
          />

          {accountBanner && <Banner banner={accountBanner} />}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingAccount}
              className="px-5 py-2.5 rounded-lg bg-brown-rust hover:bg-brown-rust/90 text-brown-pale font-semibold transition-colors disabled:opacity-50 text-sm"
            >
              {savingAccount ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Section 2: Recovery codes ── */}
      <section className="bg-white border border-brown-light rounded-2xl p-6 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-brown-dark mb-1">Recovery codes</h2>
        <p className="text-xs text-brown-subtle mb-5">
          Each code is single-use. Regenerating invalidates all unused codes and replaces them with
          a fresh batch of 10. Save them in your password manager — they will not be shown again.
        </p>

        {recoveryCodes && (
          <div className="mb-5 p-4 rounded-xl bg-brown-pale border border-brown-rust/30">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-brown-rust">
                Your new recovery codes
              </div>
              <button
                type="button"
                onClick={copyCodes}
                className="text-xs font-semibold text-brown-rust hover:text-brown-dark underline underline-offset-2"
              >
                Copy all
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm text-brown-dark">
              {recoveryCodes.map((c) => (
                <div key={c} className="px-3 py-2 rounded-md bg-white border border-brown-light">
                  {c}
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={regenerate} className="grid gap-4">
          <ReauthBlock
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            code={code}
            setCode={setCode}
          />

          {recoveryBanner && <Banner banner={recoveryBanner} />}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={regenLoading}
              className="px-5 py-2.5 rounded-lg bg-brown-dark hover:bg-brown-mid text-brown-pale font-semibold transition-colors disabled:opacity-50 text-sm"
            >
              {regenLoading ? 'Generating…' : 'Generate new recovery codes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-wider text-brown-muted mb-1.5">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-brown-subtle mt-1">{hint}</span>}
    </label>
  )
}

function ReauthBlock({
  currentPassword,
  setCurrentPassword,
  code,
  setCode,
}: {
  currentPassword: string
  setCurrentPassword: (v: string) => void
  code: string
  setCode: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-brown-light">
      <Field label="Current password" hint="Required to confirm any change.">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••••"
        />
      </Field>
      <Field label="2FA or recovery code">
        <input
          type="text"
          inputMode="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          placeholder="000000"
          className="font-mono tracking-[0.2em]"
        />
      </Field>
    </div>
  )
}

function Banner({ banner }: { banner: NonNullable<Banner> }) {
  const isErr = banner.type === 'error'
  return (
    <div
      className={`px-3 py-2 rounded-md text-sm border ${
        isErr
          ? 'bg-red-500/10 border-red-500/30 text-red-700'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
      }`}
    >
      {banner.text}
    </div>
  )
}
