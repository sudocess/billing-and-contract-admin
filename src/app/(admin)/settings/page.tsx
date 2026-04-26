import { redirect } from 'next/navigation'
import { readSession, getAdminUser } from '@/lib/auth'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await readSession()
  if (!session) redirect('/login')
  const user = await getAdminUser()
  return (
    <div className="px-6 py-8 max-w-3xl mx-auto w-full">
      <header className="mb-8">
        <div className="text-[0.7rem] font-extrabold tracking-[0.12em] uppercase text-brown-rust mb-2">
          Account
        </div>
        <h1 className="font-heading text-3xl font-black text-brown-dark mb-1">Settings</h1>
        <p className="text-sm text-brown-muted">
          Manage your admin email, password, and recovery codes. All changes require your current
          password and a 2FA code.
        </p>
      </header>
      <SettingsClient currentEmail={user?.email ?? ''} />
    </div>
  )
}
