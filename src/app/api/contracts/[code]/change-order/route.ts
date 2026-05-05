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
      { error: 'Cannot add change order to a superseded or cancelled contract' },
      { status: 409 },
    )
  }

  const coNumber = (parent.changeOrders.length ?? 0) + 1
  const newCode = `${parent.contractCode}-CO${coNumber}`

  const created = await prisma.contract.create({
    data: {
      contractCode: newCode,
      status: 'DRAFT',
      contractType: parent.contractType,
      plan: parent.plan,
      phase: parent.phase,
      phaseLabel: parent.phaseLabel,
      language: parent.language,
      projectName: parent.projectName ? `${parent.projectName} — Change Order ${coNumber}` : null,
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
      versionNote: `Change Order ${coNumber} — adds scope to ${parent.contractCode}`,
    },
  })

  return NextResponse.json({
    ok: true,
    parent: parent.contractCode,
    new: created.contractCode,
  })
}
