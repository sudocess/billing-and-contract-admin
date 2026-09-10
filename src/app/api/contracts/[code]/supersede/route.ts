import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { nextContractVersion, parseContractCode } from '@/lib/contracts'
import { recordEvent } from '@/lib/contractEvents'

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
    return NextResponse.json({ error: 'This version has already been replaced.' }, { status: 409 })
  }
  // One open revision at a time: two drafts both claiming to replace the same
  // agreement would leave it ambiguous which one signing should retire.
  const openRevision = await prisma.contract.findFirst({
    where: { supersedesId: old.id, status: { in: ['DRAFT', 'PENDING'] } },
    select: { contractCode: true },
  })
  if (openRevision) {
    return NextResponse.json(
      { error: `A revision of this contract already exists (${openRevision.contractCode}). Finish or cancel it first.` },
      { status: 409 },
    )
  }

  // Every code already in the family, so a revision can never reuse one left behind
  // by an earlier attempt.
  const parsed = parseContractCode(old.contractCode)
  // Siblings are the other versions of THIS agreement — same family, so a care plan's
  // revision never collides with the mother contract's.
  const siblings = parsed
    ? await prisma.contract.findMany({
        where: { contractCode: { startsWith: `${parsed.family}-` } },
        select: { contractCode: true },
      })
    : []
  const newCode = nextContractVersion(old.contractCode, siblings.map((c) => c.contractCode))

  const result = await prisma.$transaction(async (tx) => {
    // The previous version stays in force. A revision that is drafted and never
    // signed must not silently void the agreement the client is actually under —
    // the old version is retired at the moment the new one is signed, not before.
    // See src/app/api/sign/[token]/route.ts, which does the retiring.
    const updated = await tx.contract.findUniqueOrThrow({ where: { id: old.id } })

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
        // The signed artefacts belong to the version that was actually signed. Copying
        // them forward would hand a fresh DRAFT someone else's signed PDF and a
        // consent flag for a signature that never happened.
        signedPdf: null,
        signedPdfSha256: null,
        signedPdfSize: null,
        signingReference: null,
        consentConfirmed: false,
        archivedAt: null,
        supersedesId: old.id,
        versionNote: `Revision of ${old.contractCode}${old.signedAt ? ` (signed ${old.signedAt.toISOString().slice(0, 10)})` : ' (never signed)'}`,
      },
    })
    return { old: updated, new: created }
  })

  await recordEvent(result.new.id, 'created',
    `Revision of ${result.old.contractCode}${result.old.signedAt ? ' — the version it revises is signed and stays in force until this one is signed' : ''}`,
    session.email)
  await recordEvent(result.old.id, 'edited',
    `Revision ${result.new.contractCode} drafted. This version remains in force until that one is signed.`,
    session.email)

  return NextResponse.json({
    ok: true,
    superseded: result.old.contractCode,
    new: result.new.contractCode,
  })
}
