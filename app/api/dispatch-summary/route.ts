export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { initDB, getDispatchSummaryByCode } from '../../../lib/db'

export async function GET() {
  try {
    await initDB()
    const summary = await getDispatchSummaryByCode()
    return NextResponse.json(summary)
  } catch (e) {
    console.error(e)
    return NextResponse.json({})
  }
}
