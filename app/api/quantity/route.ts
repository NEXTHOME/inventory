import { NextRequest, NextResponse } from 'next/server'
import { initDB, getOverrides, setOverride } from '../../../lib/db'

export async function GET() {
  try {
    await initDB()
    const overrides = await getOverrides()
    return NextResponse.json(overrides)
  } catch (e) {
    console.error(e)
    return NextResponse.json({}, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, delta } = await req.json()
    if (!code || delta === undefined) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 })
    }
    await initDB()
    const overrides = await getOverrides()
    const newQty = Math.max(0, (overrides[code] ?? 0) + delta)
    await setOverride(code, newQty)
    return NextResponse.json({ quantity: newQty })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
