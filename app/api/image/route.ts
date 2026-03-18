import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ imageUrl: null })

  const apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) return NextResponse.json({ imageUrl: null, error: 'missing_key' })

  // Try Georgian query, then English translation hint
  const queries = [q, `${q} construction material tool`]

  for (const query of queries) {
    try {
      const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=5&safesearch=true`
      const res = await fetch(url)
      const data = await res.json()

      if (data.hits && data.hits.length > 0) {
        return NextResponse.json({ imageUrl: data.hits[0].webformatURL })
      }
    } catch {
      // try next query
    }
  }

  return NextResponse.json({ imageUrl: null })
}
