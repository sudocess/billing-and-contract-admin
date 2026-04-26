import { NextResponse } from 'next/server'
import {
  consumeRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCodes,
  isLocked,
  readSession,
  registerFailedAttempt,
  resetFailedAttempts,
  verifyPassword,
  verifyTotp,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Generate a fresh batch of 10 recovery codes and replace the existing ones.
 * Returns the new plaintext codes ONCE — the client must save them immediately.
 * Requires current password + TOTP / recovery code.
 */
export async function POST(req: Request) {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { currentPassword, code } = await req.json()
  if (!currentPassword || !code) {
    return NextResponse.json(
      { error: 'Current password and 2FA / recovery code are required' },
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

  const newCodes = generateRecoveryCodes(10)
  const newHashes = await hashRecoveryCodes(newCodes)

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { recoveryCodes: newHashes },
  })

  await resetFailedAttempts(user.id)

  return NextResponse.json({ recoveryCodes: newCodes })
}
