import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  const contract = await prisma.contract.findUnique({ where: { contractCode: code } })
  if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ contract })
}

const VALID_STATUSES = ['DRAFT', 'PENDING', 'SIGNED', 'CANCELLED'] as const
type Status = (typeof VALID_STATUSES)[number]

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const status = body.status as Status | undefined
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    const updated = await prisma.contract.update({
      where: { contractCode: code },
      data: {
        status,
        signedAt: status === 'SIGNED' ? new Date() : undefined,
      },
    })
    return NextResponse.json({ ok: true, status: updated.status })
  } catch (err) {
    console.error('[contracts] PATCH failed', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  try {
    await prisma.contract.delete({ where: { contractCode: code } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contracts] DELETE failed', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
