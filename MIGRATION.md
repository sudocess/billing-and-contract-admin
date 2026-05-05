# Contract Architecture Migration

This is the implementation spec for fixing the broken Client ↔ Contract relationship,
adding the supersede + change-order patterns, and cleaning up Leemar's contract.

Run the steps in order. Stop and verify after each step before moving on.

---

## What this migration does

1. Adds a real foreign key from `Contract` and `Invoice` to `Client`.
2. Drops the stale `Client.contracts` and `Client.invoices` integer counters.
3. Adds `Contract.supersedesId` for the **plan-tier-change** pattern (new contract replaces old).
4. Adds `Contract.parentContractId` for the **change-order** pattern (new contract adds scope to a parent).
5. Adds `Contract.archivedAt` and `Contract.versionNote` for archive + audit-trail notes.
6. Backfills existing rows by matching on email/name.
7. Resets Leemar's contract status (Option 2 cleanup).

---

## Step 1 — Update `prisma/schema.prisma`

### 1.1 — Add `SUPERSEDED` to the `ContractStatus` enum

```prisma
enum ContractStatus {
  DRAFT
  PENDING
  SIGNED
  SUPERSEDED
  CANCELLED
}
```

### 1.2 — Replace the `Contract` model

```prisma
model Contract {
  id               String         @id @default(uuid())
  contractCode     String         @unique
  status           ContractStatus @default(DRAFT)

  contractType     String
  plan             String?
  phase            String
  phaseLabel       String
  language         String         @default("en")

  projectName      String?
  deliverables     String?
  phaseStart       String?
  phaseEnd         String?

  // Client relation (NEW) — nullable so legacy rows don't fail the migration
  clientId         String?
  client           Client?        @relation(fields: [clientId], references: [id], onDelete: SetNull)

  // Client snapshot (kept for audit even after the relation exists)
  clientName       String
  clientCompany    String?
  clientEmail      String?
  clientPhone      String?
  clientKvk        String?
  clientVat        String?
  clientAddress    String?
  clientPostalCode String?
  clientCity       String?
  clientCountry    String?
  dedicatedEmail   String?

  // Pricing
  totalValue       Float          @default(0)
  initFee          Float          @default(0)
  p1               Float          @default(0)
  p2               Float          @default(0)
  p3               Float          @default(0)
  tier2Rate        Float          @default(0)

  data             Json

  signingToken          String?   @unique
  signingTokenExpiresAt DateTime?
  signerName            String?
  signerIp              String?

  // Supersede chain — replaces a previous contract (plan-tier change)
  supersedesId     String?        @unique
  supersedes       Contract?      @relation("Supersession", fields: [supersedesId], references: [id], onDelete: SetNull)
  supersededBy     Contract?      @relation("Supersession")

  // Change-order chain — adds scope to a parent contract (extra app, new module)
  parentContractId String?
  parentContract   Contract?      @relation("ChangeOrder", fields: [parentContractId], references: [id], onDelete: SetNull)
  changeOrders     Contract[]     @relation("ChangeOrder")

  // Archive + audit-trail note
  archivedAt       DateTime?
  versionNote      String?

  signedAt         DateTime?
  sentAt           DateTime?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@map("contracts")
  @@index([clientId])
  @@index([parentContractId])
}
```

### 1.3 — Add `clientId` + relation to `Invoice`

In the `Invoice` model, add this block right above `// Relations`:

```prisma
  // Client relation (NEW)
  clientId       String?
  client         Client?       @relation(fields: [clientId], references: [id], onDelete: SetNull)
```

And add `@@index([clientId])` at the bottom alongside `@@map("invoices")`.

### 1.4 — Replace the `Client` model

```prisma
model Client {
  id             String     @id @default(uuid())
  name           String
  initials       String
  email          String     @default("")
  type           String     @default("New client")
  currentPhase   Int        @default(0)
  clientCode     String     @unique
  phases         Json       @default("[]")
  company        String?
  phone          String?
  kvk            String?
  vat            String?
  address        String?
  city           String?
  postalCode     String?
  country        String?
  dedicatedEmail String?
  password       String?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  // Relations (NEW) — replaces the dropped contracts/invoices Int columns
  contracts      Contract[]
  invoices       Invoice[]

  @@map("clients")
}
```

> **Destructive:** This drops `Client.contracts` and `Client.invoices` integer columns.
> The data they held is recomputed live via `_count`.

---

## Step 2 — Generate the migration

```bash
cd billing-and-contract-admin
npx prisma migrate dev --name add_client_relations_supersede_and_change_orders
```

Read the SQL Prisma prints **before** confirming. Expected operations:

- `ALTER TABLE clients DROP COLUMN contracts`
- `ALTER TABLE clients DROP COLUMN invoices`
- `ALTER TABLE contracts ADD COLUMN client_id`, `supersedes_id`, `parent_contract_id`, `archived_at`, `version_note`
- `ALTER TABLE invoices ADD COLUMN client_id`
- New `ContractStatus` value `SUPERSEDED`
- New foreign-key constraints + indexes

If anything else appears, paste it back to me before running.

---

## Step 3 — Backfill script

Create `prisma/backfill.ts`:

```ts
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
```

Run it once:

```bash
npx tsx prisma/backfill.ts
```

**Paste me the console output** before moving on. The "Cess Test Garcia" contracts will probably show as orphan — that's expected.

---

## Step 4 — Update `src/app/api/contracts/route.ts` (POST)

Right before the `prisma.contract.upsert(...)` call, add a Client lookup:

```ts
// Resolve clientId from email or name
const matchedClient = await prisma.client.findFirst({
  where: {
    OR: [
      body.client.email
        ? { email: { equals: body.client.email, mode: 'insensitive' } }
        : undefined,
      { name: { equals: body.client.name, mode: 'insensitive' } },
    ].filter(Boolean) as object[],
  },
})
const clientId = matchedClient?.id ?? null
```

Then in **both** the `create` and `update` branches of the upsert, add `clientId,` to the data object.

---

## Step 5 — Update `src/app/api/clients/route.ts`

### 5a — `GET` returns live counts

```ts
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
```

### 5b — `POST` retroactively links orphans for the new client

After `const client = await prisma.client.upsert(...)`, add:

```ts
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
```

### 5c — Remove dropped fields from `POST` create block

Delete these two lines from the `create:` object — those columns no longer exist:

```ts
// REMOVE:
contracts: Number(body.contracts) || 0,
invoices: Number(body.invoices) || 0,
```

Also remove them from the `seedIfEmpty()` insert:

```ts
// REMOVE from the seed loop:
contracts: c.contracts,
invoices: c.invoices,
```

---

## Step 6 — New endpoint: supersede

Create `src/app/api/contracts/[code]/supersede/route.ts`:

```ts
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
    const { id, createdAt, updatedAt, contractCode, ...rest } = old

    const created = await tx.contract.create({
      data: {
        ...rest,
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
```

---

## Step 7 — New endpoint: change order

Create `src/app/api/contracts/[code]/change-order/route.ts`:

```ts
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
```

---

## Step 8 — Verify the Clients page rendering

Open `src/app/(admin)/clients/page.tsx`. The page reads `client.contracts` and `client.invoices` —
because Step 5a maps `_count.contracts → contracts` and `_count.invoices → invoices` in the API
response, **no frontend change is needed**.

Sanity-check after deploy: add a contract for an existing client, refresh Clients page,
the count should tick up.

---

## Step 9 — Update `src/lib/contracts.ts` (`KNOWN_CLIENTS`)

The hardcoded seed in `KNOWN_CLIENTS` still references `contracts: number` and `invoices: number`
fields. Since those columns are dropped, also remove them from the seed objects, and remove the
matching lines from the `seedIfEmpty()` loop in `src/app/api/clients/route.ts` (already covered in
Step 5c).

---

## Decision tree — when to use which pattern

When a client wants something different mid-engagement:

- **Plan tier changes** (Basic → Dynamic, or pricing structure changes meaningfully) → **Supersede**.
  Old contract gets `status: SUPERSEDED`, new contract created with `supersedesId` pointing to old.
- **Adding scope to the existing engagement** (extra app, new module, additional pages, all under the
  same plan) → **Change Order**. Parent contract stays active and untouched. New contract created
  with `parentContractId` pointing to parent. Own contractCode `…-CO1`, own signing, own invoice.
- **Brand new project for the same client** (totally separate product) → **Independent contract**.
  No relationship link. Just the same `clientId`.
- **Tiny tweak** (added a Q&A page, changed copy, agreed verbally) → **Edit in place + versionNote**.
  Note becomes audit trail.
- **Client cancels mid-phase with written notice** → **status: CANCELLED**, `archivedAt` set,
  invoice for completed work, deliverables only on full payment.
- **Client goes silent** (>14 days unpaid → suspend; >60 days inactive → archive + forfeit).
  See site service terms section 10.

---

## Verification checklist (run before pushing to prod)

After Steps 1–7 are done locally:

- [ ] `npx prisma migrate dev` ran cleanly. No data loss surprises.
- [ ] `npx tsx prisma/backfill.ts` output reviewed. Any AMBIGUOUS rows resolved manually.
- [ ] Clients page loads without error.
- [ ] Leemar shows "1 contract" (was 0).
- [ ] Leemar's contract page shows status PENDING (not SIGNED) and `versionNote` is in the DB.
- [ ] Joey/Marco counts match what they were before.
- [ ] Add a fresh client whose email matches an existing test contract → contract count updates.
- [ ] Create a new contract for an existing client → count ticks up on Clients page.
- [ ] `POST /api/contracts/{leemarCode}/supersede` → returns new code, old is SUPERSEDED, new is DRAFT.
- [ ] Calling supersede again on the same contract → returns 409 Conflict.
- [ ] `POST /api/contracts/{anyCode}/change-order` → returns `…-CO1`, parent unchanged.
- [ ] Calling change-order again on the same parent → returns `…-CO2`.
- [ ] Cancelled contract — change-order is rejected with 409.
- [ ] Superseded contract — change-order is rejected with 409.

Once all checks pass on local, push to prod with `npx prisma migrate deploy`.

---

## Notes intentionally NOT in scope

- UI buttons for "Supersede" and "Add Change Order" — endpoints exist; UI is a follow-up ticket.
- UI surface for `versionNote` on the contract detail view — DB has it, frontend doesn't show it yet.
- Blocking DELETE on SUPERSEDED contracts — currently delete is allowed; tighten later.
- Invoice ↔ Contract foreign key — invoices link to clients now, but not to specific contracts.
- NL site service-terms update — same edits as EN, queued for after EN is verified live.
