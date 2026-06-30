export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { initDB, getDispatchHistory } from '../../../lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined
    await initDB()
    const history = await getDispatchHistory(from, to)
    return NextResponse.json(history, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json([], { status: 500 })
  }
}
