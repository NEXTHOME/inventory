'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfilePage() {
  const router = useRouter()
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess(false)
    if (newPw !== newPw2) { setError('ახალი პაროლები არ ემთხვევა'); return }
    if (newPw.length < 4) { setError('მინ. 4 სიმბოლო'); return }
    setLoading(true)
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    })
    setLoading(false)
    if (res.ok) {
      setSuccess(true)
      setCurPw(''); setNewPw(''); setNewPw2('')
    } else {
      const d = await res.json()
      setError(d.error === 'wrong_password' ? 'მიმდინარე პაროლი არასწორია' : 'შეცდომა')
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/login'
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', minHeight: '100vh', background: '#f5f5f7' }}>
      <style>{`* { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }`}</style>

      <div style={{ background: '#1a1a2e', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <span style={{ fontSize: 17, fontWeight: 700 }}>👤 პროფილი</span>
      </div>

      <div style={{ padding: 16 }}>
        {/* User info */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', flexShrink: 0 }}>
            N
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>NEXT</div>
            <div style={{ fontSize: 13, color: '#888' }}>ადმინისტრატორი</div>
          </div>
        </div>

        {/* Change password */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 18px', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 16 }}>🔑 პაროლის შეცვლა</div>
          {success && (
            <div style={{ background: '#d4edda', border: '1px solid #28a745', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#155724', marginBottom: 14 }}>
              ✅ პაროლი წარმატებით შეიცვალა
            </div>
          )}
          <form onSubmit={handleChange}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>მიმდინარე პაროლი</div>
              <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 10, border: '1.5px solid #e0e0e0', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>ახალი პაროლი</div>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 10, border: '1.5px solid #e0e0e0', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>ახალი პაროლი (გამეორება)</div>
              <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 10, border: `1.5px solid ${error ? '#e94560' : '#e0e0e0'}`, outline: 'none' }} />
            </div>
            {error && <div style={{ color: '#e94560', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button type="submit" disabled={loading || !curPw || !newPw || !newPw2}
              style={{ width: '100%', padding: '13px', background: loading || !curPw || !newPw || !newPw2 ? '#ccc' : '#1a1a2e', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? 'ინახება...' : 'შეცვლა'}
            </button>
          </form>
        </div>

        {/* Logout */}
        <button type="button" onClick={handleLogout}
          style={{ width: '100%', padding: '14px', background: '#fff', color: '#e94560', border: '2px solid #e94560', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          🚪 სისტემიდან გასვლა
        </button>
      </div>
    </div>
  )
}
