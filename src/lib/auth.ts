import bcrypt from 'bcryptjs'
import { generateSecret, generateURI, verify as verifyOtp } from 'otplib'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { prisma } from './prisma'

const SESSION_COOKIE = 'invoice_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET not configured')
  return new TextEncoder().encode(secret)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function generateTotpSecret(): Promise<string> {
  return generateSecret()
}

export function getTotpUri(email: string, secret: string): string {
  const appName = process.env.AUTH_APP_NAME || 'Invoice Admin'
  return generateURI({
    issuer: appName,
    label: email,
    secret,
    algorithm: 'sha1',
    digits: 6,
  })
}

export async function verifyTotp(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verifyOtp({ token: token.replace(/\s+/g, ''), secret, window: 1 })
    return result.valid === true
  } catch {
    return false
  }
}

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase()
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`)
  }
  return codes
}

export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c, 10)))
}

export async function consumeRecoveryCode(
  userId: string,
  code: string,
  storedHashes: string[]
): Promise<boolean> {
  const normalized = code.trim().toUpperCase()
  for (let i = 0; i < storedHashes.length; i++) {
    if (await bcrypt.compare(normalized, storedHashes[i])) {
      const remaining = [...storedHashes.slice(0, i), ...storedHashes.slice(i + 1)]
      await prisma.adminUser.update({
        where: { id: userId },
        data: { recoveryCodes: remaining },
      })
      return true
    }
  }
  return false
}

export interface SessionPayload {
  userId: string
  email: string
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret())
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return { userId: payload.userId as string, email: payload.email as string }
  } catch {
    return null
  }
}

export async function readSessionFromToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return { userId: payload.userId as string, email: payload.email as string }
  } catch {
    return null
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE

export async function getAdminUser() {
  return prisma.adminUser.findFirst()
}

export async function adminUserExists(): Promise<boolean> {
  const count = await prisma.adminUser.count()
  return count > 0
}

export const MAX_FAILED_ATTEMPTS = 5
export const LOCKOUT_MINUTES = 15

export function isLocked(user: { failedAttempts: number; lockedUntil: Date | null }): boolean {
  if (!user.lockedUntil) return false
  return user.lockedUntil.getTime() > Date.now()
}

export async function registerFailedAttempt(userId: string): Promise<void> {
  const user = await prisma.adminUser.findUnique({ where: { id: userId } })
  if (!user) return
  const next = user.failedAttempts + 1
  const lockedUntil =
    next >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null
  await prisma.adminUser.update({
    where: { id: userId },
    data: { failedAttempts: next, lockedUntil },
  })
}

export async function resetFailedAttempts(userId: string): Promise<void> {
  await prisma.adminUser.update({
    where: { id: userId },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })
}
