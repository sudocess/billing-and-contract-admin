import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Shared layout for all authenticated admin sections (invoices, future contracts, etc.).
 * The `(admin)` route group does not affect URLs — pages stay at /invoices, /contracts, ...
 * but they all share this Sidebar + main wrapper.
 *
 * proxy.ts only checks that the session JWT is signed and unexpired — it can't see the
 * "sign out everywhere" watermark without a database round trip at the edge. readSession()
 * does check it, so every admin page passes through it here as well.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 md:ml-60 pt-14 md:pt-0 min-h-screen flex flex-col">
        {children}
      </main>
    </div>
  )
}
