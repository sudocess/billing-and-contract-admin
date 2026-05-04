import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ clientCode: string }> },
) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientCode } = await params
  try {
    await prisma.client.delete({ where: { clientCode } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
}
