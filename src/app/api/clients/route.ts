import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { KNOWN_CLIENTS } from '@/lib/contracts'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// One-time seed: if the clients table is empty, insert the hardcoded starter clients.
async function seedIfEmpty() {
  const count = await prisma.client.count()
  if (count > 0) return
  for (const c of KNOWN_CLIENTS) {
    await prisma.client.create({
      data: {
        name: c.name,
        initials: c.initials,
        email: c.email,
        type: c.type,
        currentPhase: c.currentPhase,
        contracts: c.contracts,
        invoices: c.invoices,
        clientCode: c.clientCode,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phases: c.phases as any,
        company: c.company ?? null,
        phone: c.phone ?? null,
        kvk: c.kvk ?? null,
        vat: c.vat ?? null,
        address: c.address ?? null,
        city: c.city ?? null,
        postalCode: c.postalCode ?? null,
        country: c.country ?? null,
        dedicatedEmail: c.dedicatedEmail ?? null,
        password: c.password ?? null,
      },
    })
  }
}

export async function GET() {
  await seedIfEmpty()
  const clients = await prisma.client.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(clients)
}

export async function POST(req: Request) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const name = (body.name as string | undefined)?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const initials =
    (body.initials as string | undefined) ||
    name.split(/\s+/).map((s: string) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() ||
    '?'

  const clientCode =
    (body.clientCode as string | undefined) ||
    String(Math.floor(1000000 + Math.random() * 9000000))

  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  const client = await prisma.client.upsert({
    where: { clientCode },
    create: {
      name,
      initials,
      email: (body.email as string) || '',
      type: (body.type as string) || 'New client',
      currentPhase: Number(body.currentPhase) || 0,
      contracts: Number(body.contracts) || 0,
      invoices: Number(body.invoices) || 0,
      clientCode,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      phases: (body.phases as any) ?? [],
      company: str(body.company),
      phone: str(body.phone),
      kvk: str(body.kvk),
      vat: str(body.vat),
      address: str(body.address),
      city: str(body.city),
      postalCode: str(body.postalCode),
      country: str(body.country),
      dedicatedEmail: str(body.dedicatedEmail),
      password: str(body.password),
    },
    update: {
      name,
      initials,
      email: (body.email as string) || '',
      type: (body.type as string) || 'New client',
      company: str(body.company),
      phone: str(body.phone),
      kvk: str(body.kvk),
      vat: str(body.vat),
      address: str(body.address),
      city: str(body.city),
      postalCode: str(body.postalCode),
      country: str(body.country),
      dedicatedEmail: str(body.dedicatedEmail),
      password: str(body.password),
    },
  })

  return NextResponse.json(client)
}
