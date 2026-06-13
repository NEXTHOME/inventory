'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import warehouseData from '../../public/data.json'
import meoradiData from '../../public/meoradi.json'
import ziritadiData from '../../public/ziritadi.json'

type Category = 'warehouse' | 'meoradi' | 'ziritadi'

type Item = {
  code: string
  name: string
  totalPrice: number
  unitPrice: number
  quantity: number
  unit: string
  isOld?: boolean
}

type CartItem = Item & { dispatchQty: number; category: Category; note: string }

type DispatchEntry = {
  id: number
  object_name: string
  vehicle: string
  created_at: string
  quantity: number
  unit: string
}

const allData: Record<Category, Item[]> = {
  warehouse: warehouseData as Item[],
  meoradi: meoradiData as Item[],
  ziritadi: ziritadiData as Item[],
}

const CATS: { v: Category; label: string }[] = [
  { v: 'warehouse', label: '🏭 მასალა' },
  { v: 'meoradi', label: '♻️ მეორადი' },
  { v: 'ziritadi', label: '🔧 ძირითადი' },
]

function getLastPart(code: string) {
  return code.trim().split(' ').pop() || code
}

function fmtShortDate(s: string) {
  const d = new Date(s)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

function compressImage(file: File, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, maxWidth / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Dispatch History Popup ───────────────────────────────────────────────────
function DispatchBadge({ entries }: { entries: DispatchEntry[] }) {
  const [open, setOpen] = useState(false)
  if (!entries.length) return null
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(p => !p) }}
        style={{
          background: '#fff3e0', border: 'none', borderRadius: 6,
          padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          color: '#d97706', whiteSpace: 'nowrap',
        }}
      >
        📍 გავიდა {entries.length}×
      </button>
      {open && (
        <>
          <div onClick={e => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 80 }} />
          <div style={{
            position: 'absolute', bottom: '110%', left: 0, zIndex: 90,
            background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            padding: '10px 12px', minWidth: 220, maxWidth: 280,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8 }}>სად გავიდა</div>
            {entries.map((e, i) => (
              <div key={i} style={{ marginBottom: i < entries.length - 1 ? 8 : 0, paddingBottom: i < entries.length - 1 ? 8 : 0, borderBottom: i < entries.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>📍 {e.object_name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>🚗 {e.vehicle}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: '#999' }}>{fmtShortDate(e.created_at)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e94560' }}>{e.quantity} {e.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GatanaPage() {
  const [category, setCategory] = useState<Category>('warehouse')
  const [query, setQuery] = useState('')
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({})
  const [dispatchSummary, setDispatchSummary] = useState<Record<string, DispatchEntry[]>>({})
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [objectName, setObjectName] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCodes, setAiCodes] = useState<string[] | null>(null)
  const [editingNoteCode, setEditingNoteCode] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/quantity').then(r => r.json()).then(setQtyOverrides).catch(() => {})
    fetch('/api/dispatch-summary').then(r => r.json()).then(setDispatchSummary).catch(() => {})
  }, [])

  const items = allData[category]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    if (aiCodes) return items.filter(i => aiCodes.includes(i.code))
    return items.filter(i =>
      i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
    )
  }, [items, query, aiCodes])

  useEffect(() => { setAiCodes(null) }, [query, category])

  const currentQty = (item: Item) =>
    item.code in qtyOverrides ? qtyOverrides[item.code] : item.quantity

  const addToCart = (item: Item) => {
    setCart(prev => {
      const exists = prev.find(c => c.code === item.code)
      if (exists) return prev.map(c => c.code === item.code ? { ...c, dispatchQty: c.dispatchQty + 1 } : c)
      return [...prev, { ...item, category, dispatchQty: 1, note: '' }]
    })
  }

  const removeFromCart = (code: string) => setCart(prev => prev.filter(c => c.code !== code))

  const updateCartQty = (code: string, qty: number) => {
    if (qty <= 0) return removeFromCart(code)
    setCart(prev => prev.map(c => c.code === code ? { ...c, dispatchQty: qty } : c))
  }

  const updateCartNote = (code: string, note: string) =>
    setCart(prev => prev.map(c => c.code === code ? { ...c, note } : c))

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    try {
      const compressed = await Promise.all(files.map(f => compressImage(f)))
      setPhotos(prev => [...prev, ...compressed])
    } catch { /* ignore */ }
    e.target.value = ''
  }

  const handleAiSearch = async () => {
    if (!query.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/gemini-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), items: items.map(i => ({ code: i.code, name: i.name })) }),
      })
      const data = await res.json()
      setAiCodes(data.codes || [])
    } finally { setAiLoading(false) }
  }

  const handleSubmit = async () => {
    if (!objectName.trim() || !vehicle.trim() || !cart.length) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectName: objectName.trim(),
          vehicle: vehicle.trim(),
          photos: photos.length ? photos : undefined,
          items: cart.map(c => ({
            item_code: c.code, item_name: c.name, quantity: c.dispatchQty,
            unit: c.unit, category: c.category, note: c.note || undefined,
            originalQty: currentQty(c),
          })),
        }),
      })
      const data = await res.json()
      if (data.id) {
        const newOverrides = { ...qtyOverrides }
        const newSummary = { ...dispatchSummary }
        const now = new Date().toISOString()
        cart.forEach(c => {
          newOverrides[c.code] = Math.max(0, currentQty(c) - c.dispatchQty)
          newSummary[c.code] = [
            { id: data.id, object_name: objectName.trim(), vehicle: vehicle.trim(), created_at: now, quantity: c.dispatchQty, unit: c.unit },
            ...(newSummary[c.code] || []),
          ]
        })
        setQtyOverrides(newOverrides)
        setDispatchSummary(newSummary)
        setCart([])
        setObjectName(''); setVehicle(''); setPhotos([])
        setShowConfirm(false); setShowCart(false)
        setSuccessMsg(`✓ გატანა #${data.id} შეინახა`)
        setTimeout(() => setSuccessMsg(''), 4000)
      }
    } finally { setSubmitting(false) }
  }

  const cartTotal = cart.reduce((s, c) => s + c.dispatchQty, 0)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', minHeight: '100vh', background: '#f5f5f7' }}>
      <style>{`* { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }`}</style>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#1a1a2e', color: '#fff', padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontSize: 20 }}>←</Link>
            <span style={{ fontSize: 17, fontWeight: 700 }}>📤 გატანა</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/gatana/istoria" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
              📋 ისტორია
            </Link>
            {cartTotal > 0 && (
              <button onClick={() => setShowCart(true)} style={{ background: '#e94560', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                🛒 {cartTotal}
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {CATS.map(c => (
            <button key={c.v} onClick={() => { setCategory(c.v); setQuery('') }} style={{
              flex: 1, padding: '7px 0', fontSize: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: category === c.v ? 700 : 400,
              background: category === c.v ? '#fff' : 'rgba(255,255,255,0.15)',
              color: category === c.v ? '#1a1a2e' : '#fff',
            }}>{c.label}</button>
          ))}
        </div>
        <input type="search" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="მოძებნე დასახელებით ან კოდით..." autoComplete="off"
          style={{ width: '100%', padding: '10px 14px', fontSize: 15, borderRadius: 10, border: 'none', outline: 'none' }} />
      </div>

      {successMsg && (
        <div style={{ background: '#22a06b', color: '#fff', padding: '12px 16px', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
          {successMsg}
        </div>
      )}

      {query && filtered.length < 3 && !aiLoading && !aiCodes && (
        <div style={{ margin: '12px 12px 0', background: '#fff', borderRadius: 12, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#666' }}>ვერ მოიძებნა? სცადე AI ძებნა</span>
          <button onClick={handleAiSearch} style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✨ Gemini</button>
        </div>
      )}
      {aiLoading && <div style={{ margin: '12px 12px 0', background: '#fff', borderRadius: 12, padding: '12px 14px', textAlign: 'center', fontSize: 13, color: '#888' }}>✨ Gemini ეძებს...</div>}
      {aiCodes && (
        <div style={{ margin: '12px 12px 0', background: '#ede9fe', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#4f46e5', fontWeight: 600 }}>✨ AI შედეგები: {filtered.length}</span>
          <button onClick={() => setAiCodes(null)} style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
      )}

      {/* Items list */}
      <div style={{ padding: '10px 12px 100px' }}>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>{filtered.length} პოზიცია</div>
        {filtered.map(item => {
          const qty = currentQty(item)
          const inCart = cart.find(c => c.code === item.code)
          const isEditingNote = editingNoteCode === item.code
          const dispatched = dispatchSummary[item.code] || []
          return (
            <div key={item.code} style={{ background: '#fff', borderRadius: 12, marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', opacity: qty === 0 ? 0.55 : 1, overflow: 'hidden' }}>
              <div style={{ padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: '#e94560', fontWeight: 600 }}>
                      {getLastPart(item.code)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: qty === 0 ? '#e94560' : qty <= 3 ? '#d97706' : '#22a06b' }}>
                      ({qty} {item.unit || ''})
                    </span>
                    <DispatchBadge entries={dispatched} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {item.name}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {inCart ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <button onClick={() => updateCartQty(item.code, inCart.dispatchQty - 1)} style={qtyBtnSt}>−</button>
                      <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{inCart.dispatchQty}</span>
                      <button onClick={() => updateCartQty(item.code, inCart.dispatchQty + 1)} style={qtyBtnSt}>+</button>
                      <button
                        onClick={() => setEditingNoteCode(isEditingNote ? null : item.code)}
                        style={{ background: inCart.note ? '#ede9fe' : '#f0f0f0', border: 'none', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', fontSize: 13 }}
                      >📝</button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item)} disabled={qty === 0} style={{
                      background: qty === 0 ? '#f0f0f0' : '#1a1a2e', color: qty === 0 ? '#aaa' : '#fff',
                      border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600,
                      cursor: qty === 0 ? 'default' : 'pointer',
                    }}>+ დამატება</button>
                  )}
                </div>
              </div>
              {isEditingNote && inCart && (
                <div style={{ padding: '0 14px 12px', borderTop: '1px solid #f5f5f5' }}>
                  <textarea autoFocus value={inCart.note} onChange={e => updateCartNote(item.code, e.target.value)}
                    placeholder="შენიშვნა ამ მასალაზე..." rows={2}
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #ede9fe', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                  <button onClick={() => setEditingNoteCode(null)} style={{ marginTop: 6, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    ✓ შენახვა
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Cart drawer */}
      {showCart && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div onClick={() => setShowCart(false)} style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 16px', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>🛒 კალათა ({cartTotal})</span>
              <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            {cart.map(c => (
              <div key={c.code} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8f8f8', borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#e94560', fontWeight: 600 }}>{getLastPart(c.code)}</div>
                    <div style={{ fontSize: 13, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    {c.note && <div style={{ fontSize: 11, color: '#4f46e5', marginTop: 2 }}>📝 {c.note}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => updateCartQty(c.code, c.dispatchQty - 1)} style={qtyBtnSt}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{c.dispatchQty}</span>
                    <button onClick={() => updateCartQty(c.code, c.dispatchQty + 1)} style={qtyBtnSt}>+</button>
                    <button onClick={() => removeFromCart(c.code)} style={{ background: 'none', border: 'none', color: '#e94560', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => { setShowCart(false); setShowConfirm(true) }} style={{ width: '100%', padding: '14px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
              📤 გაგზავნა
            </button>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={() => setShowConfirm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 16px', width: '100%', maxWidth: 600, margin: '0 auto', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>📤 გატანის დეტალები</div>
            <label style={lblSt}>ობიექტი / მისამართი</label>
            <input value={objectName} onChange={e => setObjectName(e.target.value)} placeholder="მაგ: ბათუმი, ჩახრუხაძის 5" style={inpSt} autoFocus />
            <label style={lblSt}>მანქანა / მძღოლი</label>
            <input value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="მაგ: GX500AA / გიორგი" style={inpSt} />
            <label style={lblSt}>ფოტოები (სურვილისამებრ)</label>
            <div style={{ marginBottom: 14 }}>
              {photos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {photos.map((p, i) => (
                    <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p} alt={`photo-${i}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                      <button type="button" onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 20, width: 22, height: 22, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => photoInputRef.current?.click()} style={{ width: '100%', padding: '11px', background: '#f8f8f8', border: '2px dashed #ddd', borderRadius: 10, fontSize: 14, color: '#888', cursor: 'pointer' }}>
                📷 {photos.length > 0 ? `+ კიდევ ფოტო (${photos.length})` : 'ფოტოს გადაღება / ატვირთვა'}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoChange} style={{ display: 'none' }} />
            </div>
            <div style={{ background: '#f8f8f8', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>გასატანი ({cartTotal} ერთ.)</div>
              {cart.map(c => (
                <div key={c.code} style={{ paddingBottom: 4, marginBottom: 4, borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#333' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{c.name}</span>
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>{c.dispatchQty} {c.unit}</span>
                  </div>
                  {c.note && <div style={{ fontSize: 11, color: '#4f46e5', marginTop: 1 }}>📝 {c.note}</div>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '13px', background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}>გაუქმება</button>
              <button onClick={handleSubmit} disabled={submitting || !objectName.trim() || !vehicle.trim()} style={{
                flex: 2, padding: '13px', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
                cursor: submitting || !objectName.trim() || !vehicle.trim() ? 'default' : 'pointer',
                background: submitting || !objectName.trim() || !vehicle.trim() ? '#ccc' : '#e94560', color: '#fff',
              }}>{submitting ? 'ინახება...' : '✓ დადასტურება'}</button>
            </div>
          </div>
        </div>
      )}

      {cartTotal > 0 && !showCart && !showConfirm && (
        <button onClick={() => setShowCart(true)} style={{
          position: 'fixed', bottom: 24, right: 16, zIndex: 40, background: '#e94560', color: '#fff',
          border: 'none', borderRadius: 50, width: 60, height: 60, fontSize: 22, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(233,69,96,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          🛒
          <span style={{ position: 'absolute', top: 4, right: 4, background: '#fff', color: '#e94560', borderRadius: 10, fontSize: 11, fontWeight: 800, padding: '1px 5px' }}>{cartTotal}</span>
        </button>
      )}
    </div>
  )
}

const qtyBtnSt: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: '1px solid #e0e0e0', background: '#f8f8f8', fontSize: 16, cursor: 'pointer', fontWeight: 700 }
const lblSt: React.CSSProperties = { display: 'block', fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 6 }
const inpSt: React.CSSProperties = { width: '100%', padding: '11px 14px', fontSize: 15, borderRadius: 10, border: '1.5px solid #e0e0e0', outline: 'none', marginBottom: 14, boxSizing: 'border-box' }
