'use client'

import { useState, useMemo, useCallback } from 'react'
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

export default function Home() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'code' | 'name'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter(item => {
      if (filter === 'code') return item.code.toLowerCase().includes(q)
      if (filter === 'name') return item.name.toLowerCase().includes(q)
      return (
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
      )
    })
  }, [query, filter])

  const toggle = useCallback((code: string) => {
    setExpanded(prev => prev === code ? null : code)
  }, [])

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#1a1a2e', color: '#fff',
        padding: '12px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          ინვენტარი
          <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>
            {items.length} პოზიცია
          </span>
        </div>

        {/* Search input */}
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="მოძებნე მასალა..."
          autoComplete="off"
          style={{
            width: '100%',
            padding: '10px 14px',
            fontSize: 16,
            borderRadius: 10,
            border: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            background: '#fff',
            color: '#111',
          }}
        />

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {(['all', 'code', 'name'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1, padding: '6px 0', fontSize: 13,
                borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: filter === f ? 700 : 400,
                background: filter === f ? '#e94560' : 'rgba(255,255,255,0.15)',
                color: '#fff',
                transition: 'background 0.15s',
              }}
            >
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
              <div
                key={item.code}
                onClick={() => toggle(item.code)}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  marginBottom: 8,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  boxShadow: expanded === item.code
                    ? '0 0 0 2px #e94560, 0 2px 8px rgba(0,0,0,0.1)'
                    : '0 1px 4px rgba(0,0,0,0.08)',
                  transition: 'box-shadow 0.15s',
                }}
              >
                {/* Code + unit badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: '#e94560',
                    background: '#fff0f3', padding: '2px 8px', borderRadius: 6,
                    letterSpacing: 0.5,
                  }}>
                    {item.code}
                  </span>
                  <span style={{
                    fontSize: 12, color: '#666',
                    background: '#f0f0f0', padding: '2px 8px', borderRadius: 6,
                  }}>
                    {item.unit || '—'}
                  </span>
                </div>

                {/* Name */}
                <div style={{
                  fontSize: 14, fontWeight: 500, color: '#111',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: expanded === item.code ? undefined : 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: expanded === item.code ? 'visible' : 'hidden',
                }}>
                  {item.name}
                </div>

                {/* Price row always visible */}
                <div style={{
                  display: 'flex', gap: 12, marginTop: 8,
                  flexWrap: 'wrap',
                }}>
                  <Stat label="სრული ფასი" value={`${fmt(item.totalPrice)} ₾`} accent />
                  <Stat label="ერთ. ფასი" value={`${fmt(item.unitPrice)} ₾`} />
                  <Stat label="რაოდენობა" value={item.quantity ? item.quantity.toString() : '—'} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#999', marginBottom: 1 }}>{label}</div>
      <div style={{
        fontSize: 14, fontWeight: 600,
        color: accent ? '#1a1a2e' : '#333',
      }}>
        {value}
      </div>
    </div>
  )
}
