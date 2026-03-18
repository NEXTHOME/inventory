'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import data from '../public/data.json'

type Item = {
  code: string
  name: string
  totalPrice: number
  unitPrice: number
  quantity: number
  unit: string
}

const items = data as Item[]

function fmt(n: number) {
  if (!n) return '—'
  return n.toLocaleString('ka-GE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

// ─── Image Card Component ────────────────────────────────────────────────────

function ItemCard({ item, imageMap }: { item: Item; imageMap: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgState, setImgState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle')
  const [editing, setEditing] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const fetchedRef = useRef(false)

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

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  return (
    <div style={{
      background: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden',
      boxShadow: expanded
        ? '0 0 0 2px #e94560, 0 4px 16px rgba(0,0,0,0.12)'
        : '0 1px 4px rgba(0,0,0,0.08)',
    }}>
      <div onClick={() => setExpanded(p => !p)} style={{ padding: '12px 14px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#e94560', background: '#fff0f3', padding: '2px 8px', borderRadius: 6 }}>
            {item.code}
          </span>
          <span style={{ fontSize: 11, color: '#666', background: '#f0f0f0', padding: '2px 8px', borderRadius: 6 }}>
            {item.unit || '—'}
          </span>
        </div>
        <div style={{
          fontSize: 14, fontWeight: 500, color: '#111', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: expanded ? undefined : 2,
          WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden',
        }}>
          {item.name}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          <Stat label="სრული ფასი" value={`${fmt(item.totalPrice)} ₾`} accent />
          <Stat label="ერთ. ფასი" value={`${fmt(item.unitPrice)} ₾`} />
          <Stat label="რაოდენობა" value={item.quantity ? String(item.quantity) : '—'} />
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 14px' }}>
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
          {(imgState === 'error') && !editing && (
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
      <div style={{ fontSize: 10, color: '#999', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: accent ? '#1a1a2e' : '#333' }}>{value}</div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 20, 100, 300]

export default function Home() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'code' | 'name'>('all')
  const [imageMap, setImageMap] = useState<Record<string, string>>({})
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/imageMap.json').then(r => r.json()).then(setImageMap).catch(() => {})
  }, [])

  // reset page when query changes
  useEffect(() => { setPage(1) }, [query, filter, pageSize])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(item => {
      if (filter === 'code') return item.code.toLowerCase().includes(q)
      if (filter === 'name') return item.name.toLowerCase().includes(q)
      return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
    })
  }, [query, filter])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', minHeight: '100vh' }}>
      <style>{`* { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }`}</style>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1a1a2e', color: '#fff', padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          ინვენტარი
          <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>{items.length} პოზიცია</span>
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

      {/* Content */}
      <div style={{ padding: '12px 12px 80px' }}>

        {/* Top bar: results count + page size */}
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

        {/* Item list */}
        {visible.map(item => (
          <ItemCard key={item.code} item={item} imageMap={imageMap} />
        ))}

        {/* Pagination */}
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
