'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  contractCode: string
  defaultTo: string
  defaultProjectName: string
  clientFirstName: string
}

export default function SendContractDialog({
  contractCode,
  defaultTo,
  defaultProjectName,
  clientFirstName,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState(
    `Your contract ${contractCode}${defaultProjectName ? ` — ${defaultProjectName}` : ''}`,
  )
  const [message, setMessage] = useState(
    `Hi ${clientFirstName},\n\nPlease find your service agreement below. Click the button to review the full contract.\n\nLet me know if you have any questions or change requests.\n\nBest,\nCess Garcia - de Laat — Engaging UX Design`,
  )
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function send() {
    if (!to.trim()) {
      setBanner({ type: 'error', text: 'Recipient email is required.' })
      return
    }
    setBusy(true)
    setBanner(null)
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(contractCode)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setBanner({ type: 'success', text: `Sent to ${data.to}` })
      setTimeout(() => {
        setOpen(false)
        setBanner(null)
        router.refresh()
      }, 1200)
    } catch (e) {
      setBanner({ type: 'error', text: e instanceof Error ? e.message : 'Send failed' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen(true)}
        title="Email this contract to the client"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        <span>Send to client</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-brown-dark/50 flex items-start justify-center p-4 overflow-auto"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-12 border border-brown-dark/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-brown-dark/10 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle">Email contract</div>
                <h2 className="font-heading text-lg font-extrabold text-brown-dark">Send to client</h2>
              </div>
              <button
                type="button"
                className="text-brown-subtle hover:text-brown-dark text-xl leading-none"
                onClick={() => !busy && setOpen(false)}
                aria-label="Close"
              >×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brown-subtle mb-1.5">
                  To
                </label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-brown-dark/20 bg-white text-sm text-brown-dark focus:outline-none focus:border-brown-rust"
                  placeholder="client@example.com"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brown-subtle mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-brown-dark/20 bg-white text-sm text-brown-dark focus:outline-none focus:border-brown-rust"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brown-subtle mb-1.5">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  className="w-full px-3 py-2 rounded-md border border-brown-dark/20 bg-white text-sm text-brown-dark focus:outline-none focus:border-brown-rust font-body resize-y"
                />
                <div className="text-[11px] text-brown-subtle mt-1.5">
                  A contract summary and a “Review &amp; sign your contract” button linking to a public preview page will be appended automatically.
                </div>
              </div>

              {banner && (
                <div className={`text-sm rounded-md px-3 py-2 ${banner.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  {banner.text}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-brown-dark/10 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setOpen(false)}
                disabled={busy}
              >Cancel</button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={send}
                disabled={busy}
              >{busy ? 'Sending…' : 'Send email'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
