import { NextResponse } from 'next/server'
import { clearSessionCookie, forgetCurrentDevice, readSession } from '@/lib/auth'

/**
 * Signing out ends the session but keeps this browser trusted — that is the point of
 * the 30-day window. Pass { forgetDevice: true } to drop the trust as well, which is
 * what you want on a shared or borrowed machine.
 */
export async function POST(req: Request) {
  const { forgetDevice } = await req.json().catch(() => ({ forgetDevice: false }))

  if (forgetDevice) {
    const session = await readSession()
    if (session) await forgetCurrentDevice(session.userId)
  }

  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
