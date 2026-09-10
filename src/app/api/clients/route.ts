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
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { contracts: true, invoices: true } } },
  })
  return NextResponse.json(
    clients.map((c) => ({
      ...c,
      contracts: c._count.contracts,
      invoices: c._count.invoices,
    })),
  )
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

  /**
   * Find the client before inventing one.
   *
   * A random code can never match an existing row, so the upsert below always CREATED:
   * every pass through the wizard that did not already know the code minted another
   * client. That is how one person ended up as four rows, with a live contract on one
   * and the invoices on another.
   *
   * Email first, since it is the thing that is actually unique to a person; then a
   * case-insensitive name, so "Joey De laat" finds "Joey de Laat" instead of becoming
   * a second Joey.
   */
  const suppliedCode = (body.clientCode as string | undefined)?.trim() || null
  const email = (body.email as string | undefined)?.trim() || ''

  let existing = suppliedCode
    ? await prisma.client.findUnique({ where: { clientCode: suppliedCode } })
    : null

  if (!existing && email) {
    existing = await prisma.client.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    })
  }
  if (!existing) {
    existing = await prisma.client.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    })
  }

  const clientCode =
    existing?.clientCode ||
    suppliedCode ||
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
      // Only when actually supplied. The wizard never sends it, so defaulting here
      // reset every client to "New client" on each save — which is why Joey read as
      // new despite a year of work.
      ...(typeof body.type === 'string' && body.type.trim() ? { type: body.type.trim() } : {}),
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

  // Link any existing orphan contracts/invoices for this client
  await prisma.contract.updateMany({
    where: {
      clientId: null,
      OR: [
        { clientEmail: { equals: client.email, mode: 'insensitive' } },
        { clientName: { equals: client.name, mode: 'insensitive' } },
      ],
    },
    data: { clientId: client.id },
  })
  await prisma.invoice.updateMany({
    where: {
      clientId: null,
      OR: [
        { clientEmail: { equals: client.email, mode: 'insensitive' } },
        { clientName: { equals: client.name, mode: 'insensitive' } },
      ],
    },
    data: { clientId: client.id },
  })

  return NextResponse.json(client)
}
