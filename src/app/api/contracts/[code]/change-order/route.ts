import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { newChildContractCode } from '@/lib/contracts'

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

  // A scope extension is its own agreement with its own identity and its own version
  // history, connected to the client rather than nested inside the parent's code.
  // Nesting it (…-0001-EXT1) meant a revision of an extension had nowhere to go.
  const client = parent.clientId
    ? await prisma.client.findUnique({ where: { id: parent.clientId }, select: { clientCode: true } })
    : null
  const clientCode = client?.clientCode
    ?? /^\d{4}-([A-Za-z0-9]+)-/.exec(parent.contractCode)?.[1]
    ?? '0000000'
  const existing = await prisma.contract.findMany({ select: { contractCode: true } })
  const newCode = newChildContractCode(clientCode, 'extension', existing.map(c => c.contractCode))
  const extNumber = /-E(\d+)-/.exec(newCode)?.[1] ?? '1'

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

      // Named here so the document can say what it extends. The code no longer
      // carries the parent, and the relation is not visible to the renderer.
      data: { extendsCode: parent.contractCode },
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
