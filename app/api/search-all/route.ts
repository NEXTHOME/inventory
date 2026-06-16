export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import warehouseData from '../../../public/data.json'
import meoradiData from '../../../public/meoradi.json'
import ziritadiData from '../../../public/ziritadi.json'

type Item = { code: string; name: string; quantity: number; unit: string }
type CategoryKey = 'warehouse' | 'meoradi' | 'ziritadi'

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  warehouse: '🏭 საწყობი',
  meoradi: '♻️ მეორადი',
  ziritadi: '🔧 ძირითადი',
}

const ALL_ITEMS: (Item & { category: CategoryKey })[] = [
  ...(warehouseData as Item[]).map(i => ({ ...i, category: 'warehouse' as CategoryKey })),
  ...(meoradiData as Item[]).map(i => ({ ...i, category: 'meoradi' as CategoryKey })),
  ...(ziritadiData as Item[]).map(i => ({ ...i, category: 'ziritadi' as CategoryKey })),
]

function preFilter(query: string): typeof ALL_ITEMS {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1)
  if (!words.length) return []
  return ALL_ITEMS.filter(item => {
    const text = (item.name + ' ' + item.code).toLowerCase()
    return words.some(w => text.includes(w))
  }).slice(0, 300)
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json() as { query: string }
    if (!query?.trim()) return NextResponse.json({ results: [] })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ results: [] })

    const candidates = preFilter(query)
    if (!candidates.length) return NextResponse.json({ results: [] })

    const list = candidates.map(i => `${i.code}|${i.category}|${i.name}`).join('\n')

    const prompt = `შემდეგი სია სამშენებლო მასალების ინვენტარია (კოდი|კატეგორია|სახელი):
${list}

მომხმარებელი ეძებს: "${query}"

დაუბრუნე JSON მასივი კოდებით, რომლებიც ყველაზე კარგად ემთხვევა ძიებას (max 15).
მხოლოდ JSON: {"codes":["კოდი1","კოდი2"]}`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
        }),
      }
    )
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ results: [] })
    const parsed = JSON.parse(match[0])
    const codes: string[] = parsed.codes || []

    const results = codes
      .map(code => candidates.find(i => i.code === code))
      .filter(Boolean)
      .map(i => ({
        code: i!.code,
        name: i!.name,
        quantity: i!.quantity,
        unit: i!.unit,
        category: i!.category,
        categoryLabel: CATEGORY_LABELS[i!.category],
      }))

    return NextResponse.json({ results })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ results: [] })
  }
}
