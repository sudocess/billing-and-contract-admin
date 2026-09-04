import { NextResponse } from 'next/server'
import {
  hashPassword,
  isLocked,
  readSession,
  registerFailedAttempt,
  resetFailedAttempts,
  verifyLoginCode,
  verifyPassword,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Update the admin account: email and/or password.
 * Requires the current password plus a freshly emailed code (POST /api/auth/reauth-code),
 * so a stolen session cookie alone cannot take the account over.
 */
export async function POST(req: Request) {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { currentPassword, code, newEmail, newPassword } = body as Record<string, unknown>

  if (!currentPassword || !code) {
    return NextResponse.json(
      { error: 'Current password and an emailed code are required' },
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

  if (!(await verifyPassword(String(currentPassword), user.passwordHash))) {
    await registerFailedAttempt(user.id)
    return NextResponse.json({ error: 'Invalid current password' }, { status: 401 })
  }

  const result = await verifyLoginCode(user.id, String(code), user)
  if (result !== 'ok') {
    await registerFailedAttempt(user.id)
    const message =
      result === 'expired'
        ? 'That code has expired. Send yourself a new one.'
        : result === 'too-many-attempts'
          ? 'Too many incorrect codes. Send yourself a new one.'
          : result === 'no-code'
            ? 'No code is outstanding. Send yourself one first.'
            : 'That code is not correct.'
    return NextResponse.json({ error: message, reason: result }, { status: 401 })
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
