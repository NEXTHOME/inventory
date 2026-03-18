'use client'

import { useState } from 'react'
import Link from 'next/link'

// Steel density kg/m³
const STEEL_DENSITY = 7850

// Standard rebar diameters (mm)
const REBAR_DIAMETERS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32]

// Weight per meter for rebar: d² / 162 (kg/m)
function rebarWeightPerMeter(d: number) {
  return (d * d) / 162
}

// Sheet weight: L(m) × W(m) × t(mm)/1000 × 7850
function sheetWeight(l: number, w: number, t: number) {
  return l * w * (t / 1000) * STEEL_DENSITY
}

function Result({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div style={{
      background: '#1a1a2e', borderRadius: 12, padding: '14px 18px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
        {value >= 1000
          ? `${(value / 1000).toLocaleString('ka-GE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ტ`
          : `${value.toLocaleString('ka-GE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit || 'კგ'}`}
      </span>
    </div>
  )
}

function NumInput({ label, value, onChange, placeholder, unit, min }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; unit?: string; min?: number
}) {
  return (
    <div>
      <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || '0'}
          min={min ?? 0}
          style={{
            flex: 1, padding: '10px 12px', fontSize: 16, borderRadius: unit ? '10px 0 0 10px' : 10,
            border: '1.5px solid #e0e0e0', borderRight: unit ? 'none' : undefined,
            outline: 'none', background: '#fff',
          }}
        />
        {unit && (
          <span style={{
            padding: '10px 12px', background: '#f0f0f0', border: '1.5px solid #e0e0e0',
            borderLeft: 'none', borderRadius: '0 10px 10px 0', fontSize: 13, color: '#666',
            whiteSpace: 'nowrap',
          }}>{unit}</span>
        )}
      </div>
    </div>
  )
}

// ─── Rebar Calculator ─────────────────────────────────────────────────────────

function RebarCalc() {
  const [diameter, setDiameter] = useState<number>(12)
  const [length, setLength] = useState('')
  const [qty, setQty] = useState('')

  const len = parseFloat(length) || 0
  const count = parseFloat(qty) || 1
  const wpm = rebarWeightPerMeter(diameter)
  const totalWeight = wpm * len * count

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Diameter selector */}
      <div>
        <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>
          დიამეტრი (მმ)
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {REBAR_DIAMETERS.map(d => (
            <button
              key={d}
              onClick={() => setDiameter(d)}
              style={{
                padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: diameter === d ? 700 : 400,
                background: diameter === d ? '#e94560' : '#f0f0f0',
                color: diameter === d ? '#fff' : '#333',
                minWidth: 48,
              }}
            >
              Ø{d}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <NumInput label="სიგრძე" value={length} onChange={setLength} placeholder="0.00" unit="მ" />
        <NumInput label="რაოდენობა (ღერი)" value={qty} onChange={setQty} placeholder="1" unit="ც" />
      </div>

      {/* Info row */}
      <div style={{
        background: '#f8f8f8', borderRadius: 10, padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between',
        fontSize: 13, color: '#666',
      }}>
        <span>Ø{diameter}მმ — 1 მეტრი:</span>
        <span style={{ fontWeight: 600, color: '#333' }}>{wpm.toFixed(3)} კგ/მ</span>
      </div>

      {len > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {count > 1 && <Result label={`1 ღერი × ${len} მ`} value={wpm * len} />}
          <Result label={`${count > 1 ? count + ' ღერი' : '1 ღერი'} × ${len} მ`} value={totalWeight} />
        </div>
      )}
    </div>
  )
}

// ─── Sheet Calculator ─────────────────────────────────────────────────────────

const SHEET_THICKNESSES = [0.5, 0.7, 0.8, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0]

function SheetCalc() {
  const [thickness, setThickness] = useState<number>(2.0)
  const [customT, setCustomT] = useState('')
  const [mode, setMode] = useState<'lw' | 'm2'>('lw')
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [m2, setM2] = useState('')
  const [qty, setQty] = useState('')

  const t = parseFloat(customT) || thickness
  const count = parseFloat(qty) || 1

  let area = 0
  if (mode === 'lw') {
    const l = parseFloat(length) || 0
    const w = parseFloat(width) || 0
    area = l * w
  } else {
    area = parseFloat(m2) || 0
  }

  const weightOne = sheetWeight(area >= 1 ? area : 0, 1, t)
  const totalWeight = sheetWeight(area, 1, t) * count
  // weight per m²
  const wpm2 = sheetWeight(1, 1, t)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Thickness selector */}
      <div>
        <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>
          სისქე (მმ)
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SHEET_THICKNESSES.map(th => (
            <button
              key={th}
              onClick={() => { setThickness(th); setCustomT('') }}
              style={{
                padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: (thickness === th && !customT) ? 700 : 400,
                background: (thickness === th && !customT) ? '#e94560' : '#f0f0f0',
                color: (thickness === th && !customT) ? '#fff' : '#333',
              }}
            >
              {th}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <NumInput label="ან შეიყვანე სხვა სისქე" value={customT} onChange={setCustomT} placeholder="მაგ. 12" unit="მმ" />
        </div>
      </div>

      {/* Mode toggle */}
      <div>
        <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>გამოთვლის მეთოდი</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: 'lw', label: 'სიგრძე × სიგანე' }, { v: 'm2', label: 'კვ.მ' }].map(opt => (
            <button
              key={opt.v}
              onClick={() => setMode(opt.v as 'lw' | 'm2')}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: mode === opt.v ? 700 : 400,
                background: mode === opt.v ? '#1a1a2e' : '#f0f0f0',
                color: mode === opt.v ? '#fff' : '#333',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      {mode === 'lw' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <NumInput label="სიგრძე" value={length} onChange={setLength} placeholder="0.00" unit="მ" />
          <NumInput label="სიგანე" value={width} onChange={setWidth} placeholder="0.00" unit="მ" />
        </div>
      ) : (
        <NumInput label="ფართობი" value={m2} onChange={setM2} placeholder="0.00" unit="მ²" />
      )}

      <NumInput label="რაოდენობა (ლისტი)" value={qty} onChange={setQty} placeholder="1" unit="ც" />

      {/* Info */}
      <div style={{
        background: '#f8f8f8', borderRadius: 10, padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between',
        fontSize: 13, color: '#666',
      }}>
        <span>{t}მმ — 1 მ²:</span>
        <span style={{ fontWeight: 600, color: '#333' }}>{wpm2.toFixed(2)} კგ/მ²</span>
      </div>

      {area > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mode === 'lw' && (
            <div style={{ background: '#f0f0f0', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#555' }}>
              ფართობი: {area.toFixed(2)} მ²
            </div>
          )}
          {count > 1 && <Result label="1 ლისტი" value={sheetWeight(area, 1, t)} />}
          <Result label={count > 1 ? `${count} ლისტი სულ` : 'წონა'} value={totalWeight} />
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Calculator() {
  const [tab, setTab] = useState<'rebar' | 'sheet'>('rebar')

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', minHeight: '100vh', background: '#f5f5f5' }}>
      <style>{`* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }`}</style>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#1a1a2e', color: '#fff',
        padding: '12px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Link href="/" style={{
            color: '#fff', textDecoration: 'none', fontSize: 22, lineHeight: 1,
            opacity: 0.8,
          }}>←</Link>
          <span style={{ fontSize: 18, fontWeight: 700 }}>კალკულატორი</span>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { v: 'rebar', label: '🔩 არმატურა' },
            { v: 'sheet', label: '📦 ლითონის ლისტი' },
          ] as const).map(t => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: tab === t.v ? 700 : 400,
                background: tab === t.v ? '#e94560' : 'rgba(255,255,255,0.15)',
                color: '#fff',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 16 }}>
        {tab === 'rebar' ? <RebarCalc /> : <SheetCalc />}
      </div>
    </div>
  )
}
