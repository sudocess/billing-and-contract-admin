/**
 * What a client sees when a contract link does not lead anywhere.
 *
 * These pages used to call notFound(), which renders the framework's bare 404. From
 * the client's side that is indistinguishable from a broken business: they were sent
 * a link to a legal agreement by someone they are about to pay, and the page says
 * nothing at all. Every one of these cases has a real reason, and the reason is more
 * reassuring than the silence, so it is stated along with what to do next.
 *
 * No navigation and no links back into the app: the reader is not a user of it.
 */
export default function PublicNotice({
  title,
  message,
  detail,
}: {
  title: string
  message: string
  detail?: string
}) {
  return (
    <div className="min-h-screen bg-[#f0e4d8] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-[#d4bfb0] p-10 max-w-md w-full text-center shadow-sm">
        <div className="font-bold text-xl text-[#1c1008] mb-3">{title}</div>
        <p className="text-sm text-[#8a6a55] leading-relaxed m-0">{message}</p>
        {detail && (
          <p className="text-xs text-[#b8a090] leading-relaxed mt-4 m-0">{detail}</p>
        )}
        <p className="text-xs text-[#b8a090] mt-8 m-0">
          Engaging UX Design
          <br />
          <a href="mailto:info@engaginguxdesign.com" className="text-[#8b3a1e] underline">
            info@engaginguxdesign.com
          </a>
        </p>
      </div>
    </div>
  )
}
