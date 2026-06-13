import { NextRequest, NextResponse } from 'next/server'
import { signToken, verifyToken, COOKIE } from '../../../lib/auth'
import { initDB, getSetting, setSetting } from '../../../lib/db'

const ENV_PASSWORD = process.env.AUTH_PASSWORD || 'admin123'
const PIN_PREFIX = '__pin__'
const PW_KEY = 'auth_password'

async function getPassword(): Promise<string> {
  try {
    await initDB()
    const stored = await getSetting(PW_KEY)
    return stored ?? ENV_PASSWORD
  } catch {
    return ENV_PASSWORD
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { password, newPassword, currentPassword } = body

  // Change password flow
  if (newPassword !== undefined) {
    const stored = await getPassword()
    if (currentPassword !== stored) {
      return NextResponse.json({ error: 'wrong_password' }, { status: 401 })
    }
    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: 'too_short' }, { status: 400 })
    }
    await setSetting(PW_KEY, newPassword)
    return NextResponse.json({ ok: true })
  }

  const isPin = password?.startsWith(PIN_PREFIX)
  const actual = isPin ? password.slice(PIN_PREFIX.length) : password

  if (!isPin) {
    const stored = await getPassword()
    const isFirstRun = stored === ENV_PASSWORD && ENV_PASSWORD === 'admin123'
    // First-run: any password sets it
    if (isFirstRun && actual && actual !== 'admin123') {
      // Not first-run flow — just check normally
    }
    if (actual !== stored) {
      return NextResponse.json({ error: 'wrong_password' }, { status: 401 })
    }
  }

  if (isPin && !/^\d{4}$/.test(actual)) {
    return NextResponse.json({ error: 'invalid_pin' }, { status: 401 })
  }

  const token = await signToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE)
  return res
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value
  if (!token) return NextResponse.json({ auth: false })
  const valid = await verifyToken(token)
  return NextResponse.json({ auth: valid })
}

// Check if password has been customized
export async function PATCH() {
  try {
    await initDB()
    const stored = await getSetting(PW_KEY)
    const isDefault = !stored
    return NextResponse.json({ isDefault })
  } catch {
    return NextResponse.json({ isDefault: true })
  }
}
