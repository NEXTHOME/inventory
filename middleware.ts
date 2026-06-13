import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE } from './lib/auth'

const PUBLIC = ['/login', '/api/auth']

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // Allow public paths
  if (PUBLIC.some(p => path.startsWith(p))) return NextResponse.next()
  // Allow static files and Next.js internals
  if (path.startsWith('/_next') || path.startsWith('/api/image')) return NextResponse.next()

  const token = req.cookies.get(COOKIE)?.value
  const valid = token ? await verifyToken(token) : false

  if (!valid) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-|manifest|sw.js|imageMap.json).*)'],
}
