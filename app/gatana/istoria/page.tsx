'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import warehouseData from '../../../public/data.json'
import meoradiData from '../../../public/meoradi.json'
import ziritadiData from '../../../public/ziritadi.json'

type RawItem = { code: string; name: string; unit: string; quantity: number }
const allItemsFlat: RawItem[] = [
  ...(warehouseData as RawItem[]).map(i => ({ ...i, _cat: 'warehouse' })),
  ...(meoradiData as RawItem[]).map(i => ({ ...i, _cat: 'meoradi' })),
  ...(ziritadiData as RawItem[]).map(i => ({ ...i, _cat: 'ziritadi' })),
]
const itemByCode: Record<string, RawItem & { _cat: string }> = {}
allItemsFlat.forEach(i => { itemByCode[i.code] = i as RawItem & { _cat: string } })

function getLastPart(code: string) { return code.trim().split(' ').pop() || code }

function parsePhotos(photo?: string): string[] {
  if (!photo) return []
  try { const p = JSON.parse(photo); if (Array.isArray(p)) return p } catch { /* not json */ }
  return [photo]
}

type DispatchItem = {
  item_code: string
  item_name: string
  quantity: number
  unit: string
  category: string
  note?: string
}

type Dispatch = {
  id: number
  object_name: string
  vehicle: string
  photo?: string
  created_at: string
  items: DispatchItem[]
  dispatch_note?: string
  is_test?: boolean
}

const CAT_LABELS: Record<string, string> = { warehouse: '🏭', meoradi: '♻️', ziritadi: '🔧' }

function fmtDate(s: string) {
  return new Date(s).toLocaleString('ka-GE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 1200 / img.width)
        canvas.width = img.width * scale; canvas.height = img.height * scale
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject; reader.readAsDataURL(file)
  })
}

// ─── Edit Drawer ──────────────────────────────────────────────────────────────
function EditDrawer({ dispatch, onSave, onClose }: {
  dispatch: Dispatch
  onSave: (updated: Dispatch) => void
  onClose: () => void
}) {
  const [objectName, setObjectName] = useState(dispatch.object_name)
  const [vehicle, setVehicle] = useState(dispatch.vehicle)
  const [photos, setPhotos] = useState<string[]>(parsePhotos(dispatch.photo))
  const [dispatchNote, setDispatchNote] = useState(dispatch.dispatch_note || '')
  const [isTest, setIsTest] = useState(dispatch.is_test || false)
  const [items, setItems] = useState<DispatchItem[]>(dispatch.items.map(i => ({ ...i })))
  const [saving, setSaving] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [replacingIdx, setReplacingIdx] = useState<number | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const searchResults = useMemo(() => {
    if (!itemSearch.trim()) return []
    const q = itemSearch.toLowerCase()
    return allItemsFlat.filter(i =>
      i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
    ).slice(0, 15)
  }, [itemSearch])

  const updateItem = (idx: number, patch: Partial<DispatchItem>) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const replaceItem = (idx: number, raw: RawItem & { _cat: string }) => {
    updateItem(idx, { item_code: raw.code, item_name: raw.name, unit: raw.unit, category: raw._cat })
    setReplacingIdx(null)
    setItemSearch('')
  }

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    try {
      const compressed = await Promise.all(files.map(f => compressImage(f)))
      setPhotos(prev => [...prev, ...compressed])
    } catch { /* ignore */ }
    e.target.value = ''
  }

  const handleSave = async () => {
    if (!objectName.trim() || !vehicle.trim() || !items.length) return
    setSaving(true)
    try {
      const res = await fetch(`/api/dispatch/${dispatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectName: objectName.trim(), vehicle: vehicle.trim(), items, photos, dispatch_note: dispatchNote || null, is_test: isTest }),
      })
      if (res.ok) {
        const photoStr = photos.length ? JSON.stringify(photos) : undefined
        onSave({ ...dispatch, object_name: objectName.trim(), vehicle: vehicle.trim(), photo: photoStr, items, dispatch_note: dispatchNote || undefined, is_test: isTest })
      }
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, margin: '0 auto', maxHeight: '92vh', overflow: 'auto', padding: '22px 16px 30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>✏️ გატანა #{dispatch.id} რედაქტირება</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        {/* Header fields */}
        <label style={lblSt}>ობიექტი</label>
        <input value={objectName} onChange={e => setObjectName(e.target.value)} style={inpSt} />
        <label style={lblSt}>მანქანა / მძღოლი</label>
        <input value={vehicle} onChange={e => setVehicle(e.target.value)} style={inpSt} />

        {/* Photo */}
        <label style={lblSt}>ფოტოები</label>
        <div style={{ marginBottom: 14 }}>
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                  <button type="button" onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 20, width: 22, height: 22, cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => photoRef.current?.click()} style={{ width: '100%', padding: '10px', background: '#f8f8f8', border: '2px dashed #ddd', borderRadius: 10, fontSize: 13, color: '#888', cursor: 'pointer' }}>
            📷 {photos.length > 0 ? `+ კიდევ ფოტო (${photos.length})` : 'ფოტო'}
          </button>
          <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple onChange={handlePhoto} style={{ display: 'none' }} />
        </div>

        {/* Note + Test flag */}
        <label style={lblSt}>შენიშვნა (სურვილისამებრ)</label>
        <input value={dispatchNote} onChange={e => setDispatchNote(e.target.value)}
          placeholder="მაგ: სატესტო, შეცდომით..." style={inpSt} />
        <div onClick={() => setIsTest(p => !p)} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12,
          background: isTest ? '#fff8e1' : '#f8f8f8', border: `2px solid ${isTest ? '#f59e0b' : '#e0e0e0'}`,
          cursor: 'pointer', marginBottom: 14,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, border: `2px solid ${isTest ? '#f59e0b' : '#ccc'}`,
            background: isTest ? '#f59e0b' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {isTest && <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>✓</span>}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: isTest ? '#92400e' : '#333' }}>🧪 სატესტო გატანა</div>
            <div style={{ fontSize: 11, color: '#888' }}>ჩანაწერი გადახაზული ფერით გამოჩნდება</div>
          </div>
        </div>

        {/* Items */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 10 }}>მასალები</div>
        {items.map((it, idx) => (
          <div key={idx} style={{ background: '#f8f8f8', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
            {/* Replace search */}
            {replacingIdx === idx ? (
              <div>
                <input autoFocus value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                  placeholder="ახალი მასალის ძებნა..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #4f46e5', outline: 'none', fontSize: 13, marginBottom: 6 }} />
                {searchResults.map(r => (
                  <div key={r.code} onClick={() => replaceItem(idx, r as RawItem & { _cat: string })}
                    style={{ padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, background: '#fff', marginBottom: 4, border: '1px solid #eee' }}>
                    <span style={{ color: '#e94560', fontWeight: 600, marginRight: 6 }}>{getLastPart(r.code)}</span>
                    {r.name}
                  </div>
                ))}
                <button onClick={() => { setReplacingIdx(null); setItemSearch('') }}
                  style={{ marginTop: 6, background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                  გაუქმება
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <span style={{ fontSize: 11, color: '#e94560', fontWeight: 600, marginRight: 4 }}>{CAT_LABELS[it.category]} {getLastPart(it.item_code)}</span>
                    <span style={{ fontSize: 13, color: '#222' }}>{it.item_name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setReplacingIdx(idx)} style={{ background: '#ede9fe', border: 'none', borderRadius: 7, padding: '4px 9px', fontSize: 11, fontWeight: 600, color: '#4f46e5', cursor: 'pointer' }}>
                      ↔ შეცვლა
                    </button>
                    <button onClick={() => removeItem(idx)} style={{ background: '#fff0f3', border: 'none', borderRadius: 7, padding: '4px 9px', fontSize: 11, color: '#e94560', cursor: 'pointer' }}>
                      🗑
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" value={it.quantity} min={0.1} step={0.1}
                    onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                    style={{ width: 80, padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, fontWeight: 700, outline: 'none' }} />
                  <span style={{ fontSize: 13, color: '#888' }}>{it.unit}</span>
                  <input value={it.note || ''} onChange={e => updateItem(idx, { note: e.target.value })}
                    placeholder="შენიშვნა..."
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 12, outline: 'none' }} />
                </div>
              </>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px', background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}>გაუქმება</button>
          <button onClick={handleSave} disabled={saving || !objectName.trim() || !vehicle.trim() || !items.length}
            style={{ flex: 2, padding: '13px', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', background: saving ? '#ccc' : '#1a1a2e', color: '#fff' }}>
            {saving ? 'ინახება...' : '✓ შენახვა'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main History Page ────────────────────────────────────────────────────────
export default function IstoriaPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [photoModal, setPhotoModal] = useState<string[] | null>(null)
  const [photoModalIdx, setPhotoModalIdx] = useState(0)
  const [editDispatch, setEditDispatch] = useState<Dispatch | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Dispatch | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minQty, setMinQty] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchData = (from?: string, to?: string) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    fetch(`/api/dispatch-history?${p}`)
      .then(r => r.json())
      .then(data => { setDispatches(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const resetFilters = () => { setDateFrom(''); setDateTo(''); setMinQty(''); setSearch(''); fetchData() }

  const filtered = useMemo(() => {
    let list = dispatches
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        d.object_name.toLowerCase().includes(q) ||
        d.vehicle.toLowerCase().includes(q) ||
        d.items.some(i => i.item_name.toLowerCase().includes(q) || i.item_code.includes(q) || (i.note || '').toLowerCase().includes(q))
      )
    }
    if (minQty) {
      const min = parseFloat(minQty)
      list = list.filter(d => d.items.reduce((s, i) => s + Number(i.quantity), 0) >= min)
    }
    return list
  }, [dispatches, search, minQty])

  const totalItems = filtered.reduce((s, d) => s + d.items.reduce((ss, i) => ss + Number(i.quantity), 0), 0)
  const hasFilters = !!(search || dateFrom || dateTo || minQty)

  const handleSaveEdit = (updated: Dispatch) => {
    setDispatches(prev => prev.map(d => d.id === updated.id ? updated : d))
    setEditDispatch(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !deletePassword) return
    setDeleting(true); setDeleteError('')
    const res = await fetch(`/api/dispatch/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: deletePassword }),
    })
    setDeleting(false)
    if (res.ok) {
      setDispatches(prev => prev.filter(d => d.id !== deleteTarget.id))
      setDeleteTarget(null); setDeletePassword('')
    } else {
      const d = await res.json()
      setDeleteError(d.error === 'wrong_password' ? 'პაროლი არასწორია' : 'შეცდომა')
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', minHeight: '100vh', background: '#f5f5f7' }}>
      <style>{`* { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }`}</style>

      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1a1a2e', color: '#fff', padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/gatana" style={{ color: '#fff', textDecoration: 'none', fontSize: 20 }}>←</Link>
            <span style={{ fontSize: 17, fontWeight: 700 }}>📋 გატანის ისტორია</span>
          </div>
          <button onClick={() => setShowFilters(p => !p)} style={{ background: hasFilters ? '#e94560' : 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🔍 ფილტრი {hasFilters ? '●' : ''}
          </button>
        </div>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ობიექტი, მანქანა, მასალა, შენიშვნა..."
          style={{ width: '100%', padding: '10px 14px', fontSize: 15, borderRadius: 10, border: 'none', outline: 'none' }} />

        {showFilters && (
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px', marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>თარიღიდან</div>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>თარიღამდე</div>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', fontSize: 13, outline: 'none' }} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>მინ. საერთო რაოდ.</div>
              <input type="number" value={minQty} onChange={e => setMinQty(e.target.value)} placeholder="მაგ: 10"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => fetchData(dateFrom || undefined, dateTo || undefined)} style={{ flex: 2, padding: '9px', background: '#e94560', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>გამოყენება</button>
              <button onClick={resetFilters} style={{ flex: 1, padding: '9px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>გასუფთავება</button>
            </div>
          </div>
        )}
      </div>

      {!loading && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', fontSize: 13, color: '#666' }}>
          <span>{filtered.length} გატანა</span>
          <span>სულ: <strong>{totalItems}</strong> ერთ.</span>
        </div>
      )}

      <div style={{ padding: '0 12px 40px' }}>
        {loading && <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>იტვირთება...</div>}
        {!loading && filtered.length === 0 && <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>ჩანაწერები არ არის</div>}

        {filtered.map(d => {
          const totalQty = d.items.reduce((s, i) => s + Number(i.quantity), 0)
          const isOpen = expanded === d.id
          const isTest = !!d.is_test
          const textStyle = isTest ? { textDecoration: 'line-through', opacity: 0.6 } : {}
          return (
            <div key={d.id} style={{ background: isTest ? '#fafafa' : '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: isTest ? '1px dashed #ddd' : 'none' }}>
              <div onClick={() => setExpanded(isOpen ? null : d.id)} style={{ padding: '13px 14px', cursor: 'pointer' }}>
                {isTest && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: '#fff8e1', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, marginBottom: 6 }}>
                    🧪 სატესტო გატანა
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 2, ...textStyle }}>📍 {d.object_name}</div>
                    <div style={{ fontSize: 13, color: '#666', ...textStyle }}>🚗 {d.vehicle}</div>
                    {d.dispatch_note && <div style={{ fontSize: 12, color: '#888', marginTop: 3, fontStyle: 'italic' }}>📝 {d.dispatch_note}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: '#999' }}>{fmtDate(d.created_at)}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                      <span style={{ color: '#e94560' }}>#{d.id}</span>
                      <span style={{ color: isTest ? '#aaa' : '#22a06b', marginLeft: 6, ...textStyle }}>{totalQty} ერთ.</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, color: '#888', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...textStyle }}>
                    {d.items.slice(0, 2).map(i => i.item_name).join(', ')}{d.items.length > 2 ? ` +${d.items.length - 2}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexShrink: 0 }}>
                    <button type="button" onClick={e => { e.stopPropagation(); setEditDispatch(d) }} style={{ background: '#f0f4ff', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 12, cursor: 'pointer', color: '#4f46e5', fontWeight: 600 }}>
                      ✏️ რედ.
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); setDeleteTarget(d); setDeletePassword(''); setDeleteError('') }} style={{ background: '#fff0f3', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 12, cursor: 'pointer', color: '#e94560', fontWeight: 600 }}>
                      🗑
                    </button>
                    {d.photo && (() => {
                      const ps = parsePhotos(d.photo)
                      return ps.length > 0 ? (
                        <button type="button" onClick={e => { e.stopPropagation(); setPhotoModal(ps); setPhotoModalIdx(0) }} style={{ background: '#f0f4ff', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: 'pointer', color: '#4f46e5', fontWeight: 600 }}>
                          📷{ps.length > 1 ? ` ${ps.length}` : ''}
                        </button>
                      ) : null
                    })()}
                    <span style={{ fontSize: 12, color: '#bbb', padding: '3px 0' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: '1px solid #f0f0f0' }}>
                  {d.photo && (() => {
                    const ps = parsePhotos(d.photo)
                    return ps.length > 0 ? (
                      <div style={{ padding: '10px 14px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {ps.map((p, pi) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={pi} src={p} alt="" onClick={() => { setPhotoModal(ps); setPhotoModalIdx(pi) }}
                            style={{ width: ps.length === 1 ? '100%' : 80, height: ps.length === 1 ? undefined : 80, maxHeight: ps.length === 1 ? 200 : undefined, objectFit: 'cover', borderRadius: 10, cursor: 'pointer' }} />
                        ))}
                      </div>
                    ) : null
                  })()}
                  <div style={{ padding: '10px 14px' }}>
                    {d.items.map((it, idx) => (
                      <div key={idx} style={{ paddingBottom: 8, marginBottom: 8, borderBottom: idx < d.items.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                            <span style={{ fontSize: 11, color: '#e94560', fontWeight: 600, marginRight: 4 }}>
                              {CAT_LABELS[it.category] || ''} {it.item_code.split(' ').pop()}
                            </span>
                            <span style={{ fontSize: 13, color: '#333' }}>{it.item_name}</span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', flexShrink: 0 }}>{it.quantity} {it.unit}</span>
                        </div>
                        {it.note && <div style={{ fontSize: 12, color: '#4f46e5', marginTop: 3, paddingLeft: 2 }}>📝 {it.note}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {photoModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setPhotoModal(null)} style={{ position: 'absolute', inset: 0 }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoModal[photoModalIdx]} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 10, objectFit: 'contain', position: 'relative', zIndex: 1 }} />
          <button type="button" onClick={() => setPhotoModal(null)} style={{ position: 'fixed', top: 16, right: 16, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 20, width: 36, height: 36, fontSize: 18, cursor: 'pointer', zIndex: 2 }}>✕</button>
          {photoModal.length > 1 && (
            <>
              <button type="button" onClick={e => { e.stopPropagation(); setPhotoModalIdx(i => (i - 1 + photoModal.length) % photoModal.length) }}
                style={{ position: 'fixed', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 20, width: 40, height: 40, fontSize: 20, cursor: 'pointer', zIndex: 2 }}>‹</button>
              <button type="button" onClick={e => { e.stopPropagation(); setPhotoModalIdx(i => (i + 1) % photoModal.length) }}
                style={{ position: 'fixed', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 20, width: 40, height: 40, fontSize: 20, cursor: 'pointer', zIndex: 2 }}>›</button>
              <div style={{ position: 'fixed', bottom: 20, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13, zIndex: 2 }}>
                {photoModalIdx + 1} / {photoModal.length}
              </div>
            </>
          )}
        </div>
      )}

      {editDispatch && (
        <EditDrawer dispatch={editDispatch} onSave={handleSaveEdit} onClose={() => setEditDispatch(null)} />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={() => { setDeleteTarget(null); setDeletePassword('') }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: '28px 22px', width: '100%', maxWidth: 360, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 10 }}>🗑</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', textAlign: 'center', marginBottom: 6 }}>
              გატანა #{deleteTarget.id} წაიშლება
            </div>
            <div style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 4 }}>
              📍 {deleteTarget.object_name}
            </div>
            <div style={{ fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              წაშლისას რაოდენობები ავტომატურად დაუბრუნდება ინვენტარს
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }}>პაროლი დასადასტურებლად</div>
            <input
              type="password"
              value={deletePassword}
              onChange={e => { setDeletePassword(e.target.value); setDeleteError('') }}
              onKeyDown={e => e.key === 'Enter' && handleDeleteConfirm()}
              placeholder="შეიყვანე პაროლი"
              autoFocus
              style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 12, border: `1.5px solid ${deleteError ? '#e94560' : '#e0e0e0'}`, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
            />
            {deleteError && (
              <div style={{ color: '#e94560', fontSize: 13, marginBottom: 10 }}>{deleteError}</div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => { setDeleteTarget(null); setDeletePassword('') }}
                style={{ flex: 1, padding: '13px', background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}>
                გაუქმება
              </button>
              <button type="button" onClick={handleDeleteConfirm} disabled={deleting || !deletePassword}
                style={{ flex: 1, padding: '13px', background: deleting || !deletePassword ? '#f5a5b3' : '#e94560', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: deleting || !deletePassword ? 'default' : 'pointer' }}>
                {deleting ? 'იშლება...' : '🗑 წაშლა'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lblSt: React.CSSProperties = { display: 'block', fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 6 }
const inpSt: React.CSSProperties = { width: '100%', padding: '11px 14px', fontSize: 15, borderRadius: 10, border: '1.5px solid #e0e0e0', outline: 'none', marginBottom: 14, boxSizing: 'border-box' }
