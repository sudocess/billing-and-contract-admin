'use client'

import { useEffect, useMemo, useState } from 'react'
import { generateContractHtml, type PreviewData } from '@/lib/contractHtml'

/**
 * Show the actual contract, not a second drawing of it.
 *
 * The wizard used to render its own hand-written preview alongside the real template.
 * Two renderers of one document drift, and this one had: the preview printed a phase
 * payment split on a care plan that bills monthly, and once described a support
 * add-on as cancellable at any time while the contract said one calendar month.
 *
 * Rendering the real output in an iframe removes the possibility rather than the
 * symptom. What is on screen is the file that gets sent, byte for byte.
 */
export default function ContractDocPreview({ data }: { data: PreviewData }) {
  const [height, setHeight] = useState(1200)
  const html = useMemo(() => generateContractHtml(data, {}), [data])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (typeof e.data === 'object' && e.data?.iframeHeight) {
        const next = Math.ceil(e.data.iframeHeight) + 24
        // Ignore a height we are effectively already at. Growing the frame makes the
        // document report a new height, which would grow the frame again.
        setHeight(h => (Math.abs(h - next) > 2 ? next : h))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <div className="rounded-xl overflow-hidden border border-brown-light bg-white">
      <iframe
        srcDoc={html}
        title="Contract preview"
        className="w-full border-0 block"
        style={{ height }}
        scrolling="no"
      />
    </div>
  )
}
