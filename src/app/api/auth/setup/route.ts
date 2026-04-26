import { NextResponse } from 'next/server'
import {
  adminUserExists,
  createSession,
  generateRecoveryCodes,
  hashPassword,
  hashRecoveryCodes,
  setSessionCookie,
  verifyTotp,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  if (await adminUserExists()) {
    return NextResponse.json({ error: 'Setup already completed' }, { status: 400 })
  }

  const { email, password, secret, totpCode } = await req.json()

  if (!email || !password || !secret || !totpCode) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  if (typeof password !== 'string' || password.length < 12) {
    return NextResponse.json(
      { error: 'Password must be at least 12 characters' },
      { status: 400 }
    )
  }

  if (!(await verifyTotp(totpCode, secret))) {
    return NextResponse.json(
      { error: 'Invalid 2FA code. Make sure your phone time is correct.' },
      { status: 400 }
    )
  }

  const passwordHash = await hashPassword(password)
  const recoveryCodes = generateRecoveryCodes(10)
  const recoveryHashes = await hashRecoveryCodes(recoveryCodes)

  const user = await prisma.adminUser.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      totpSecret: secret,
      recoveryCodes: recoveryHashes,
    },
  })

  const token = await createSession({ userId: user.id, email: user.email })
  await setSessionCookie(token)

  return NextResponse.json({ recoveryCodes })
}
