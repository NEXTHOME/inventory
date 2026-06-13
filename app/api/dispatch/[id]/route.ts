export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { initDB, getDispatch, updateDispatch, deleteDispatch, getSetting, DispatchItem } from '../../../../lib/db'

const ENV_PASSWORD = process.env.AUTH_PASSWORD || 'admin123'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDB()
    const dispatch = await getDispatch(Number(params.id))
    if (!dispatch) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(dispatch)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { objectName, vehicle, items, photo, photos, dispatch_note, is_test } = await req.json() as {
      objectName: string
      vehicle: string
      photo?: string | null
      photos?: string[]
      dispatch_note?: string | null
      is_test?: boolean
      items: DispatchItem[]
    }
    if (!objectName || !vehicle || !items?.length) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 })
    }
    await initDB()
    const photoVal = photos?.length ? photos : photo
    await updateDispatch(Number(params.id), objectName, vehicle, items, photoVal, dispatch_note, is_test)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { password } = await req.json()
    await initDB()
    const stored = await getSetting('auth_password') ?? ENV_PASSWORD
    if (password !== stored) {
      return NextResponse.json({ error: 'wrong_password' }, { status: 401 })
    }
    await deleteDispatch(Number(params.id))
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
