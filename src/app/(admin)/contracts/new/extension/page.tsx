import Link from 'next/link'
import ExtensionWizard from '@/components/ExtensionWizard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New scope extension, Engaging UX Design' }

export default function NewScopeExtensionPage() {
  return (
    <>
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/contracts/new" className="btn btn-ghost btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span>Back</span>
          </Link>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle">New agreement</div>
            <h1 className="font-heading text-lg font-extrabold text-brown-dark truncate">Scope extension</h1>
          </div>
        </div>
        <div id="wizard-header-actions" className="flex items-center gap-2" />
      </div>
      <div className="p-4 sm:p-7 flex-1">
        <ExtensionWizard />
      </div>
    </>
  )
}
