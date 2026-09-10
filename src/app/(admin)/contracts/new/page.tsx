import Link from 'next/link'
import TypeCardLink from '@/components/TypeCardLink'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New contract, Engaging UX Design' }

/**
 * What kind of contract is this?
 *
 * A pre-step, not step 1, so it deliberately carries none of the wizard's chrome.
 * Every existing "New contract" link already points here, so introducing the choice
 * costs no changes anywhere else; the project wizard simply moved down a level.
 */
const KINDS = [
  {
    href: '/contracts/new/project',
    title: 'New contract',
    lead: 'The main agreement for a piece of work.',
    desc:
      'Use this when a project is agreed before it starts. It sets the scope, the phases, '
      + 'the total price and how it is paid, and everything else a client signs hangs off it.',
    meta: 'Starts with the client',
  },
  {
    href: '/contracts/new/care',
    title: 'Care plan',
    lead: 'Monthly support after a project is delivered.',
    desc:
      'Use this once the work is live and the client wants it kept running. Hours and rate are '
      + 'set per client, it runs month to month with no minimum term, and it sits alongside the '
      + 'main agreement without changing it.',
    meta: 'Starts with the client',
  },
  {
    href: '/contracts/new/extension',
    title: 'Scope extension',
    lead: 'Work beyond what an agreement already covers.',
    desc:
      'Use this when a client asks for something outside the original scope, like a new section '
      + 'or a feature nobody planned for. It is priced and signed on its own, and the agreement '
      + 'it extends carries on unchanged.',
    meta: 'Starts with a signed contract',
  },
] as const

export default function ChooseContractKindPage() {
  return (
    <>
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <h1 className="font-heading text-lg font-extrabold text-brown-dark">New contract</h1>
        <Link href="/contracts" className="btn btn-ghost btn-sm">Cancel</Link>
      </div>

      <div className="p-4 sm:p-7 flex-1">
        <div className="max-w-4xl">
          <p className="text-sm text-brown-subtle mb-5 max-w-2xl">
            Three kinds of agreement, each with its own contract number and its own signature.
            A <strong className="text-brown-dark">revision</strong> is not one of them: you create
            a revision from an existing contract when its terms need to change, and it takes the
            next version number of that same contract.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {KINDS.map(k => (
              <TypeCardLink key={k.href} {...k} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
