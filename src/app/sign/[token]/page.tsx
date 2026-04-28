import { notFound } from 'next/navigation'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { generateContractHtml, type PreviewData } from '@/lib/contractHtml'
import SigningForm from './SigningForm'

export const dynamic = 'force-dynamic'

function getSignatureBase64(): string {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'cess-signature.png'))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return ''
  }
}

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const contract = await prisma.contract.findUnique({
    where: { signingToken: token },
  })

  // Token doesn't exist
  if (!contract) return notFound()

  // Already signed
  if (contract.status === 'SIGNED') {
    return (
      <StatusPage
        title="Already signed"
        message="This contract has already been signed. Check your email for your signed copy."
      />
    )
  }

  // Cancelled
  if (contract.status === 'CANCELLED') {
    return (
      <StatusPage
        title="Contract cancelled"
        message="This contract has been cancelled. Please contact Engaging UX Design if you have questions."
      />
    )
  }

  // Expired
  if (contract.signingTokenExpiresAt && contract.signingTokenExpiresAt < new Date()) {
    return (
      <StatusPage
        title="Link expired"
        message="This signing link has expired. Please contact Engaging UX Design to receive a new one."
      />
    )
  }

  const html = generateContractHtml(contract.data as PreviewData, {
    sigBase64: getSignatureBase64(),
  })

  const expiresFormatted = contract.signingTokenExpiresAt
    ? contract.signingTokenExpiresAt.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-[#f0e4d8]">
      {/* Top bar */}
      <div className="bg-[#1c1008] text-[#f7ede2] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="font-bold text-base leading-tight">Engaging UX Design</div>
            <div className="text-[10px] uppercase tracking-widest text-[#c4a898] mt-0.5">
              Service Agreement · {contract.contractCode}
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs text-[#c4a898]">For: {contract.clientName}</div>
            {contract.projectName && (
              <div className="text-xs text-[#7a5a48] mt-0.5">{contract.projectName}</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Instructions banner */}
        <div className="bg-white rounded-xl border border-[#d4bfb0] px-5 py-4 mb-6 flex items-start gap-3 shadow-sm">
          <div className="text-[#8b3a1e] mt-0.5 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <p className="text-sm text-[#3b2110] font-medium">Please read the full agreement before signing.</p>
            <p className="text-xs text-[#8a6a55] mt-0.5">
              Scroll through all 3 pages below, then fill in your name and sign at the bottom.
              {expiresFormatted && ` This link is valid until ${expiresFormatted}.`}
            </p>
          </div>
        </div>

        {/* Contract preview in iframe */}
        <div className="rounded-xl overflow-hidden shadow-lg border border-[#d4bfb0]">
          <iframe
            srcDoc={html}
            title="Service Agreement"
            className="w-full border-0"
            style={{ height: '3800px' }}
            scrolling="no"
          />
        </div>

        {/* Signing form */}
        <SigningForm token={token} clientName={contract.clientName} />

        <p className="text-center text-xs text-[#b8a090] mt-8 pb-8">
          Engaging UX Design · engaginguxdesign.com · info@engaginguxdesign.com
        </p>
      </div>
    </div>
  )
}

function StatusPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-[#f0e4d8] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-[#d4bfb0] p-10 max-w-md w-full text-center shadow-sm">
        <div className="font-bold text-xl text-[#1c1008] mb-3">{title}</div>
        <p className="text-sm text-[#8a6a55] leading-relaxed">{message}</p>
        <p className="text-xs text-[#b8a090] mt-6">
          Engaging UX Design · info@engaginguxdesign.com
        </p>
      </div>
    </div>
  )
}
