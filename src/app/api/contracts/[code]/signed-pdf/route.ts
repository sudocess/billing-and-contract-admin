import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Download the PDF the client actually signed.
 *
 * The stored bytes are verified against the SHA-256 recorded at signing time before
 * being served. A mismatch would mean the row was altered outside the signing flow,
 * which is exactly the failure this column exists to make visible — so it is reported
 * rather than quietly serving a file that may no longer be the signed document.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  const contract = await prisma.contract.findUnique({
    where: { contractCode: code },
    select: {
      contractCode: true,
      signedAt: true,
      signedPdf: true,
      signedPdfSha256: true,
    },
  })

  if (!contract) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!contract.signedPdf) {
    return NextResponse.json(
      {
        error: contract.signedAt
          ? 'This contract was signed before signed PDFs were stored, so no copy exists here. Check the confirmation email sent at signing.'
          : 'This contract has not been signed yet.',
      },
      { status: 404 },
    )
  }

  const bytes = Buffer.from(contract.signedPdf)

  if (contract.signedPdfSha256) {
    const actual = createHash('sha256').update(bytes).digest('hex')
    if (actual !== contract.signedPdfSha256) {
      console.error(
        `[contracts] signed PDF checksum mismatch for ${code}: stored ${contract.signedPdfSha256}, computed ${actual}`,
      )
      return NextResponse.json(
        { error: 'Stored PDF failed its integrity check and was not served.' },
        { status: 500 },
      )
    }
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(bytes.length),
      'content-disposition': `attachment; filename="Signed-Agreement-${contract.contractCode}.pdf"`,
      // Contains client personal data and a signature — never cache at the edge.
      'cache-control': 'private, no-store',
    },
  })
}
