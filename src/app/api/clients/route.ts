import { NextResponse } from 'next/server'
import { KNOWN_CLIENTS } from '@/lib/contracts'

export async function GET() {
  return NextResponse.json(KNOWN_CLIENTS)
}
