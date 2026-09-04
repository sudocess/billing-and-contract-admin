import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  const old = await prisma.contract.findUnique({ where: { contractCode: code } })
  if (!old) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (old.status === 'SUPERSEDED') {
    return NextResponse.json({ error: 'Already superseded' }, { status: 409 })
  }

  const newCode = `${old.contractCode}-v2`

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.contract.update({
      where: { id: old.id },
      data: { status: 'SUPERSEDED', archivedAt: new Date() },
    })

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, contractCode, installments, ...rest } = old

    const created = await tx.contract.create({
      data: {
        ...rest,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: rest.data as any,
        // Nullable Json can't be handed a bare `null` on create — Prisma wants
        // DbNull or the field omitted. Omitting it lets the column default to null,
        // and a schedule that does exist carries forward to the new version.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(installments === null ? {} : { installments: installments as any }),
        contractCode: newCode,
        status: 'DRAFT',
        signedAt: null,
        signerName: null,
        signerIp: null,
        signingToken: null,
        signingTokenExpiresAt: null,
        sentAt: null,
        archivedAt: null,
        supersedesId: old.id,
        versionNote: `Supersedes ${old.contractCode} (signed ${old.signedAt?.toISOString() ?? 'never'})`,
      },
    })
    return { old: updated, new: created }
  })

  return NextResponse.json({
    ok: true,
    superseded: result.old.contractCode,
    new: result.new.contractCode,
  })
}
