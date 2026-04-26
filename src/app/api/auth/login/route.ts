import { NextResponse } from 'next/server'
import {
  consumeRecoveryCode,
  createSession,
  isLocked,
  registerFailedAttempt,
  resetFailedAttempts,
  setSessionCookie,
  verifyPassword,
  verifyTotp,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { email, password, code } = await req.json()

  if (!email || !password || !code) {
    return NextResponse.json({ error: 'Email, password, and code are required' }, { status: 400 })
  }

  const user = await prisma.adminUser.findUnique({
    where: { email: String(email).toLowerCase().trim() },
  })

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  if (isLocked(user)) {
    return NextResponse.json(
      { error: 'Account locked. Try again later.' },
      { status: 423 }
    )
  }

  const passwordOk = await verifyPassword(password, user.passwordHash)
  if (!passwordOk) {
    await registerFailedAttempt(user.id)
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Accept either TOTP or recovery code
  const cleaned = String(code).trim()
  let codeOk = false

  if (/^\d{6}$/.test(cleaned.replace(/\s/g, ''))) {
    codeOk = await verifyTotp(cleaned, user.totpSecret)
  } else {
    codeOk = await consumeRecoveryCode(user.id, cleaned, user.recoveryCodes)
  }

  if (!codeOk) {
    await registerFailedAttempt(user.id)
    return NextResponse.json({ error: 'Invalid 2FA or recovery code' }, { status: 401 })
  }

  await resetFailedAttempts(user.id)
  const token = await createSession({ userId: user.id, email: user.email })
  await setSessionCookie(token)

  return NextResponse.json({ ok: true })
}
