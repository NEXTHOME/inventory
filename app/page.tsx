'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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

const CACHE_KEY = 'inv_img_cache'

function getCache(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
function setCache(code: string, url: string) {
  const c = getCache(); c[code] = url
  localStorage.setItem(CACHE_KEY, JSON.stringify(c))
}
function clearCacheItem(code: string) {
  const c = getCache(); delete c[code]
  localStorage.setItem(CACHE_KEY, JSON.stringify(c))
}

function ItemCard({ item, imageMap }: { item: Item; imageMap: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgState, setImgState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle')
  const [editing, setEditing] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Load image when expanded
  useEffect(() => {
    if (!expanded) return
    if (imgState !== 'idle') return

    // 1. Check manual override from imageMap.json
    if (imageMap[item.code]) {
      setImgUrl(imageMap[item.code])
      setImgState('found')
      return
    }

    // 2. Check localStorage cache
    const cache = getCache()
    if (cache[item.code]) {
      setImgUrl(cache[item.code])
      setImgState('found')
      return
    }

    // 3. Search Google
    setImgState('loading')
    fetch(`/api/image?q=${encodeURIComponent(item.name + ' სამშენებლო მასალა')}`)
      .then(r => r.json())
      .then(({ imageUrl }) => {
        if (imageUrl) {
          setImgUrl(imageUrl)
          setImgState('found')
          setCache(item.code, imageUrl)
        } else {
          setImgState('error')
        }
      })
      .catch(() => setImgState('error'))
  }, [expanded, item.code, item.name, imageMap, imgState])

  const handleCustomSave = () => {
    if (customUrl.trim()) {
      setImgUrl(customUrl.trim())
      setImgState('found')
      setCache(item.code, customUrl.trim())
    }
    setEditing(false)
    setCustomUrl('')
  }

  const handleRefresh = () => {
    clearCacheItem(item.code)
    setImgUrl(null)
    setImgState('idle')
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        marginBottom: 10,
        overflow: 'hidden',
        boxShadow: expanded
          ? '0 0 0 2px #e94560, 0 4px 16px rgba(0,0,0,0.12)'
          : '0 1px 4px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.15s',
      }}
    >
      {/* Main card - tap to expand */}
      <div
        onClick={() => setExpanded(p => !p)}
        style={{ padding: '12px 14px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: '#e94560',
            background: '#fff0f3', padding: '2px 8px', borderRadius: 6, letterSpacing: 0.5,
          }}>
            {item.code}
          </span>
          <span style={{
            fontSize: 11, color: '#666', background: '#f0f0f0',
            padding: '2px 8px', borderRadius: 6,
          }}>
            {item.unit || '—'}
          </span>
        </div>

        <div style={{
          fontSize: 14, fontWeight: 500, color: '#111', lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: expanded ? undefined : 2,
          WebkitBoxOrient: 'vertical',
          overflow: expanded ? 'visible' : 'hidden',
        }}>
          {item.name}
        </div>

        <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          <Stat label="სრული ფასი" value={`${fmt(item.totalPrice)} ₾`} accent />
          <Stat label="ერთ. ფასი" value={`${fmt(item.unitPrice)} ₾`} />
          <Stat label="რაოდენობა" value={item.quantity ? item.quantity.toString() : '—'} />
        </div>
      </div>

      {/* Expanded image section */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 14px' }}>

          {imgState === 'loading' && (
            <div style={{
              height: 160, background: '#f8f8f8', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#aaa', fontSize: 13,
            }}>
              <span style={{ animation: 'spin 1s linear infinite', marginRight: 8 }}>⟳</span>
              ეძებს Google-ზე...
            </div>
          )}

          {imgState === 'found' && imgUrl && !editing && (
            <div style={{ position: 'relative' }}>
              <img
                src={imgUrl}
                alt={item.name}
                onError={() => { setImgState('error'); clearCacheItem(item.code) }}
                style={{
                  width: '100%', maxHeight: 220, objectFit: 'contain',
                  borderRadius: 10, background: '#f8f8f8', display: 'block',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <ImgBtn onClick={() => setEditing(true)}>✏️ შეცვლა</ImgBtn>
                <ImgBtn onClick={handleRefresh}>🔄 ხელახლა ძიება</ImgBtn>
              </div>
            </div>
          )}

          {(imgState === 'error' || imgState === 'idle') && !editing && (
            <div style={{
              height: 100, background: '#f8f8f8', borderRadius: 10,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <span style={{ color: '#bbb', fontSize: 13 }}>ფოტო ვერ მოიძებნა</span>
              <ImgBtn onClick={() => setEditing(true)}>+ ბმული ჩასვი</ImgBtn>
            </div>
          )}

          {editing && (
            <div>
              <input
                ref={inputRef}
                type="url"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="ფოტოს ბმული (https://...)"
                onKeyDown={e => e.key === 'Enter' && handleCustomSave()}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  borderRadius: 8, border: '1.5px solid #e94560',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={handleCustomSave}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                    background: '#e94560', color: '#fff', fontSize: 14,
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  შენახვა
                </button>
                <button
                  onClick={() => { setEditing(false); setCustomUrl('') }}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                    background: '#f0f0f0', color: '#333', fontSize: 14, cursor: 'pointer',
                  }}
                >
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

function ImgBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        padding: '5px 12px', borderRadius: 8, border: '1px solid #e0e0e0',
        background: '#f8f8f8', fontSize: 12, cursor: 'pointer', color: '#444',
      }}
    >
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

export default function Home() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'code' | 'name'>('all')
  const [imageMap, setImageMap] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/imageMap.json').then(r => r.json()).then(setImageMap).catch(() => {})
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter(item => {
      if (filter === 'code') return item.code.toLowerCase().includes(q)
      if (filter === 'name') return item.name.toLowerCase().includes(q)
      return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
    })
  }, [query, filter])

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', minHeight: '100vh' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#1a1a2e', color: '#fff',
        padding: '12px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          ინვენტარი
          <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>
            {items.length} პოზიცია
          </span>
        </div>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="მოძებნე მასალა..."
          autoComplete="off"
          style={{
            width: '100%', padding: '10px 14px', fontSize: 16,
            borderRadius: 10, border: 'none', outline: 'none',
            boxSizing: 'border-box', background: '#fff', color: '#111',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {(['all', 'code', 'name'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              flex: 1, padding: '6px 0', fontSize: 13, borderRadius: 8,
              border: 'none', cursor: 'pointer', fontWeight: filter === f ? 700 : 400,
              background: filter === f ? '#e94560' : 'rgba(255,255,255,0.15)',
              color: '#fff',
            }}>
              {f === 'all' ? 'ყველა' : f === 'code' ? 'კოდი' : 'დასახელება'}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: '12px 12px 80px' }}>
        {query.trim() === '' ? (
          <div style={{ textAlign: 'center', color: '#999', marginTop: 60, fontSize: 15 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            ძიებისთვის ჩაწერე კოდი ან დასახელება
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', marginTop: 60, fontSize: 15 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
            ვერაფერი მოიძებნა
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 8, paddingLeft: 4 }}>
              {results.length} შედეგი
            </div>
            {results.map(item => (
              <ItemCard key={item.code} item={item} imageMap={imageMap} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
