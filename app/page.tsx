'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import warehouseData from '../public/data.json'
import meoradiData from '../public/meoradi.json'
import ziritadiData from '../public/ziritadi.json'

type Item = {
  code: string
  name: string
  totalPrice: number
  unitPrice: number
  quantity: number
  unit: string
  isOld?: boolean
}

type Category = 'warehouse' | 'meoradi' | 'ziritadi'
type CatItem = Item & { _cat: Category }

const CAT_META: Record<Category, { label: string; badge: string; color: string; bg: string }> = {
  warehouse: { label: 'საწყობის ნაშთი', badge: '🏭', color: '#38bdf8', bg: 'rgba(56,189,248,0.16)' },
  meoradi:   { label: 'მეორადი',        badge: '♻️', color: '#4ade80', bg: 'rgba(74,222,128,0.16)' },
  ziritadi:  { label: 'ძირითადი',       badge: '🔧', color: '#c084fc', bg: 'rgba(192,132,252,0.16)' },
}

const dataByCat: Record<Category, CatItem[]> = {
  warehouse: (warehouseData as Item[]).map(i => ({ ...i, _cat: 'warehouse' })),
  meoradi:   (meoradiData as Item[]).map(i => ({ ...i, _cat: 'meoradi' })),
  ziritadi:  (ziritadiData as Item[]).map(i => ({ ...i, _cat: 'ziritadi' })),
}
const allItems: CatItem[] = [...dataByCat.warehouse, ...dataByCat.meoradi, ...dataByCat.ziritadi]

function fmt(n: number) {
  if (!n) return '—'
  return n.toFixed(2).replace('.', ',')
}

const CACHE_KEY = 'inv_img_v2'
function getCache(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
function saveCache(code: string, url: string) {
  const c = getCache(); c[code] = url; localStorage.setItem(CACHE_KEY, JSON.stringify(c))
}
function clearCacheItem(code: string) {
  const c = getCache(); delete c[code]; localStorage.setItem(CACHE_KEY, JSON.stringify(c))
}

function fallbackCopy(text: string, onDone: () => void) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'; ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.focus(); ta.select()
  try { document.execCommand('copy'); onDone() } catch { /* ignore */ }
  document.body.removeChild(ta)
}

function getLastPart(code: string) {
  const parts = code.trim().split(' ')
  return parts[parts.length - 1]
}

// ─── Image Card Component ────────────────────────────────────────────────────

type DispatchEntry = { id: number; object_name: string; vehicle: string; created_at: string; quantity: number; unit: string }

function fmtShortDate(s: string) {
  const d = new Date(s)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

function HistoryBadge({ entries }: { entries: DispatchEntry[] }) {
  const [open, setOpen] = useState(false)
  if (!entries.length) return null
  return (
    <>
      <button type="button"
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        style={{ background: '#fff3e0', border: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#d97706', whiteSpace: 'nowrap' }}
      >
        📍 {entries.length}×
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={e => { e.stopPropagation(); setOpen(false) }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '20px 16px 32px', maxHeight: '70vh', overflowY: 'auto',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.2)',
          }}>
            {/* handle */}
            <div style={{ width: 40, height: 4, background: '#e0e0e0', borderRadius: 2, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>📍 გატანის ისტორია</span>
              <button type="button" onClick={() => setOpen(false)}
                style={{ background: '#f0f0f0', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: '#555' }}>✕</button>
            </div>
            {entries.map((e, i) => (
              <div key={i} style={{
                background: '#f8f8f8', borderRadius: 12, padding: '12px 14px',
                marginBottom: i < entries.length - 1 ? 10 : 0,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📍 {e.object_name}</div>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>🚗 {e.vehicle}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#999' }}>📅 {fmtShortDate(e.created_at)}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e94560', background: '#fff0f3', padding: '2px 10px', borderRadius: 8 }}>
                    {e.quantity} {e.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function ItemCard({
  item, imageMap, qtyOverrides, onQtyChange, dispatchEntries, catMeta,
}: {
  item: Item
  imageMap: Record<string, string>
  qtyOverrides: Record<string, number>
  onQtyChange: (code: string, newQty: number) => void
  dispatchEntries: DispatchEntry[]
  catMeta?: { label: string; badge: string; color: string; bg: string }
}) {
  const [expanded, setExpanded] = useState(false)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgState, setImgState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle')
  const [editing, setEditing] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [dispatchAmt, setDispatchAmt] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fetchedRef = useRef(false)

  const currentQty = item.code in qtyOverrides ? qtyOverrides[item.code] : item.quantity

  useEffect(() => {
    if (!expanded || fetchedRef.current) return
    fetchedRef.current = true

    if (imageMap[item.code]) {
      setImgUrl(imageMap[item.code]); setImgState('found'); return
    }
    const cached = getCache()[item.code]
    if (cached) { setImgUrl(cached); setImgState('found'); return }

    setImgState('loading')
    fetch(`/api/image?q=${encodeURIComponent(item.name)}`)
      .then(r => r.json())
      .then(d => {
        if (d.imageUrl) { setImgUrl(d.imageUrl); setImgState('found'); saveCache(item.code, d.imageUrl) }
        else setImgState('error')
      })
      .catch(() => setImgState('error'))
  }, [expanded, item.code, item.name, imageMap])

  const handleSave = () => {
    if (customUrl.trim()) { setImgUrl(customUrl.trim()); setImgState('found'); saveCache(item.code, customUrl.trim()) }
    setEditing(false); setCustomUrl('')
  }

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation()
    clearCacheItem(item.code); fetchedRef.current = false
    setImgUrl(null); setImgState('idle')
    setTimeout(() => { fetchedRef.current = false }, 50)
  }

  const handleDispatch = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const amt = parseFloat(dispatchAmt)
    if (!amt || amt <= 0) return
    setDispatching(true)
    try {
      const res = await fetch('/api/quantity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: item.code, delta: -amt }),
      })
      const data = await res.json()
      if (data.quantity !== undefined) {
        onQtyChange(item.code, data.quantity)
        setDispatchAmt('')
      }
    } finally {
      setDispatching(false)
    }
  }

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation()
    const last = getLastPart(item.code).slice(-5)
    const finish = () => { setCopied(true); setTimeout(() => setCopied(false), 1500) }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(last).then(finish).catch(() => fallbackCopy(last, finish))
    } else {
      fallbackCopy(last, finish)
    }
  }

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const hasLowStock = currentQty !== null && currentQty <= 3 && currentQty > 0
  const isZero = currentQty === 0

  const qtyColor = isZero ? '#fb7185' : hasLowStock ? '#fbbf24' : '#34d399'
  const qtyBg = isZero ? 'rgba(251,113,133,0.16)' : hasLowStock ? 'rgba(251,191,36,0.16)' : 'rgba(52,211,153,0.16)'

  return (
    <div style={{
      background: item.isOld
        ? 'linear-gradient(160deg, #2a2616 0%, #20212e 60%)'
        : 'linear-gradient(160deg, #24263a 0%, #1c1d2b 100%)',
      borderRadius: 16, marginBottom: 10, overflow: 'hidden',
      borderLeft: `4px solid ${qtyColor}`,
      borderTop: expanded ? '1px solid rgba(233,69,96,0.6)' : '1px solid rgba(255,255,255,0.06)',
      borderRight: expanded ? '1px solid rgba(233,69,96,0.6)' : '1px solid rgba(255,255,255,0.06)',
      borderBottom: expanded ? '1px solid rgba(233,69,96,0.6)' : '1px solid rgba(255,255,255,0.06)',
      boxShadow: expanded
        ? '0 10px 30px rgba(0,0,0,0.4)'
        : '0 1px 2px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.15)',
      transition: 'box-shadow 0.2s, border-color 0.2s',
    }}>
      <div onClick={() => setExpanded(p => !p)} style={{ padding: '13px 15px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <span
            onClick={handleCopyCode}
            title="კოპირება"
            style={{
              fontSize: 11.5, fontWeight: 700, letterSpacing: '0.03em',
              color: copied ? '#34d399' : '#fda4af',
              background: copied ? 'rgba(52,211,153,0.16)' : 'rgba(233,69,96,0.18)',
              padding: '3px 10px', borderRadius: 7, cursor: 'copy',
              transition: 'all 0.2s', flexShrink: 0,
            }}
          >
            {copied ? '✓ დაკოპირდა' : getLastPart(item.code)}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {catMeta && (
              <span style={{ fontSize: 11, fontWeight: 700, color: catMeta.color, background: catMeta.bg, padding: '3px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>
                {catMeta.badge} {catMeta.label}
              </span>
            )}
            {dispatchEntries.length > 0 && (
              <HistoryBadge entries={dispatchEntries} />
            )}
            <span style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: 7 }}>
              {item.unit || '—'}
            </span>
          </div>
        </div>
        <div style={{
          fontSize: 14.5, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: expanded ? undefined : 2,
          WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden',
        }}>
          {item.name}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '8px 14px' }}>
            <Stat label="სრული ფასი" value={`${fmt(item.totalPrice)} ₾`} accent />
            <Stat label="ერთ. ფასი" value={`${fmt(item.unitPrice)} ₾`} />
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: qtyBg, borderRadius: 12, padding: '6px 14px', minWidth: 64, flexShrink: 0,
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: qtyColor, lineHeight: 1.1 }}>
              {currentQty !== undefined ? String(currentQty) : '—'}
            </span>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: qtyColor, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isZero ? 'არ არის' : hasLowStock ? 'მცირე' : 'მარაგი'}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: '#fbfbfd', padding: '12px 14px' }}>

          {/* Dispatch row */}
          <div onClick={e => e.stopPropagation()} style={{
            display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center',
          }}>
            <input
              type="number"
              min="0"
              value={dispatchAmt}
              onChange={e => setDispatchAmt(e.target.value)}
              placeholder="გასატანი რაოდენობა"
              onKeyDown={e => e.key === 'Enter' && handleDispatch(e as unknown as React.MouseEvent)}
              style={{
                flex: 1, padding: '8px 12px', fontSize: 14, borderRadius: 8,
                border: '1.5px solid #e0e0e0', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleDispatch}
              disabled={dispatching || !dispatchAmt}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: dispatching || !dispatchAmt ? '#f0f0f0' : '#1a1a2e',
                color: dispatching || !dispatchAmt ? '#aaa' : '#fff',
                fontSize: 13, fontWeight: 600, cursor: dispatching || !dispatchAmt ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {dispatching ? '...' : '📤 გატანა'}
            </button>
          </div>

          {/* Image section */}
          {imgState === 'loading' && (
            <div style={{ height: 120, background: '#f8f8f8', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13 }}>
              <span style={{ marginRight: 6 }}>⏳</span> ეძებს Google-ზე...
            </div>
          )}
          {imgState === 'found' && imgUrl && !editing && (
            <div>
              <img src={imgUrl} alt={item.name}
                onError={() => { setImgState('error'); clearCacheItem(item.code) }}
                style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, background: '#f8f8f8', display: 'block' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <SmallBtn onClick={e => { e.stopPropagation(); setEditing(true) }}>✏️ შეცვლა</SmallBtn>
                <SmallBtn onClick={handleRefresh}>🔄 ახლიდან</SmallBtn>
              </div>
            </div>
          )}
          {(imgState === 'error' || imgState === 'idle') && !editing && (
            <div style={{ background: '#f8f8f8', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
              <div style={{ color: '#bbb', fontSize: 13, marginBottom: 8 }}>ფოტო ვერ მოიძებნა</div>
              <SmallBtn onClick={e => { e.stopPropagation(); setEditing(true) }}>+ ბმული ჩასვი</SmallBtn>
            </div>
          )}
          {editing && (
            <div onClick={e => e.stopPropagation()}>
              <input ref={inputRef} type="url" value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="ფოტოს ბმული (https://...)"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #e94560', outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={handleSave} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#e94560', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  შენახვა
                </button>
                <button onClick={() => { setEditing(false); setCustomUrl('') }} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#f0f0f0', color: '#333', fontSize: 14, cursor: 'pointer' }}>
                  გაუქმება
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SmallBtn({ onClick, children }: { onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#f8f8f8', fontSize: 12, cursor: 'pointer', color: '#444' }}>
      {children}
    </button>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: accent ? '#ffffff' : '#cbd5e1' }}>{value}</div>
    </div>
  )
}

// ─── Global AI Search ────────────────────────────────────────────────────────

type GlobalResult = {
  code: string; name: string; quantity: number; unit: string
  category: 'warehouse' | 'meoradi' | 'ziritadi'; categoryLabel: string
}

function GlobalSearch({ onClose, onSelect }: {
  onClose: () => void
  onSelect: (cat: 'warehouse' | 'meoradi' | 'ziritadi', code: string) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GlobalResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const search = async () => {
    if (!q.trim()) return
    setLoading(true); setSearched(false)
    try {
      const res = await fetch('/api/search-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      setResults(data.results || [])
    } catch { setResults([]) }
    setLoading(false); setSearched(true)
  }

  const catColor: Record<string, string> = {
    warehouse: '#1a6e8a', meoradi: '#2e7d32', ziritadi: '#6a1e8a'
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '0 0 20px 20px', padding: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>←</button>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>🔍 AI ძიება — ყველა კატეგორია</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="მაგ: მილი 50-90, ლამინატი, ბეტონი..."
            style={{ flex: 1, padding: '10px 14px', fontSize: 15, borderRadius: 10, border: '1.5px solid #e0e0e0', outline: 'none' }} />
          <button onClick={search} disabled={loading || !q.trim()}
            style={{ padding: '10px 18px', borderRadius: 10, background: loading ? '#ccc' : '#1a1a2e', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
            {loading ? '...' : 'ძიება'}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 40px' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#fff', fontSize: 14, marginTop: 40 }}>🔍 Gemini ეძებს...</div>
        )}
        {searched && !loading && results.length === 0 && (
          <div style={{ textAlign: 'center', color: '#fff', fontSize: 14, marginTop: 40 }}>ვერ მოიძებნა</div>
        )}
        {results.map(r => (
          <div key={r.code} onClick={() => { onSelect(r.category, r.code); onClose() }}
            style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', marginBottom: 10, cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 4, lineHeight: 1.3 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{r.code}</div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{r.quantity} {r.unit}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: catColor[r.category] + '20', color: catColor[r.category] }}>
                {r.categoryLabel}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 20, 100, 300]

export default function Home() {
  const [category, setCategory] = useState<Category | 'all'>('warehouse')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'code' | 'name'>('all')
  const [imageMap, setImageMap] = useState<Record<string, string>>({})
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({})
  const [dispatchSummary, setDispatchSummary] = useState<Record<string, {id:number;object_name:string;vehicle:string;created_at:string;quantity:number;unit:string}[]>>({})
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)

  const items: CatItem[] = category === 'all' ? allItems : dataByCat[category]
  const showCatBadge = category === 'all'

  useEffect(() => {
    fetch('/imageMap.json').then(r => r.json()).then(setImageMap).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/quantity').then(r => r.json()).then(setQtyOverrides).catch(() => {})
    fetch('/api/dispatch-summary').then(r => r.json()).then(setDispatchSummary).catch(() => {})

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetch('/api/dispatch-summary').then(r => r.json()).then(setDispatchSummary).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const handleQtyChange = (code: string, newQty: number) => {
    setQtyOverrides(prev => ({ ...prev, [code]: newQty }))
  }

  useEffect(() => { setPage(1) }, [category, query, filter, pageSize])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q ? items.filter(item => {
      if (filter === 'code') return item.code.toLowerCase().includes(q)
      if (filter === 'name') return item.name.toLowerCase().includes(q)
      return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
    }) : [...items]
    // push items whose last code part starts with "00" to the bottom
    return base.sort((a, b) => {
      const az = getLastPart(a.code).startsWith('00')
      const bz = getLastPart(b.code).startsWith('00')
      if (az === bz) return 0
      return az ? 1 : -1
    })
  }, [category, query, filter, items])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', minHeight: '100vh' }}>
      <style>{`* { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }`}</style>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1a1a2e', color: '#fff', padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            ინვენტარი
            <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>{items.length} პოზ.</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/gatana" style={{
              textDecoration: 'none', background: '#22a06b', color: '#fff',
              padding: '6px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            }}>
              📤 გატანა
            </Link>
            <Link href="/calculator" style={{
              textDecoration: 'none', background: '#e94560', color: '#fff',
              padding: '6px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            }}>
              🧮 კალკ.
            </Link>
            <button onClick={() => setShowGlobalSearch(true)} style={{
              background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
              padding: '6px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              🔍
            </button>
            <Link href="/waybill" style={{
              textDecoration: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff',
              padding: '6px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            }}>
              📋 ზედნ.
            </Link>
            <Link href="/profile" style={{
              textDecoration: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff',
              padding: '6px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            }}>
              👤
            </Link>
          </div>
        </div>

        {/* Category switcher */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {([
            { v: 'all', label: '🔎 ყველა' },
            { v: 'warehouse', label: '🏭 მასალა' },
            { v: 'meoradi', label: '♻️ მეორადი' },
            { v: 'ziritadi', label: '🔧 ძირითადი' },
          ] as const).map(c => (
            <button key={c.v} onClick={() => { setCategory(c.v); setQuery('') }} style={{
              flex: 1, padding: '8px 0', fontSize: 11.5, borderRadius: 10, border: 'none',
              cursor: 'pointer', fontWeight: category === c.v ? 700 : 400,
              background: category === c.v ? '#fff' : 'rgba(255,255,255,0.15)',
              color: category === c.v ? '#1a1a2e' : '#fff',
            }}>
              {c.label}
            </button>
          ))}
        </div>

        <input type="search" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="მოძებნე კოდით ან დასახელებით..."
          autoComplete="off"
          style={{ width: '100%', padding: '10px 14px', fontSize: 16, borderRadius: 10, border: 'none', outline: 'none', background: '#fff', color: '#111' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {(['all', 'code', 'name'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              flex: 1, padding: '6px 0', fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: filter === f ? 700 : 400,
              background: filter === f ? '#e94560' : 'rgba(255,255,255,0.15)', color: '#fff',
            }}>
              {f === 'all' ? 'ყველა' : f === 'code' ? 'კოდი' : 'დასახელება'}
            </button>
          ))}
        </div>
      </div>

      {showGlobalSearch && (
        <GlobalSearch
          onClose={() => setShowGlobalSearch(false)}
          onSelect={(cat, code) => {
            setCategory(cat)
            setQuery(code)
            setFilter('code')
          }}
        />
      )}

      {/* Content */}
      <div style={{ padding: '12px 12px 80px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: '#888' }}>
            {filtered.length} შედეგი
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {PAGE_SIZES.map(s => (
              <button key={s} onClick={() => setPageSize(s)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: pageSize === s ? 700 : 400,
                background: pageSize === s ? '#1a1a2e' : '#e8e8e8',
                color: pageSize === s ? '#fff' : '#555',
              }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {visible.map(item => (
          <ItemCard
            key={`${item._cat}:${item.code}`}
            item={item}
            imageMap={imageMap}
            qtyOverrides={qtyOverrides}
            onQtyChange={handleQtyChange}
            dispatchEntries={dispatchSummary[item.code] || []}
            catMeta={showCatBadge ? CAT_META[item._cat] : undefined}
          />
        ))}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
            <PageBtn disabled={page === 1} onClick={() => setPage(1)}>«</PageBtn>
            <PageBtn disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</PageBtn>
            <span style={{ fontSize: 14, color: '#555', padding: '0 8px' }}>
              {page} / {totalPages}
            </span>
            <PageBtn disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</PageBtn>
            <PageBtn disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</PageBtn>
          </div>
        )}
      </div>
    </div>
  )
}

function PageBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 36, height: 36, borderRadius: 8, border: 'none', cursor: disabled ? 'default' : 'pointer',
      background: disabled ? '#f0f0f0' : '#1a1a2e', color: disabled ? '#bbb' : '#fff',
      fontSize: 16, fontWeight: 600,
    }}>
      {children}
    </button>
  )
}
