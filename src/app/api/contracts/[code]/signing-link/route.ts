import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { recordEvent } from '@/lib/contractEvents'

export const dynamic = 'force-dynamic'

const TOKEN_DAYS = 14

/**
 * Mint a signing link without emailing anyone.
 *
 * `send-for-signature` is the only other way to get a token, and it always mails the
 * client — so wanting a link to paste into WhatsApp meant sending an email you did not
 * want sent. This separates the two: minting is a local act, delivering is a choice.
 *
 * An existing, unexpired token is returned as-is rather than replaced. Regenerating
 * invalidates whatever link the client is already holding, so it happens only when
 * asked for explicitly.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  const contractCode = decodeURIComponent(code)

  const contract = await prisma.contract.findUnique({
    where: { contractCode },
    select: { id: true, status: true, signingToken: true, signingTokenExpiresAt: true },
  })
  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  if (contract.status === 'SIGNED') {
    return NextResponse.json({ error: 'This contract is already signed.' }, { status: 409 })
  }
  if (contract.status === 'CANCELLED') {
    return NextResponse.json(
      { error: 'This contract is cancelled. Reactivate it before creating a signing link.' },
      { status: 409 },
    )
  }

  const body = await req.json().catch(() => ({} as { force?: boolean }))
  const force = body?.force === true

  const stillValid =
    !!contract.signingToken &&
    !!contract.signingTokenExpiresAt &&
    contract.signingTokenExpiresAt > new Date()

  let token = contract.signingToken
  let expiresAt = contract.signingTokenExpiresAt

  if (!stillValid || force) {
    token = crypto.randomBytes(32).toString('hex')
    expiresAt = new Date(Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000)
    await prisma.contract.update({
      where: { id: contract.id },
      // Deliberately does not touch sentAt or status: nothing has been sent to anyone
      // yet, and stamping either would misreport a link that may never be shared.
      data: { signingToken: token, signingTokenExpiresAt: expiresAt },
    })
  }

  // Built from the host actually being browsed, so a copied link always matches the
  // domain in the address bar rather than whatever APP_URL happens to hold.
  const host = req.headers.get('host')
  const origin = req.headers.get('origin') || (host ? `https://${host}` : '')

  if (!stillValid || force) {
    await recordEvent(contract.id, 'signing_link',
      force ? 'Signing link regenerated — any earlier link stopped working' : 'Signing link created',
      session.email)
  }

  return NextResponse.json({
    ok: true,
    url: `${origin}/sign/${token}`,
    expiresAt,
    regenerated: !stillValid || force,
  })
}
