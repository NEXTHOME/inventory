import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ imageUrl: null })

  const apiKey = process.env.SERP_API_KEY
  if (!apiKey) return NextResponse.json({ imageUrl: null, error: 'missing_key' })

  try {
    const url = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(q)}&api_key=${apiKey}&num=5&ijn=0`
    const res = await fetch(url)
    const data = await res.json()

    const images = data.images_results || []
    if (images.length > 0) {
      return NextResponse.json({ imageUrl: images[0].original })
    }

    // fallback: try with "სამშენებლო მასალა" appended
    const url2 = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(q + ' სამშენებლო')}&api_key=${apiKey}&num=3`
    const res2 = await fetch(url2)
    const data2 = await res2.json()
    const images2 = data2.images_results || []
    if (images2.length > 0) {
      return NextResponse.json({ imageUrl: images2[0].original })
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ imageUrl: null })
}
