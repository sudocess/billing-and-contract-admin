import { redirect } from 'next/navigation'
import { adminUserExists, readSession } from '@/lib/auth'
import LoginClient from './LoginClient'

export const dynamic = 'force-dynamic'

/**
 * Only same-origin, non-protocol-relative paths may be followed after sign-in —
 * otherwise `?next=` is an open redirect for phishing.
 */
function safeNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  if (value.startsWith('/\\')) return '/'
  return value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await adminUserExists())) {
    redirect('/setup')
  }

  const params = await searchParams
  const next = safeNext(params.next)

  const session = await readSession()
  if (session) redirect(next)

  return <LoginClient next={next} />
}
