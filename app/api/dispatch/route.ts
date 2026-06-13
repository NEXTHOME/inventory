export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { initDB, saveDispatch, getOverrides, setOverride, DispatchItem } from '../../../lib/db'

export async function POST(req: NextRequest) {
  try {
    const { objectName, vehicle, items, photo, photos } = await req.json() as {
      objectName: string
      vehicle: string
      photo?: string
      photos?: string[]
      items: (DispatchItem & { originalQty: number })[]
    }

    if (!objectName || !vehicle || !items?.length) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 })
    }

    await initDB()
    const overrides = await getOverrides()

    for (const it of items) {
      const current = it.item_code in overrides ? overrides[it.item_code] : it.originalQty
      const newQty = Math.max(0, current - it.quantity)
      await setOverride(it.item_code, newQty)
    }

    const dispatchId = await saveDispatch(objectName, vehicle, items, photos ?? photo)
    return NextResponse.json({ id: dispatchId })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
