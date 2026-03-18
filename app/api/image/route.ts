import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ imageUrl: null })

  const apiKey = process.env.GOOGLE_API_KEY
  const cx = process.env.GOOGLE_CSE_ID

  if (!apiKey || !cx) return NextResponse.json({ imageUrl: null })

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&searchType=image&num=3&imgSize=medium`
    const res = await fetch(url)
    const data = await res.json()
    const imageUrl = data.items?.[0]?.link ?? null
    return NextResponse.json({ imageUrl })
  } catch {
    return NextResponse.json({ imageUrl: null })
  }
}
