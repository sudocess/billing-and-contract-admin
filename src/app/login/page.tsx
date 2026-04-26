import { redirect } from 'next/navigation'
import { adminUserExists, readSession } from '@/lib/auth'
import LoginClient from './LoginClient'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  if (!(await adminUserExists())) {
    redirect('/setup')
  }
  const session = await readSession()
  if (session) redirect('/')
  return <LoginClient />
}
