import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await prisma.ownerSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })
  return NextResponse.json(settings)
}

export async function POST(req: Request) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, string>
  const settings = await prisma.ownerSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      iban: body.iban ?? '',
      bic: body.bic ?? '',
      bankName: body.bankName ?? '',
      accountHolder: body.accountHolder ?? 'Engaging UX Design',
      ownVat: body.ownVat ?? '',
      ownKvk: body.ownKvk ?? '',
    },
    update: {
      iban: body.iban ?? '',
      bic: body.bic ?? '',
      bankName: body.bankName ?? '',
      accountHolder: body.accountHolder ?? 'Engaging UX Design',
      ownVat: body.ownVat ?? '',
      ownKvk: body.ownKvk ?? '',
    },
  })
  return NextResponse.json(settings)
}
