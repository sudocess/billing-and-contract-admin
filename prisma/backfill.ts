import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillContracts() {
  const orphans = await prisma.contract.findMany({ where: { clientId: null } })
  let linked = 0, ambiguous = 0, missing = 0

  for (const c of orphans) {
    const candidates = await prisma.client.findMany({
      where: {
        OR: [
          c.clientEmail ? { email: { equals: c.clientEmail, mode: 'insensitive' } } : undefined,
          { name: { equals: c.clientName, mode: 'insensitive' } },
        ].filter(Boolean) as object[],
      },
    })

    if (candidates.length === 1) {
      await prisma.contract.update({
        where: { id: c.id },
        data: { clientId: candidates[0].id },
      })
      linked++
    } else if (candidates.length > 1) {
      console.warn(
        `AMBIGUOUS: contract ${c.contractCode} (${c.clientName}/${c.clientEmail}) → ${candidates.length} possible clients`,
      )
      ambiguous++
    } else {
      console.warn(
        `ORPHAN: contract ${c.contractCode} (${c.clientName}/${c.clientEmail}) has no matching Client`,
      )
      missing++
    }
  }
  console.log(`Contracts — linked: ${linked}, ambiguous: ${ambiguous}, orphan: ${missing}`)
}

async function backfillInvoices() {
  const orphans = await prisma.invoice.findMany({ where: { clientId: null } })
  let linked = 0, ambiguous = 0, missing = 0

  for (const inv of orphans) {
    const candidates = await prisma.client.findMany({
      where: {
        OR: [
          inv.clientEmail ? { email: { equals: inv.clientEmail, mode: 'insensitive' } } : undefined,
          { name: { equals: inv.clientName, mode: 'insensitive' } },
        ].filter(Boolean) as object[],
      },
    })
    if (candidates.length === 1) {
      await prisma.invoice.update({ where: { id: inv.id }, data: { clientId: candidates[0].id } })
      linked++
    } else if (candidates.length > 1) {
      console.warn(`AMBIGUOUS: invoice ${inv.invoiceNumber} → ${candidates.length} candidates`)
      ambiguous++
    } else {
      console.warn(`ORPHAN: invoice ${inv.invoiceNumber}`)
      missing++
    }
  }
  console.log(`Invoices — linked: ${linked}, ambiguous: ${ambiguous}, orphan: ${missing}`)
}

async function leemarOption2() {
  const c = await prisma.contract.findFirst({
    where: { clientName: { contains: 'Leemar', mode: 'insensitive' } },
  })
  if (!c) {
    console.log('Leemar contract not found, skipping.')
    return
  }
  await prisma.contract.update({
    where: { id: c.id },
    data: {
      signedAt: null,
      status: 'PENDING',
      versionNote:
        'Originally signed as Custom contract on 29 Apr 2026. Content was modified to Standard agreement on 4 May 2026 via in-place edit (legacy data — pre-supersede flow). Awaiting client re-confirmation of the standard version.',
    },
  })
  console.log(
    `Leemar contract ${c.contractCode}: signedAt cleared, status reset to PENDING, versionNote added.`,
  )
}

async function main() {
  await backfillContracts()
  await backfillInvoices()
  await leemarOption2()
}

main().finally(() => prisma.$disconnect())
