import { NextResponse } from 'next/server'
import {
  consumeRecoveryCode,
  hashPassword,
  isLocked,
  readSession,
  registerFailedAttempt,
  resetFailedAttempts,
  verifyPassword,
  verifyTotp,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Update the admin account: email and/or password.
 * Requires re-authentication via current password + TOTP/recovery code.
 */
export async function POST(req: Request) {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { currentPassword, code, newEmail, newPassword } = await req.json()

  if (!currentPassword || !code) {
    return NextResponse.json(
      { error: 'Current password and 2FA / recovery code are required' },
      { status: 400 },
    )
  }
  if (!newEmail && !newPassword) {
    return NextResponse.json(
      { error: 'Provide a new email and/or new password' },
      { status: 400 },
    )
  }
  if (newPassword && String(newPassword).length < 10) {
    return NextResponse.json(
      { error: 'New password must be at least 10 characters' },
      { status: 400 },
    )
  }

  const user = await prisma.adminUser.findUnique({ where: { id: session.userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (isLocked(user)) {
    return NextResponse.json({ error: 'Account locked. Try again later.' }, { status: 423 })
  }

  const passwordOk = await verifyPassword(currentPassword, user.passwordHash)
  if (!passwordOk) {
    await registerFailedAttempt(user.id)
    return NextResponse.json({ error: 'Invalid current password' }, { status: 401 })
  }

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

  const data: { email?: string; passwordHash?: string } = {}
  if (newEmail) {
    const cleanEmail = String(newEmail).toLowerCase().trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    data.email = cleanEmail
  }
  if (newPassword) {
    data.passwordHash = await hashPassword(String(newPassword))
  }

  try {
    await prisma.adminUser.update({ where: { id: user.id }, data })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'That email is already in use' }, { status: 409 })
    }
    throw err
  }

  await resetFailedAttempts(user.id)

  return NextResponse.json({
    ok: true,
    email: data.email ?? user.email,
    passwordChanged: !!newPassword,
  })
}
