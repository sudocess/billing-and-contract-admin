'use client'

import { useEffect, useState } from 'react'
import Link, { useLinkStatus } from 'next/link'

/**
 * A chooser card that says it heard you.
 *
 * The gap between clicking and the next screen appearing is filled by a route change
 * and a fetch, and nothing used to acknowledge the click in between. The card itself
 * is the right place to answer that, rather than a bar somewhere else on the page:
 * the question is not whether something is loading, it is whether this card was the
 * one that was pressed.
 */
function useDelayed(flag: boolean, ms: number) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!flag) {
      setShown(false)
      return
    }
    const t = setTimeout(() => setShown(true), ms)
    return () => clearTimeout(t)
  }, [flag, ms])
  return shown
}

function CardBody({ title, lead, desc, meta }: Kind) {
  const { pending } = useLinkStatus()
  // A navigation that resolves in 60ms should not flash a badge on and off.
  const showBadge = useDelayed(pending, 150)

  return (
    <div
      aria-busy={pending || undefined}
      className={`type-card flex flex-col gap-2 text-left h-full ${
        pending ? 'type-card-active cursor-wait' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-heading text-base font-bold text-brown-dark">{title}</span>
        {showBadge && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brown-rust shrink-0">
            <span
              className="w-1.5 h-1.5 rounded-full bg-brown-rust motion-safe:animate-pulse"
              aria-hidden="true"
            />
            Opening
          </span>
        )}
      </div>
      <span className="text-[13px] font-semibold text-brown-dark/80 leading-snug">{lead}</span>
      <span className="text-[13px] text-brown-subtle leading-relaxed flex-1">{desc}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle/80 pt-1 border-t border-brown-dark/10">
        {meta}
      </span>
    </div>
  )
}

export type Kind = { title: string; lead: string; desc: string; meta: string }

export default function TypeCardLink({ href, ...kind }: Kind & { href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-[10px] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brown-rust"
    >
      <CardBody {...kind} />
    </Link>
  )
}
