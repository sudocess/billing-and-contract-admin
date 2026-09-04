import { NextResponse } from 'next/server'
import {
  createSession,
  describeCurrentDevice,
  isLocked,
  issueLoginCode,
  LOGIN_CODE_TTL_MINUTES,
  clearLoginCode,
  readTrustedDevice,
  registerFailedAttempt,
  resendCooldownRemaining,
  resetFailedAttempts,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth'
import { sendLoginCodeEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'

/** c***delaat@gmail.com — enough to confirm which inbox to check, not enough to harvest. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '•••'
  const head = local.slice(0, 1)
  const tail = local.length > 4 ? local.slice(-3) : ''
  return `${head}${'*'.repeat(3)}${tail}@${domain}`
}

/**
 * Step 1 of sign-in: check the password, then either wave a already-trusted browser
 * straight through, or email a one-time code for step 2.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { email, password } = body as Record<string, unknown>

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
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

  // Browser already proved itself with a code inside the trust window — no second factor.
  const device = await readTrustedDevice(user.id)
  if (device) {
    await resetFailedAttempts(user.id)
    await setSessionCookie(await createSession({ userId: user.id, email: user.email }))
    return NextResponse.json({ ok: true, trusted: true })
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
    // Don't strand the user behind a cooldown for a code that never arrived.
    await clearLoginCode(user.id)
    console.error('[auth] failed to send login code:', err)
    return NextResponse.json(
      { error: 'Could not send the login code. Check your mail settings and try again.' },
      { status: 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    codeSent: true,
    maskedEmail: maskEmail(user.email),
    expiresInMinutes: LOGIN_CODE_TTL_MINUTES,
  })
}
