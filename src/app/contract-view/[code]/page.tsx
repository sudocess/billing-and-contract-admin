import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { PreviewData } from '@/components/ContractWizard'
import PublicContractView from './PublicContractView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  return {
    title: `Contract ${decodeURIComponent(code)} — Engaging UX Design`,
    robots: { index: false, follow: false },
  }
}

export default async function PublicContractPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const contract = await prisma.contract.findUnique({
    where: { contractCode: decodeURIComponent(code) },
  })
  if (!contract || !contract.data) notFound()
  if (contract.status === 'CANCELLED') notFound()

  const language: 'en' | 'nl' = contract.language === 'nl' ? 'nl' : 'en'

  return (
    <PublicContractView
      data={contract.data as unknown as PreviewData}
      contractCode={contract.contractCode}
      language={language}
    />
  )
}
