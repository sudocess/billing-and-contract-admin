import Sidebar from '@/components/Sidebar'

/**
 * Shared layout for all authenticated admin sections (invoices, future contracts, etc.).
 * The `(admin)` route group does not affect URLs — pages stay at /invoices, /contracts, ...
 * but they all share this Sidebar + main wrapper.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 md:ml-60 pt-14 md:pt-0 min-h-screen flex flex-col">
        {children}
      </main>
    </div>
  )
}
