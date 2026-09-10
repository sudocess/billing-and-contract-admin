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
  const parent = await prisma.contract.findUnique({
    where: { contractCode: code },
    include: { changeOrders: true },
  })
  if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (parent.status === 'SUPERSEDED' || parent.status === 'CANCELLED') {
    return NextResponse.json(
      { error: 'Cannot extend the scope of a superseded or cancelled contract' },
      { status: 409 },
    )
  }

  // "Scope extension" is the client-facing name for this: work beyond what the
  // original agreement covered, priced separately. Distinct from a *revision*, which
  // edits an unsigned contract in place and takes the next version number instead.
  const extNumber = (parent.changeOrders.length ?? 0) + 1
  const newCode = `${parent.contractCode}-EXT${extNumber}`

  const created = await prisma.contract.create({
    data: {
      contractCode: newCode,
      status: 'DRAFT',
      // Its own type, not the parent's: this is additional scope, not another
      // instance of whatever the original agreement was.
      contractType: 'extension',
      plan: parent.plan,
      phase: parent.phase,
      phaseLabel: parent.phaseLabel,
      language: parent.language,
      projectName: parent.projectName ? `${parent.projectName} — Scope Extension ${extNumber}` : null,
      deliverables: '',
      phaseStart: null,
      phaseEnd: null,

      clientId: parent.clientId,
      clientName: parent.clientName,
      clientCompany: parent.clientCompany,
      clientEmail: parent.clientEmail,
      clientPhone: parent.clientPhone,
      clientKvk: parent.clientKvk,
      clientVat: parent.clientVat,
      clientAddress: parent.clientAddress,
      clientPostalCode: parent.clientPostalCode,
      clientCity: parent.clientCity,
      clientCountry: parent.clientCountry,
      dedicatedEmail: parent.dedicatedEmail,

      // Pricing intentionally zeroed — fill in on the new contract's edit page
      totalValue: 0,
      initFee: 0,
      p1: 0,
      p2: 0,
      p3: 0,
      tier2Rate: parent.tier2Rate,

      data: {},
      parentContractId: parent.id,
      versionNote: `Scope Extension ${extNumber} — work beyond the scope of ${parent.contractCode}`,
    },
  })

  return NextResponse.json({
    ok: true,
    parent: parent.contractCode,
    new: created.contractCode,
  })
}
