import { prisma } from '@/lib/prisma'
import PublicNotice from '@/components/PublicNotice'
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
    title: `Contract ${decodeURIComponent(code)}, Engaging UX Design`,
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
  /* Each of these used to be a bare 404. The client is holding a link to their own
     agreement, sent by the person they are about to pay, so "not found" is the one
     answer that helps nobody. */
  if (!contract || !contract.data) {
    return (
      <PublicNotice
        title="This link is not valid"
        message="We could not find a contract at this address. The link may have been copied incompletely, or it may belong to an agreement that no longer exists."
        detail={`Reference: ${decodeURIComponent(code)}`}
      />
    )
  }

  if (contract.status === 'CANCELLED') {
    return (
      <PublicNotice
        title="This contract has been withdrawn"
        message="This agreement was cancelled and is no longer available to view. If you were expecting to review or sign it, reply to the email it came from and a current version will be sent."
        detail={`Reference: ${contract.contractCode}`}
      />
    )
  }

  if (contract.status === 'SUPERSEDED') {
    return (
      <PublicNotice
        title="A newer version of this contract exists"
        message="This version has been replaced. Look for the most recent email from Engaging UX Design, which carries the version now in force, or reply to ask for it again."
        detail={`Reference: ${contract.contractCode}`}
      />
    )
  }

  const language: 'en' | 'nl' = contract.language === 'nl' ? 'nl' : 'en'

  return (
    <PublicContractView
      data={contract.data as unknown as PreviewData}
      contractCode={contract.contractCode}
      language={language}
    />
  )
}
