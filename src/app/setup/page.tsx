import { redirect } from 'next/navigation'
import { adminUserExists } from '@/lib/auth'
import SetupClient from './SetupClient'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  if (await adminUserExists()) {
    redirect('/login')
  }
  return <SetupClient />
}
