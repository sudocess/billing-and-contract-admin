-- Create InvoiceStatus enum
DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create invoices table
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "invoiceNumber" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "clientName" TEXT NOT NULL,
  "clientEmail" TEXT NOT NULL,
  "clientContact" TEXT,
  "clientPhone" TEXT,
  "clientAddress" TEXT,
  "clientCity" TEXT,
  "clientCountry" TEXT NOT NULL DEFAULT 'Netherlands',
  "clientVat" TEXT,
  "clientKvk" TEXT,
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "reference" TEXT,
  "paymentTerms" TEXT NOT NULL DEFAULT '30 days',
  "currency" TEXT NOT NULL DEFAULT '€',
  "language" TEXT NOT NULL DEFAULT 'en',
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "vatTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "iban" TEXT,
  "bic" TEXT,
  "bankName" TEXT,
  "accountHolder" TEXT DEFAULT 'Engaging UX Design',
  "paymentRef" TEXT,
  "ownVat" TEXT,
  "ownKvk" TEXT,
  "lateFee" TEXT DEFAULT '1% per month',
  "vatTreatment" TEXT NOT NULL DEFAULT 'standard',
  "notes" TEXT,
  "internalNotes" TEXT,
  "sentAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS "invoice_items" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- Create unique index on invoiceNumber
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- Add foreign key
ALTER TABLE "invoice_items"
  DROP CONSTRAINT IF EXISTS "invoice_items_invoiceId_fkey";
ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
