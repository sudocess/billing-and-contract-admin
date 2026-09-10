import Link from 'next/link'

export const dynamic = 'force-dynamic'

/**
 * What kind of contract is this?
 *
 * A pre-step, not step 1 — so it deliberately carries none of the wizard's chrome.
 * Every existing "New contract" link already points here, so introducing the choice
 * costs no changes anywhere else; the project wizard simply moved down a level.
 */
const KINDS = [
  {
    href: '/contracts/new/project',
    title: 'New contract',
    desc: 'A project agreed before the work starts. Scope, phases and a payment schedule.',
    meta: '6 steps',
  },
  {
    href: '/contracts/new/care',
    title: 'Care plan',
    desc: 'Recurring monthly support for a client you already work with. Hours and rate are set per client.',
    meta: 'Pick a client',
  },
  {
    href: '/contracts/new/extension',
    title: 'Scope extension',
    desc: 'Work beyond what an existing agreement covers, priced separately. The original stays in force.',
    meta: 'Pick a contract',
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
            Three kinds of agreement. A <strong className="text-brown-dark">revision</strong> is
            something else again — you create one from an existing contract when its terms need to
            change, and it takes the next version number.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {KINDS.map(k => (
              <Link key={k.href} href={k.href} className="type-card text-left flex flex-col gap-2 no-underline">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-heading text-base font-bold text-brown-dark">{k.title}</span>
                </div>
                <span className="text-[13px] text-brown-subtle leading-relaxed flex-1">{k.desc}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle/80">
                  {k.meta}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
