'use client'

import { useState, useEffect, useCallback } from 'react'

type Banner = { type: 'success' | 'error'; text: string } | null

type TrustedDevice = {
  id: string
  label: string
  createdAt: string
  lastUsedAt: string
  expiresAt: string
  isCurrent: boolean
}

export default function SettingsClient({ currentEmail }: { currentEmail: string }) {
  // Shared re-auth fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [code, setCode] = useState('')

  // ── Business / invoicing details ──
  const [ownerIban, setOwnerIban] = useState('')
  const [ownerBic, setOwnerBic] = useState('')
  const [ownerBankName, setOwnerBankName] = useState('')
  const [ownerAccountHolder, setOwnerAccountHolder] = useState('Engaging UX Design')
  const [ownerVat, setOwnerVat] = useState('')
  const [ownerKvk, setOwnerKvk] = useState('')
  const [savingOwner, setSavingOwner] = useState(false)
  const [ownerBanner, setOwnerBanner] = useState<Banner>(null)

  useEffect(() => {
    fetch('/api/settings/owner')
      .then(r => r.json())
      .then((s: Record<string, string>) => {
        setOwnerIban(s.iban ?? '')
        setOwnerBic(s.bic ?? '')
        setOwnerBankName(s.bankName ?? '')
        setOwnerAccountHolder(s.accountHolder ?? 'Engaging UX Design')
        setOwnerVat(s.ownVat ?? '')
        setOwnerKvk(s.ownKvk ?? '')
      })
      .catch(() => {})
  }, [])

  async function saveOwner(e: React.FormEvent) {
    e.preventDefault()
    setSavingOwner(true)
    setOwnerBanner(null)
    try {
      const res = await fetch('/api/settings/owner', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          iban: ownerIban,
          bic: ownerBic,
          bankName: ownerBankName,
          accountHolder: ownerAccountHolder,
          ownVat: ownerVat,
          ownKvk: ownerKvk,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setOwnerBanner({ type: 'success', text: 'Business details saved — these will now pre-fill on new invoices.' })
    } catch {
      setOwnerBanner({ type: 'error', text: 'Failed to save. Please try again.' })
    } finally {
      setSavingOwner(false)
    }
  }

  // Email + password forms
  const [newEmail, setNewEmail] = useState(currentEmail)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountBanner, setAccountBanner] = useState<Banner>(null)

  // Emailed re-auth code
  const [sendingCode, setSendingCode] = useState(false)
  const [codeCooldown, setCodeCooldown] = useState(0)

  // Trusted browsers
  const [devices, setDevices] = useState<TrustedDevice[] | null>(null)
  const [trustDays, setTrustDays] = useState(30)
  const [maxDevices, setMaxDevices] = useState(5)
  const [deviceBanner, setDeviceBanner] = useState<Banner>(null)
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null)

  useEffect(() => {
    if (codeCooldown <= 0) return
    const t = setTimeout(() => setCodeCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [codeCooldown])

  const loadDevices = useCallback(() => {
    fetch('/api/auth/devices')
      .then((r) => r.json())
      .then((d) => {
        setDevices(d.devices ?? [])
        if (typeof d.trustDays === 'number') setTrustDays(d.trustDays)
        if (typeof d.maxDevices === 'number') setMaxDevices(d.maxDevices)
      })
      .catch(() => setDevices([]))
  }, [])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  function clearReauth() {
    setCurrentPassword('')
    setCode('')
  }

  async function sendReauthCode() {
    if (codeCooldown > 0 || sendingCode) return
    setSendingCode(true)
    setAccountBanner(null)
    try {
      const res = await fetch('/api/auth/reauth-code', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (typeof data.retryAfter === 'number') setCodeCooldown(data.retryAfter)
        throw new Error(data.error || 'Could not send the code')
      }
      setCodeCooldown(60)
      setAccountBanner({
        type: 'success',
        text: `Code sent to ${currentEmail}. It expires in ${data.expiresInMinutes} minutes.`,
      })
    } catch (err) {
      setAccountBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not send the code',
      })
    } finally {
      setSendingCode(false)
    }
  }

  async function revokeDevice(deviceId: string) {
    setBusyDeviceId(deviceId)
    setDeviceBanner(null)
    try {
      const res = await fetch('/api/auth/devices', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      })
      if (!res.ok) throw new Error('Could not forget that browser')
      setDeviceBanner({
        type: 'success',
        text: 'Browser forgotten. It will need an emailed code next time.',
      })
      loadDevices()
    } catch (err) {
      setDeviceBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not forget that browser',
      })
    } finally {
      setBusyDeviceId(null)
    }
  }

  async function revokeAllDevices() {
    if (
      !confirm(
        'Sign out everywhere and forget every browser, including this one?\n\nYou will need your password and a fresh emailed code to get back in.'
      )
    ) {
      return
    }
    setBusyDeviceId('__all__')
    try {
      const res = await fetch('/api/auth/devices', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      if (!res.ok) throw new Error('Could not revoke')
      window.location.href = '/login'
    } catch (err) {
      setDeviceBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not revoke',
      })
      setBusyDeviceId(null)
    }
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
      setAccountBanner({ type: 'error', text: 'Re-enter your current password and the emailed code.' })
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

  return (
    <div className="space-y-6">
      {/* ── Section 0: Business / Invoicing Details ── */}
      <section className="bg-white border border-brown-light rounded-2xl p-6 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-brown-dark mb-1">Business &amp; invoicing details</h2>
        <p className="text-xs text-brown-subtle mb-5">
          These details are automatically pre-filled every time you create a new invoice. You can still override them per invoice.
        </p>
        <form onSubmit={saveOwner} className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="IBAN">
              <input type="text" value={ownerIban} onChange={e => setOwnerIban(e.target.value)} placeholder="NL00 BANK 0000 0000 00" />
            </Field>
            <Field label="BIC / SWIFT">
              <input type="text" value={ownerBic} onChange={e => setOwnerBic(e.target.value)} placeholder="INGBNL2A" />
            </Field>
            <Field label="Bank name">
              <input type="text" value={ownerBankName} onChange={e => setOwnerBankName(e.target.value)} placeholder="ING Bank" />
            </Field>
            <Field label="Account holder name">
              <input type="text" value={ownerAccountHolder} onChange={e => setOwnerAccountHolder(e.target.value)} placeholder="Engaging UX Design" />
            </Field>
            <Field label="Your VAT number" hint="Mandatory on every invoice (EU law)">
              <input type="text" value={ownerVat} onChange={e => setOwnerVat(e.target.value)} placeholder="NL000000000B01" />
            </Field>
            <Field label="Your KvK number" hint="Required for Netherlands registration">
              <input type="text" value={ownerKvk} onChange={e => setOwnerKvk(e.target.value)} placeholder="12345678" />
            </Field>
          </div>
          {ownerBanner && <Banner banner={ownerBanner} />}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingOwner}
              className="px-5 py-2.5 rounded-lg bg-brown-rust hover:bg-brown-rust/90 text-brown-pale font-semibold transition-colors disabled:opacity-50 text-sm"
            >
              {savingOwner ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </form>
      </section>

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
            onSendCode={sendReauthCode}
            sending={sendingCode}
            cooldown={codeCooldown}
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

      {/* ── Section 2: Trusted browsers ── */}
      <section className="bg-white border border-brown-light rounded-2xl p-6 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-brown-dark mb-1">Trusted browsers</h2>
        <p className="text-xs text-brown-subtle mb-5">
          These browsers can sign in with your email and password alone, without an emailed code.
          Trust lasts {trustDays} days and is never extended — each one will ask for a code again
          when it lapses. Up to {maxDevices} browsers are kept; the least recently used is
          dropped after that.
        </p>

        {deviceBanner && (
          <div className="mb-4">
            <Banner banner={deviceBanner} />
          </div>
        )}

        {devices === null ? (
          <p className="text-sm text-brown-subtle py-3">Loading…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-brown-subtle py-3">
            No trusted browsers. Every sign-in will ask for an emailed code.
          </p>
        ) : (
          <ul className="divide-y divide-brown-light border-y border-brown-light mb-5">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-brown-dark flex items-center gap-2 flex-wrap">
                    {d.label}
                    {d.isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brown-rust/15 text-brown-rust">
                        This browser
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-brown-subtle mt-0.5">
                    Last used {formatWhen(d.lastUsedAt)} · trust ends {formatWhen(d.expiresAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => revokeDevice(d.id)}
                  disabled={busyDeviceId !== null}
                  className="shrink-0 text-xs font-semibold text-brown-rust hover:text-brown-dark underline underline-offset-2 disabled:opacity-40"
                >
                  {busyDeviceId === d.id ? 'Removing…' : 'Forget'}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={revokeAllDevices}
            disabled={busyDeviceId !== null}
            className="px-5 py-2.5 rounded-lg bg-brown-dark hover:bg-brown-mid text-brown-pale font-semibold transition-colors disabled:opacity-50 text-sm"
          >
            {busyDeviceId === '__all__' ? 'Signing out…' : 'Sign out everywhere'}
          </button>
        </div>
        <p className="text-[11px] text-brown-subtle mt-2 text-right">
          Forgets every browser and ends every active session, including this one.
        </p>
      </section>
    </div>
  )
}

function formatWhen(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
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
  onSendCode,
  sending,
  cooldown,
}: {
  currentPassword: string
  setCurrentPassword: (v: string) => void
  code: string
  setCode: (v: string) => void
  onSendCode: () => void
  sending: boolean
  cooldown: number
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
      <div className="block">
        <span className="block text-xs font-bold uppercase tracking-wider text-brown-muted mb-1.5">
          Emailed code
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            placeholder="000000"
            className="font-mono tracking-[0.2em] flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={onSendCode}
            disabled={sending || cooldown > 0}
            className="shrink-0 px-3 rounded-lg border border-brown-rust/40 text-brown-rust hover:bg-brown-rust/10 text-xs font-semibold transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            {cooldown > 0 ? `${cooldown}s` : sending ? 'Sending…' : 'Send code'}
          </button>
        </div>
        <span className="block text-[11px] text-brown-subtle mt-1">
          Sent to your admin email. Valid for 10 minutes.
        </span>
      </div>
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
