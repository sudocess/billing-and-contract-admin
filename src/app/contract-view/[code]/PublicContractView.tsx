'use client'

import { useState } from 'react'
import { ContractPreview, openContractPrintWindow, type PreviewData } from '@/components/ContractWizard'

export default function PublicContractView({
  data,
  contractCode,
  language,
}: {
  data: PreviewData
  contractCode: string
  language: 'en' | 'nl'
}) {
  const [lang, setLang] = useState<'en' | 'nl'>(language)

  return (
    <div className="min-h-screen bg-brown-pale py-8">
      {/* Action bar */}
      <div className="max-w-[820px] mx-auto px-4 mb-6">
        <div className="bg-white rounded-xl border border-brown-dark/10 p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle">Service Agreement</div>
            <div className="font-heading text-base font-extrabold text-brown-dark truncate">
              {data.projectName || 'Engaging UX Design'}
            </div>
            <div className="text-xs text-brown-subtle font-mono mt-0.5">{contractCode}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-brown-pale rounded-md p-1">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-3 py-1 text-xs font-semibold rounded ${lang === 'en' ? 'bg-white text-brown-dark shadow-sm' : 'text-brown-subtle'}`}
              >English</button>
              <button
                type="button"
                onClick={() => setLang('nl')}
                className={`px-3 py-1 text-xs font-semibold rounded ${lang === 'nl' ? 'bg-white text-brown-dark shadow-sm' : 'text-brown-subtle'}`}
              >Nederlands</button>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => openContractPrintWindow(lang, data)}
              title="Open a printable version you can save as PDF"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contract */}
      <div className="max-w-[820px] mx-auto px-4">
        <div className="contract-preview bg-white rounded-xl border border-brown-dark/10 overflow-hidden shadow-sm">
          <ContractPreview lang={lang} data={data} />
        </div>
      </div>

      <div className="max-w-[820px] mx-auto px-4 mt-6 text-center text-xs text-brown-subtle">
        This contract was prepared by Engaging UX Design. Reply to the email you received to accept,
        request changes, or proceed to electronic signature.
      </div>
    </div>
  )
}
