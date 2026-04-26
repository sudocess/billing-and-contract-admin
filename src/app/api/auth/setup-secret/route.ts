import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { adminUserExists, generateTotpSecret, getTotpUri } from '@/lib/auth'

export async function GET() {
  if (await adminUserExists()) {
    return NextResponse.json({ error: 'Setup already completed' }, { status: 400 })
  }
  const secret = await generateTotpSecret()
  // Use a placeholder email; the real email is captured at finalize step.
  // Client also re-generates QR after they enter the email.
  return NextResponse.json({ secret })
}

export async function POST(req: Request) {
  if (await adminUserExists()) {
    return NextResponse.json({ error: 'Setup already completed' }, { status: 400 })
  }
  const { email, secret } = await req.json()
  if (!email || !secret) {
    return NextResponse.json({ error: 'Missing email or secret' }, { status: 400 })
  }
  const uri = getTotpUri(email, secret)
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 240 })
  return NextResponse.json({ qrDataUrl, uri })
}
