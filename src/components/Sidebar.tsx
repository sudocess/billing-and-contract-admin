'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

function getIsoWeekNumber(date: Date) {
  const dateUtc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = dateUtc.getUTCDay() || 7
  dateUtc.setUTCDate(dateUtc.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(dateUtc.getUTCFullYear(), 0, 1))
  return Math.ceil((((dateUtc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function formatDisplayDate(date: Date) {
  const day = date.getDate()
  const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date)
  const year = date.getFullYear()
  return `${day}, ${month} ${year}`
}

type NavSection = {
  title: string
  items: Array<{ label: string; href: string; comingSoon?: boolean; icon: React.ReactNode }>
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" />
            <rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" />
            <rect x="3" y="16" width="7" height="5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Invoicing',
    items: [
      {
        label: 'New Invoice',
        href: '/invoices/new',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        ),
      },
      {
        label: 'Invoice History',
        href: '/invoices',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Contracts',
    items: [
      {
        label: 'New Contract',
        href: '/contracts/new',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        ),
      },
      {
        label: 'Contract History',
        href: '/contracts',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M9 13h6M9 17h4" />
          </svg>
        ),
      },
      {
        label: 'Clients',
        href: '/clients',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        label: 'Settings',
        href: '/settings',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        ),
      },
    ],
  },
]

async function handleSignOut() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

export default function Sidebar() {
  const pathname = usePathname()
  const [now, setNow] = useState<Date | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Close drawer on route change (mobile)
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/invoices') return pathname === '/invoices'
    if (href === '/contracts') return pathname === '/contracts'
    return pathname.startsWith(href)
  }

  const displayDate = now ? formatDisplayDate(now) : ''
  const weekNumber: number | string = now ? getIsoWeekNumber(now) : ''

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[90] h-14 bg-brown-mid border-b border-white/10 flex items-center justify-between px-4">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-brown-pale"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Image
          src="/engaginguxdesign-logo-white.svg"
          alt="Engaging UX Design"
          width={120}
          height={42}
          className="object-contain h-8 w-auto"
          priority
        />
        <button
          type="button"
          aria-label="Sign out"
          onClick={handleSignOut}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.06] hover:bg-brown-rust/40 border border-white/10 text-brown-pale"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[99]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <nav
        className={`w-60 min-h-screen bg-brown-mid flex flex-col shrink-0 fixed left-0 top-0 bottom-0 z-[100] transform transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
      {/* Logo */}
      <div className="px-5 pt-7 pb-5 border-b border-white/10">
        <div className="flex justify-center">
          <Image
            src="/engaginguxdesign-logo-white.svg"
            alt="Engaging UX Design"
            width={170}
            height={62}
            className="object-contain"
            priority
          />
        </div>
        <div className="text-[0.7rem] text-white/50 mt-1.5 text-center uppercase tracking-[0.18em]">
          Admin Dashboard
        </div>

        {/* Quick actions */}
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            title="Refresh"
            aria-label="Refresh"
            onClick={() => window.location.reload()}
            className="group flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-colors"
          >
            <Image
              src="/refresh-button.png"
              alt=""
              width={16}
              height={16}
              className="opacity-80 group-hover:opacity-100 transition"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </button>

          <Link
            href="/"
            title="Home"
            aria-label="Home"
            className="group flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-colors"
          >
            <Image
              src="/dashboard.png"
              alt=""
              width={16}
              height={16}
              className="opacity-80 group-hover:opacity-100 transition"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </Link>

          <button
            type="button"
            title="Sign out"
            aria-label="Sign out"
            onClick={handleSignOut}
            className="group flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-brown-rust/50 border border-white/10 transition-colors text-brown-pale/80 hover:text-brown-pale"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        {/* Date / Week meta */}
        <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-white/55">
          <div className="flex items-baseline gap-1">
            <span className="uppercase tracking-wider text-white/40">Date</span>
            <span className="text-brown-pale font-medium" suppressHydrationWarning>{displayDate}</span>
          </div>
          <span className="w-px h-3 bg-white/15" />
          <div className="flex items-baseline gap-1">
            <span className="uppercase tracking-wider text-white/40">Wk</span>
            <span className="text-brown-pale font-medium" suppressHydrationWarning>{weekNumber}</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="p-3 flex-1">
        {navSections.map((section) => (
          <div key={section.title} className="mb-2">
            <div className="text-[0.65rem] font-extrabold tracking-[0.12em] uppercase text-white/30 px-3 py-2">
              {section.title}
            </div>
            {section.items.map((item) =>
              item.comingSoon ? (
                <div
                  key={item.href}
                  title="Coming soon"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[0.88rem] font-medium mb-0.5 text-white/30 cursor-not-allowed select-none"
                >
                  <span className="w-4 h-4 shrink-0">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[0.6rem] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50">
                    Soon
                  </span>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[0.88rem] font-medium mb-0.5 transition-all
                    ${isActive(item.href)
                      ? 'bg-brown-rust text-brown-pale'
                      : 'text-white/70 hover:bg-white/[0.08] hover:text-brown-pale'
                    }`}
                >
                  <span className="w-4 h-4 shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              )
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brown-rust flex items-center justify-center font-heading text-xs font-extrabold text-brown-pale shrink-0">
            EUX
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.82rem] text-white/80 font-semibold truncate">Admin</div>
            <div className="text-[0.72rem] text-white/40 truncate">engaginguxdesign.com</div>
          </div>
          <button
            type="button"
            title="Sign out"
            aria-label="Sign out"
            onClick={handleSignOut}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-colors text-white/70 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
    </>
  )
}
