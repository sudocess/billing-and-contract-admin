import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ContractWizard, { type WizardPrefill, type PreviewData } from '@/components/ContractWizard'
import type { ContractType, PhaseKey, PlanKey } from '@/lib/contracts'

export const dynamic = 'force-dynamic'

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const session = await readSession()
  if (!session) redirect('/login')

  const { code } = await params
  const contract = await prisma.contract.findUnique({
    where: { contractCode: decodeURIComponent(code) },
  })
  if (!contract) notFound()

  const prefill: WizardPrefill = {
    contractCode: contract.contractCode,
    contractType: contract.contractType as ContractType,
    plan: (contract.plan as PlanKey | null) ?? null,
    phase: contract.phase as PhaseKey,
    language: contract.language,
    projectName: contract.projectName,
    deliverables: contract.deliverables,
    phaseStart: contract.phaseStart,
    phaseEnd: contract.phaseEnd,
    client: {
      name: contract.clientName,
      company: contract.clientCompany,
      email: contract.clientEmail,
      phone: contract.clientPhone,
      kvk: contract.clientKvk,
      vat: contract.clientVat,
      address: contract.clientAddress,
      postalCode: contract.clientPostalCode,
      city: contract.clientCity,
      country: contract.clientCountry,
      dedicatedEmail: contract.dedicatedEmail,
    },
    pricing: {
      total: contract.totalValue,
      initFee: contract.initFee,
      tier2Rate: contract.tier2Rate,
    },
    data: (contract.data as PreviewData | null) ?? null,
  }

  return (
    <>
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/contracts/${encodeURIComponent(contract.contractCode)}`} className="btn btn-ghost btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span>Back</span>
          </Link>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle">Editing</div>
            <h1 className="font-heading text-lg font-extrabold text-brown-dark truncate">
              {contract.contractCode}
            </h1>
          </div>
        </div>
        <span className="badge badge-warning">Edit & republish</span>
      </div>
      <div className="p-4 sm:p-7 flex-1">
        <ContractWizard prefill={prefill} mode="edit" />
      </div>
    </>
  )
}
