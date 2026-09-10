export default function Loading() {
  return (
    <>
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <h1 className="font-heading text-lg font-extrabold text-brown-dark">New scope extension</h1>
      </div>

      <div className="p-4 sm:p-7 flex-1">
        <div className="max-w-3xl">
          <p className="sr-only" role="status">Loading contracts.</p>
          <p className="text-sm text-brown-subtle mb-4">
            Which agreement does this extend? The original stays in force, the extension is
            priced and signed separately.
          </p>
          <div className="skeleton h-[42px] w-full rounded-lg mb-4" aria-hidden="true" />
          <div className="flex flex-col gap-5" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, g) => (
              <div key={g}>
                <div className="skeleton h-4 w-32 rounded mb-2" />
                <div className="flex flex-col gap-1.5">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-brown-light bg-white px-4 py-3">
                      <div className="skeleton h-4 w-48 rounded mb-2" />
                      <div className="skeleton h-3 w-56 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
