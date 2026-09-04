import { NextResponse } from 'next/server'
import {
  createSession,
  DEVICE_TRUST_DAYS,
  isLocked,
  registerFailedAttempt,
  resetFailedAttempts,
  setSessionCookie,
  trustCurrentDevice,
  verifyLoginCode,
  verifyPassword,
} from '@/lib/auth'
import { sendNewDeviceAlertEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'

/**
 * Step 2 of sign-in: the emailed code.
 *
 * The password is deliberately re-checked here rather than trusted from step 1 —
 * otherwise anyone who could read the code out of the mailbox would hold a complete
 * credential on its own, and the two factors would collapse into one.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { email, password, code, rememberDevice } = body as Record<string, unknown>

  if (!email || !password || !code) {
    return NextResponse.json(
      { error: 'Email, password, and the emailed code are required' },
      { status: 400 }
    )
  }

  const user = await prisma.adminUser.findUnique({
    where: { email: String(email).toLowerCase().trim() },
  })

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  if (isLocked(user)) {
    return NextResponse.json({ error: 'Account locked. Try again later.' }, { status: 423 })
  }

  if (!(await verifyPassword(String(password), user.passwordHash))) {
    await registerFailedAttempt(user.id)
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const result = await verifyLoginCode(user.id, String(code), user)

  if (result !== 'ok') {
    await registerFailedAttempt(user.id)
    const message =
      result === 'expired'
        ? 'That code has expired. Request a new one.'
        : result === 'too-many-attempts'
          ? 'Too many incorrect codes. Request a new one.'
          : result === 'no-code'
            ? 'No code is outstanding. Request a new one.'
            : 'That code is not correct.'
    return NextResponse.json({ error: message, reason: result }, { status: 401 })
  }

  await resetFailedAttempts(user.id)

  const remember = rememberDevice !== false
  if (remember) {
    const label = await trustCurrentDevice(user.id)
    // Fire-and-forget: a mail hiccup must not block a legitimate sign-in, but the owner
    // needs to hear about every new password-only window that opens.
    sendNewDeviceAlertEmail({
      to: user.email,
      device: label,
      trustDays: DEVICE_TRUST_DAYS,
    }).catch((err) => console.error('[auth] failed to send new-device alert:', err))
  }

  await setSessionCookie(await createSession({ userId: user.id, email: user.email }))

  return NextResponse.json({ ok: true, trustedForDays: remember ? DEVICE_TRUST_DAYS : 0 })
}
