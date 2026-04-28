import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// DocuSign sends XML or JSON Connect events. We parse the JSON form.
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const envelopeId: string | undefined = body?.envelopeId || body?.data?.envelopeId
    const status: string | undefined =
      body?.status || body?.data?.envelopeSummary?.status

    if (!envelopeId || !status) {
      return NextResponse.json({ ok: true }) // unknown shape, ignore silently
    }

    if (status.toLowerCase() === 'completed') {
      await prisma.contract.updateMany({
        where: { docusignEnvelopeId: envelopeId },
        data: {
          status: 'SIGNED',
          signedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook/docusign]', err)
    // Always return 200 so DocuSign doesn't retry indefinitely
    return NextResponse.json({ ok: true })
  }
}
