import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ imageUrl: null })

  const apiKey = process.env.GOOGLE_API_KEY
  const cx = process.env.GOOGLE_CSE_ID

  if (!apiKey || !cx) {
    return NextResponse.json({ imageUrl: null, error: 'missing_env' })
  }

  // Try with Georgian query first, then English fallback
  const queries = [q, `${q} building material`]

  for (const query of queries) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&num=5&imgSize=medium&safe=active`
      const res = await fetch(url)
      const data = await res.json()

      if (data.error) {
        return NextResponse.json({ imageUrl: null, error: data.error.message })
      }

      // Pick first image that's not a tiny icon
      const items = data.items || []
      for (const item of items) {
        const w = item.image?.width ?? 0
        const h = item.image?.height ?? 0
        if (w >= 100 && h >= 100) {
          return NextResponse.json({ imageUrl: item.link })
        }
      }
      if (items[0]?.link) {
        return NextResponse.json({ imageUrl: items[0].link })
      }
    } catch {
      // continue to next query
    }
  }

  return NextResponse.json({ imageUrl: null })
}
