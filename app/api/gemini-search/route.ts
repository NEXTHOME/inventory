import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { query, items } = await req.json() as { query: string; items: { code: string; name: string }[] }
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ codes: [] })

    // Send a sample of items (max 200) to avoid token limits
    const sample = items.slice(0, 200).map(i => `${i.code}|${i.name}`).join('\n')

    const prompt = `შემდეგი სია არის სამშენებლო/სასაწყობო მასალების ინვენტარი (კოდი|სახელი):
${sample}

მომხმარებელი ეძებს: "${query}"

დაუბრუნე მხოლოდ JSON მასივი კოდებით, რომლებიც ყველაზე მეტად ემთხვევა ძიებას (max 10).
ფორმატი: {"codes":["კოდი1","კოდი2"]}
მხოლოდ JSON, სხვა ტექსტი არ გჭირდება.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
        }),
      }
    )
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ codes: [] })
    const parsed = JSON.parse(match[0])
    return NextResponse.json({ codes: parsed.codes || [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ codes: [] })
  }
}
