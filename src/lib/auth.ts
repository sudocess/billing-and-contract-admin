import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies, headers } from 'next/headers'
import crypto from 'crypto'
import { prisma } from './prisma'

const SESSION_COOKIE = 'invoice_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

const DEVICE_COOKIE = 'invoice_admin_device'
// Only /api/auth/* ever reads this cookie, so don't ship it on every page and asset request.
const DEVICE_COOKIE_PATH = '/api/auth'
export const DEVICE_TRUST_DAYS = 30
const DEVICE_MAX_AGE = 60 * 60 * 24 * DEVICE_TRUST_DAYS
/** Trusting an unbounded number of browsers quietly widens the password-only window. */
export const MAX_TRUSTED_DEVICES = 5

export const LOGIN_CODE_TTL_MINUTES = 10
export const LOGIN_CODE_MAX_ATTEMPTS = 5
export const LOGIN_CODE_RESEND_SECONDS = 60

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

/* ────────────────────────────────────────────────────────────────────────────
   Emailed one-time login code
   ──────────────────────────────────────────────────────────────────────────── */

/** Six digits, uniformly distributed. `randomInt` is rejection-sampled, so 000000 is as likely as any other. */
export function generateLoginCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

export interface LoginCodeState {
  loginCodeHash: string | null
  loginCodeExpiresAt: Date | null
  loginCodeAttempts: number
  loginCodeSentAt: Date | null
}

/** Seconds the caller must wait before another code may be sent, or 0 if they may send now. */
export function resendCooldownRemaining(user: Pick<LoginCodeState, 'loginCodeSentAt'>): number {
  if (!user.loginCodeSentAt) return 0
  const elapsed = (Date.now() - user.loginCodeSentAt.getTime()) / 1000
  return Math.max(0, Math.ceil(LOGIN_CODE_RESEND_SECONDS - elapsed))
}

/**
 * Replace any outstanding code with a fresh one and return the plaintext so the
 * caller can email it. Only the bcrypt hash is persisted.
 */
export async function issueLoginCode(userId: string): Promise<string> {
  const code = generateLoginCode()
  await prisma.adminUser.update({
    where: { id: userId },
    data: {
      loginCodeHash: await bcrypt.hash(code, 10),
      loginCodeExpiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MINUTES * 60 * 1000),
      loginCodeAttempts: 0,
      loginCodeSentAt: new Date(),
    },
  })
  return code
}

export async function clearLoginCode(userId: string): Promise<void> {
  await prisma.adminUser.update({
    where: { id: userId },
    data: {
      loginCodeHash: null,
      loginCodeExpiresAt: null,
      loginCodeAttempts: 0,
      loginCodeSentAt: null,
    },
  })
}

export type LoginCodeResult = 'ok' | 'no-code' | 'expired' | 'too-many-attempts' | 'mismatch'

/**
 * Check a submitted code. A wrong guess burns one of LOGIN_CODE_MAX_ATTEMPTS against
 * this specific code; exhausting them discards the code so a new one must be requested.
 * A correct code is consumed immediately — it can never be replayed.
 */
export async function verifyLoginCode(
  userId: string,
  submitted: string,
  state: LoginCodeState
): Promise<LoginCodeResult> {
  if (!state.loginCodeHash || !state.loginCodeExpiresAt) return 'no-code'

  if (state.loginCodeExpiresAt.getTime() <= Date.now()) {
    await clearLoginCode(userId)
    return 'expired'
  }

  if (state.loginCodeAttempts >= LOGIN_CODE_MAX_ATTEMPTS) {
    await clearLoginCode(userId)
    return 'too-many-attempts'
  }

  const cleaned = submitted.replace(/\D/g, '')
  const ok = cleaned.length === 6 && (await bcrypt.compare(cleaned, state.loginCodeHash))

  if (!ok) {
    const attempts = state.loginCodeAttempts + 1
    if (attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
      await clearLoginCode(userId)
      return 'too-many-attempts'
    }
    await prisma.adminUser.update({
      where: { id: userId },
      data: { loginCodeAttempts: attempts },
    })
    return 'mismatch'
  }

  await clearLoginCode(userId)
  return 'ok'
}

/* ────────────────────────────────────────────────────────────────────────────
   Trusted devices — 30 days of email + password only
   ──────────────────────────────────────────────────────────────────────────── */

function hashDeviceToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Coarse, human-readable browser label for the device list. Not a fingerprint. */
export async function describeCurrentDevice(): Promise<string> {
  const ua = (await headers()).get('user-agent') ?? ''
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser'
  const os =
    /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown OS'
  return `${browser} on ${os}`
}

async function setDeviceCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies()
  store.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: DEVICE_COOKIE_PATH,
    expires: expiresAt,
  })
}

/**
 * Mint a new trust token for this browser and set the cookie. Called only after a
 * code has actually been verified. Returns the device label so the caller can tell
 * the owner a new browser was trusted.
 *
 * Oldest trust is dropped once MAX_TRUSTED_DEVICES is reached.
 */
export async function trustCurrentDevice(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + DEVICE_MAX_AGE * 1000)
  const label = await describeCurrentDevice()

  const existing = await prisma.trustedDevice.findMany({
    where: { userId },
    orderBy: { lastUsedAt: 'desc' },
    select: { id: true },
  })
  const surplus = existing.slice(MAX_TRUSTED_DEVICES - 1)
  if (surplus.length > 0) {
    await prisma.trustedDevice.deleteMany({ where: { id: { in: surplus.map((d) => d.id) } } })
  }

  await prisma.trustedDevice.create({
    data: { userId, tokenHash: hashDeviceToken(token), label, expiresAt },
  })

  await setDeviceCookie(token, expiresAt)
  return label
}

/**
 * Resolve the device cookie to a live trust row for this user, or null.
 *
 * The token is rotated on every successful use. A cookie copied off this machine
 * therefore stops working the moment the real browser signs in again, instead of
 * staying valid alongside it for the rest of the 30 days. `expiresAt` is deliberately
 * left untouched — the window is hard, not sliding.
 */
export async function readTrustedDevice(userId: string) {
  const store = await cookies()
  const token = store.get(DEVICE_COOKIE)?.value
  if (!token) return null

  const device = await prisma.trustedDevice.findUnique({
    where: { tokenHash: hashDeviceToken(token) },
  })
  if (!device || device.userId !== userId) return null

  if (device.expiresAt.getTime() <= Date.now()) {
    await prisma.trustedDevice.delete({ where: { id: device.id } }).catch(() => {})
    return null
  }

  const rotated = crypto.randomBytes(32).toString('base64url')
  await prisma.trustedDevice.update({
    where: { id: device.id },
    data: { tokenHash: hashDeviceToken(rotated), lastUsedAt: new Date() },
  })
  await setDeviceCookie(rotated, device.expiresAt)

  return device
}

export async function clearDeviceCookie(): Promise<void> {
  const store = await cookies()
  // Must match the path the cookie was written with, or the browser keeps it.
  store.set(DEVICE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: DEVICE_COOKIE_PATH,
    maxAge: 0,
  })
}

/** Forget this browser only — the one calling. */
export async function forgetCurrentDevice(userId: string): Promise<void> {
  const store = await cookies()
  const token = store.get(DEVICE_COOKIE)?.value
  if (token) {
    await prisma.trustedDevice
      .deleteMany({ where: { userId, tokenHash: hashDeviceToken(token) } })
      .catch(() => {})
  }
  await clearDeviceCookie()
}

/**
 * Forget every browser and invalidate every outstanding session JWT. Use this if a
 * laptop or phone goes missing.
 */
export async function revokeAllDevices(userId: string): Promise<void> {
  await prisma.trustedDevice.deleteMany({ where: { userId } })
  await prisma.adminUser.update({
    where: { id: userId },
    data: { sessionsValidFrom: new Date() },
  })
  await clearDeviceCookie()
}

export async function listTrustedDevices(userId: string) {
  const store = await cookies()
  const token = store.get(DEVICE_COOKIE)?.value
  const currentHash = token ? hashDeviceToken(token) : null

  // Sweep lapsed rows so the table doesn't retain device labels past their purpose.
  await prisma.trustedDevice.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } })

  const devices = await prisma.trustedDevice.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
  })

  return devices.map((d) => ({
    id: d.id,
    label: d.label,
    createdAt: d.createdAt,
    lastUsedAt: d.lastUsedAt,
    expiresAt: d.expiresAt,
    isCurrent: currentHash !== null && d.tokenHash === currentHash,
  }))
}

export async function revokeDeviceById(userId: string, deviceId: string): Promise<boolean> {
  const { count } = await prisma.trustedDevice.deleteMany({ where: { id: deviceId, userId } })
  return count > 0
}

/* ────────────────────────────────────────────────────────────────────────────
   Sessions
   ──────────────────────────────────────────────────────────────────────────── */

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
  return readSessionFromToken(store.get(SESSION_COOKIE)?.value)
}

export async function readSessionFromToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const userId = payload.userId as string
    const issuedAt = typeof payload.iat === 'number' ? payload.iat * 1000 : 0

    // Stateless JWTs can't be revoked, so honour the revoke-all watermark here.
    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { sessionsValidFrom: true },
    })
    if (!user) return null
    if (issuedAt < user.sessionsValidFrom.getTime()) return null

    return { userId, email: payload.email as string }
  } catch {
    return null
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const DEVICE_COOKIE_NAME = DEVICE_COOKIE

export async function getAdminUser() {
  return prisma.adminUser.findFirst()
}

export async function adminUserExists(): Promise<boolean> {
  const count = await prisma.adminUser.count()
  return count > 0
}

/* ────────────────────────────────────────────────────────────────────────────
   Password lockout
   ──────────────────────────────────────────────────────────────────────────── */

export const MAX_FAILED_ATTEMPTS = 5
export const LOCKOUT_MINUTES = 15

export function isLocked(user: { failedAttempts: number; lockedUntil: Date | null }): boolean {
  if (!user.lockedUntil) return false
  return user.lockedUntil.getTime() > Date.now()
}

/**
 * Count one failure and lock the account once the threshold is crossed.
 *
 * The increment is done in the database rather than read-modify-write in Node, so
 * requests arriving in parallel across serverless instances can't each read "3" and
 * collectively blow past the cap. This counter is the only durable rate limit the app
 * has, so it also backstops wrong emailed codes, not just wrong passwords.
 */
export async function registerFailedAttempt(userId: string): Promise<void> {
  const user = await prisma.adminUser
    .update({
      where: { id: userId },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true },
    })
    .catch(() => null)

  if (!user) return

  if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.adminUser.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) },
    })
  }
}

export async function resetFailedAttempts(userId: string): Promise<void> {
  await prisma.adminUser.update({
    where: { id: userId },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })
}
