/**
 * Shown while the route resolves. The header and the step rail are real, because
 * nothing about them is unknown yet; only the part that is actually being fetched
 * is drawn as a skeleton.
 */
export default function Loading() {
  return (
    <>
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-brown-subtle">New agreement</div>
          <h1 className="font-heading text-lg font-extrabold text-brown-dark">Scope extension</h1>
        </div>
      </div>

      <div className="p-4 sm:p-7 flex-1">
        <p className="sr-only" role="status">Loading signed agreements.</p>

        <div className="wizard-wrap">
          <aside className="wizard-steps" aria-hidden="true">
            {['Agreement', 'Feature', 'Payment', 'Generate'].map((label, i) => (
              <div key={label}>
                <div className={`wstep ${i === 0 ? 'wstep-active' : 'wstep-default'}`}>
                  <div className="wstep-circle">{i + 1}</div>
                  <div className="wstep-text">
                    <div className="wstep-label">{label}</div>
                  </div>
                </div>
                {i < 3 && <div className="wstep-divider" />}
              </div>
            ))}
          </aside>

          <div className="wizard-form" aria-hidden="true">
            <h2 className="wstep-heading">Which agreement does this extend?</h2>
            <p className="wstep-tagline">Only signed agreements are listed.</p>
            <div className="flex flex-col gap-5">
              {Array.from({ length: 2 }).map((_, g) => (
                <div key={g}>
                  <div className="skeleton h-4 w-32 rounded mb-2" />
                  <div className="rounded-xl border border-brown-light bg-white px-4 py-4">
                    <div className="skeleton h-4 w-52 rounded mb-2" />
                    <div className="skeleton h-3 w-64 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
