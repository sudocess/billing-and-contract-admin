import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface SaveContractBody {
  contractCode: string
  contractType: string
  plan?: string | null
  phase: string
  phaseLabel: string
  language?: string
  projectName?: string
  deliverables?: string
  phaseStart?: string
  phaseEnd?: string
  client: {
    name: string
    company?: string
    email?: string
    phone?: string
    kvk?: string
    vat?: string
    address?: string
    postalCode?: string
    city?: string
    country?: string
    dedicatedEmail?: string
  }
  pricing: {
    total: number
    initFee: number
    p1: number
    p2: number
    p3: number
    tier2Rate: number
  }
  // Full preview snapshot (hosting, addons, etc.)
  data: unknown
}

export async function POST(req: Request) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: SaveContractBody
  try {
    body = (await req.json()) as SaveContractBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.contractCode || !body.client?.name) {
    return NextResponse.json({ error: 'contractCode and client.name are required' }, { status: 400 })
  }

  try {
    const saved = await prisma.contract.upsert({
      where: { contractCode: body.contractCode },
      create: {
        contractCode: body.contractCode,
        contractType: body.contractType,
        plan: body.plan || null,
        phase: body.phase,
        phaseLabel: body.phaseLabel,
        language: body.language || 'en',
        projectName: body.projectName || null,
        deliverables: body.deliverables || null,
        phaseStart: body.phaseStart || null,
        phaseEnd: body.phaseEnd || null,
        clientName: body.client.name,
        clientCompany: body.client.company || null,
        clientEmail: body.client.email || null,
        clientPhone: body.client.phone || null,
        clientKvk: body.client.kvk || null,
        clientVat: body.client.vat || null,
        clientAddress: body.client.address || null,
        clientPostalCode: body.client.postalCode || null,
        clientCity: body.client.city || null,
        clientCountry: body.client.country || null,
        dedicatedEmail: body.client.dedicatedEmail || null,
        totalValue: body.pricing.total || 0,
        initFee: body.pricing.initFee || 0,
        p1: body.pricing.p1 || 0,
        p2: body.pricing.p2 || 0,
        p3: body.pricing.p3 || 0,
        tier2Rate: body.pricing.tier2Rate || 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: body.data as any,
      },
      update: {
        contractType: body.contractType,
        plan: body.plan || null,
        phase: body.phase,
        phaseLabel: body.phaseLabel,
        language: body.language || 'en',
        projectName: body.projectName || null,
        deliverables: body.deliverables || null,
        phaseStart: body.phaseStart || null,
        phaseEnd: body.phaseEnd || null,
        clientName: body.client.name,
        clientCompany: body.client.company || null,
        clientEmail: body.client.email || null,
        clientPhone: body.client.phone || null,
        clientKvk: body.client.kvk || null,
        clientVat: body.client.vat || null,
        clientAddress: body.client.address || null,
        clientPostalCode: body.client.postalCode || null,
        clientCity: body.client.city || null,
        clientCountry: body.client.country || null,
        dedicatedEmail: body.client.dedicatedEmail || null,
        totalValue: body.pricing.total || 0,
        initFee: body.pricing.initFee || 0,
        p1: body.pricing.p1 || 0,
        p2: body.pricing.p2 || 0,
        p3: body.pricing.p3 || 0,
        tier2Rate: body.pricing.tier2Rate || 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: body.data as any,
      },
    })
    return NextResponse.json({ ok: true, id: saved.id, contractCode: saved.contractCode })
  } catch (err) {
    console.error('[contracts] save failed', err)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
}

export async function GET() {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contracts = await prisma.contract.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ contracts })
}
