import { NextResponse } from 'next/server'
import {
  adminUserExists,
  createSession,
  hashPassword,
  setSessionCookie,
  trustCurrentDevice,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * First-run setup. There is no authenticator app to enrol any more — the second factor
 * is a code emailed at sign-in — so this only captures the email and password, then
 * trusts the browser that did the setup.
 */
export async function POST(req: Request) {
  if (await adminUserExists()) {
    return NextResponse.json({ error: 'Setup already completed' }, { status: 400 })
  }

  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const cleanEmail = String(email).toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  if (typeof password !== 'string' || password.length < 12) {
    return NextResponse.json(
      { error: 'Password must be at least 12 characters' },
      { status: 400 }
    )
  }

  const user = await prisma.adminUser.create({
    data: {
      email: cleanEmail,
      passwordHash: await hashPassword(password),
    },
  })

  await trustCurrentDevice(user.id)
  await setSessionCookie(await createSession({ userId: user.id, email: user.email }))

  return NextResponse.json({ ok: true, email: user.email })
}
