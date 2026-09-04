import { NextResponse } from 'next/server'
import {
  DEVICE_TRUST_DAYS,
  listTrustedDevices,
  MAX_TRUSTED_DEVICES,
  readSession,
  revokeAllDevices,
  revokeDeviceById,
} from '@/lib/auth'

/** Browsers currently inside their 30-day trust window. */
export async function GET() {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return NextResponse.json({
    devices: await listTrustedDevices(session.userId),
    trustDays: DEVICE_TRUST_DAYS,
    maxDevices: MAX_TRUSTED_DEVICES,
  })
}

/**
 * Forget one browser, or all of them. Revoking all also invalidates every outstanding
 * session token, so a stolen laptop is fully cut off rather than merely asked for a
 * code the next time it signs in.
 */
export async function DELETE(req: Request) {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { deviceId, all } = await req.json().catch(() => ({ deviceId: undefined, all: false }))

  if (all) {
    await revokeAllDevices(session.userId)
    return NextResponse.json({ ok: true, revokedAll: true })
  }

  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId or all is required' }, { status: 400 })
  }

  const removed = await revokeDeviceById(session.userId, String(deviceId))
  if (!removed) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
