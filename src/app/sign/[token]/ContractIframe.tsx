'use client'

import { useEffect, useState } from 'react'

export default function ContractIframe({ html }: { html: string }) {
  const [height, setHeight] = useState(3800)

  useEffect(() => {
    function handler(e: MessageEvent) {
      if (typeof e.data === 'object' && e.data?.iframeHeight) {
        setHeight(Math.ceil(e.data.iframeHeight) + 24)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div className="rounded-xl overflow-hidden shadow-lg border border-[#d4bfb0]">
      <iframe
        srcDoc={html}
        title="Service Agreement"
        className="w-full border-0"
        style={{ height }}
        scrolling="no"
      />
    </div>
  )
}
