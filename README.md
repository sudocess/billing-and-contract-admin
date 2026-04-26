# Invoice Admin — Engaging UX Design

Internal admin dashboard for creating, managing, and sending invoices. Localhost-only, not intended for public deployment.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Prisma 6** + Supabase PostgreSQL
- **PDFKit** — server-side A4 PDF generation
- **Nodemailer** — SMTP email delivery (Hostinger)
- **Tailwind CSS 4**
- **TypeScript 5**

## Features

- Create, edit, preview, and delete invoices
- Auto-generate branded PDF with line items, VAT breakdown, and bank details
- Send invoice via email with PDF attachment and inline summary
- Track invoice status: Draft → Sent → Paid → Overdue → Cancelled
- Dashboard with monthly totals, outstanding, and paid stats
- EN/NL bilingual invoice generation
- EU VAT compliant (Directive 2006/112/EC, reverse charge, KOR exemption)

## Getting Started

```bash
# Install dependencies
npm install

# Copy env and fill in credentials
cp .env.example .env

# Create database tables (safe — does not drop existing tables)
cat prisma/create-tables.sql | npx prisma db execute --stdin --schema prisma/schema.prisma

# Generate Prisma client
npx prisma generate

# Start dev server (localhost:3004 only)
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on `127.0.0.1:3004` |
| `npm run build` | Production build |
| `npm run start` | Start production server on port 3004 |
| `npm run db:push` | Push schema changes to database |
| `npm run db:studio` | Open Prisma Studio |

## Environment Variables

See [.env.example](.env.example) for required variables:

- `DATABASE_URL` / `DIRECT_URL` — Supabase PostgreSQL connection strings
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — Email credentials
