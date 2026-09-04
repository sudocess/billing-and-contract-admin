import { NextResponse } from 'next/server'
import {
  describeCurrentDevice,
  issueLoginCode,
  LOGIN_CODE_TTL_MINUTES,
  clearLoginCode,
  readSession,
  resendCooldownRemaining,
} from '@/lib/auth'
import { sendLoginCodeEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'

/**
 * Email a fresh code to confirm a sensitive change from inside the app (changing the
 * admin email or password). A live session is proof enough to ask for one; the change
 * itself still needs the current password alongside the code.
 */
export async function POST() {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const user = await prisma.adminUser.findUnique({ where: { id: session.userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const cooldown = resendCooldownRemaining(user)
  if (cooldown > 0) {
    return NextResponse.json(
      { error: `A code was just sent. Try again in ${cooldown}s.`, retryAfter: cooldown },
      { status: 429, headers: { 'Retry-After': String(cooldown) } }
    )
  }

  const code = await issueLoginCode(user.id)

  try {
    await sendLoginCodeEmail({
      to: user.email,
      code,
      ttlMinutes: LOGIN_CODE_TTL_MINUTES,
      device: await describeCurrentDevice(),
    })
  } catch (err) {
    await clearLoginCode(user.id)
    console.error('[auth] failed to send re-auth code:', err)
    return NextResponse.json({ error: 'Could not send the code. Try again.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, expiresInMinutes: LOGIN_CODE_TTL_MINUTES })
}
