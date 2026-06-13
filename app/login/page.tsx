'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const PIN_KEY = 'inv_pin'
const BIO_KEY = 'inv_bio_enabled'
const CRED_KEY = 'inv_cred_id'

const getStoredPin = (): string | null => { try { return localStorage.getItem(PIN_KEY) } catch { return null } }
const savePin = (pin: string) => { try { localStorage.setItem(PIN_KEY, pin) } catch { /* ignore */ } }
const isBioEnabled = (): boolean => { try { return localStorage.getItem(BIO_KEY) === '1' } catch { return false } }
const setBioEnabled = (v: boolean) => { try { localStorage.setItem(BIO_KEY, v ? '1' : '0') } catch { /* ignore */ } }

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false
  return window.isSecureContext || window.location.hostname === 'localhost'
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

async function registerBiometric(): Promise<boolean> {
  if (!isSecureContext()) return false
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Inventory', id: window.location.hostname },
        user: { id: new Uint8Array(16), name: 'user', displayName: 'User' },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null
    if (cred) {
      const raw = Array.from(new Uint8Array(cred.rawId))
      localStorage.setItem(CRED_KEY, btoa(String.fromCharCode(...raw)))
      return true
    }
    return false
  } catch { return false }
}

async function verifyBiometric(): Promise<boolean> {
  if (!isSecureContext()) return false
  try {
    const b64 = localStorage.getItem(CRED_KEY)
    const credId = b64 ? Uint8Array.from(atob(b64), c => c.charCodeAt(0)) : undefined
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        userVerification: 'required',
        timeout: 60000,
        allowCredentials: credId ? [{ id: credId, type: 'public-key' }] : [],
      },
    })
    return !!cred
  } catch { return false }
}

async function issueJWT(pin: string): Promise<boolean> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: `__pin__${pin}` }),
  })
  return res.ok
}

type Screen = 'password' | 'pin' | 'set-pin' | 'set-bio'

const numBtnSt: React.CSSProperties = {
  width: 72, height: 72, fontSize: 22, fontWeight: 600,
  background: '#f8f8f8', border: 'none', borderRadius: '50%',
  cursor: 'pointer', color: '#1a1a2e',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function PinDots({ value }: { value: string }) {
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', margin: '24px 0' }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: i < value.length ? '#1a1a2e' : '#e0e0e0', transition: 'background 0.15s' }} />
      ))}
    </div>
  )
}

function NumPad({ onDigit, onDelete }: { onDigit: (d: string) => void; onDelete: () => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12, margin: '0 auto', width: 'fit-content' }}>
      {['1','2','3','4','5','6','7','8','9'].map(d => (
        <button key={d} onClick={() => onDigit(d)} style={numBtnSt}>{d}</button>
      ))}
      <div />
      <button onClick={() => onDigit('0')} style={numBtnSt}>0</button>
      <button onClick={onDelete} style={{ ...numBtnSt, background: '#f0f0f0', color: '#666', fontSize: 20 }}>⌫</button>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('password')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [setPinStep, setSetPinStep] = useState<1 | 2>(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [secure, setSecure] = useState(true)

  useEffect(() => {
    setSecure(isSecureContext())

    fetch('/api/auth').then(r => r.json()).then(d => {
      if (d.auth) router.replace('/')
    }).catch(() => {})

    if (typeof window !== 'undefined' && window.PublicKeyCredential && isSecureContext()) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(ok => setBioAvailable(ok)).catch(() => {})
    }

    const storedPin = getStoredPin()
    const bioOn = isBioEnabled()
    if (isMobile()) {
      if (storedPin && bioOn && isSecureContext()) {
        handleBioAttempt(storedPin)
      } else if (storedPin) {
        setScreen('pin')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBioAttempt = async (pinFallback: string) => {
    setLoading(true)
    const ok = await verifyBiometric()
    setLoading(false)
    if (ok) {
      const success = await issueJWT(pinFallback)
      if (success) { router.replace('/'); return }
    }
    setScreen('pin')
  }

  // ── Password ─────────────────────────────────────────────────────────────
  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    if (username.toUpperCase() !== 'NEXT') { setError('იუზერი არასწორია'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      if (getStoredPin() || !isMobile()) { router.replace('/') }
      else { setScreen('set-pin'); setSetPinStep(1); setPin(''); setFirstPin('') }
    } else {
      setError('პაროლი არასწორია')
    }
  }

  // ── PIN entry ─────────────────────────────────────────────────────────────
  const handlePinDigit = async (d: string) => {
    const next = pin + d
    setPin(next)
    if (next.length === 4) {
      const stored = getStoredPin()
      if (stored === next) {
        setLoading(true)
        const ok = await issueJWT(next)
        setLoading(false)
        if (ok) router.replace('/')
        else { setError('შეცდომა, სცადე თავიდან'); setPin('') }
      } else {
        setError('PIN არასწორია')
        setTimeout(() => { setPin(''); setError('') }, 800)
      }
    }
  }

  // ── Set PIN ───────────────────────────────────────────────────────────────
  const handleSetPinDigit = (d: string) => {
    const next = pin + d
    setPin(next)
    if (next.length < 4) return

    if (setPinStep === 1) {
      setFirstPin(next); setPin(''); setSetPinStep(2)
    } else {
      if (next === firstPin) {
        savePin(next)
        setPin('')
        if (bioAvailable && secure && isMobile()) { setScreen('set-bio') }
        else { router.replace('/') }
      } else {
        setError('PIN არ ემთხვევა')
        setTimeout(() => { setPin(''); setFirstPin(''); setSetPinStep(1); setError('') }, 1000)
      }
    }
  }


  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }`}</style>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: '36px 28px', boxShadow: '0 4px 32px rgba(0,0,0,0.1)' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e' }}>ინვენტარი</div>
        </div>

        {/* PASSWORD */}
        {screen === 'password' && (
          <form onSubmit={handlePassword}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 16, textAlign: 'center' }}>შესვლა</div>
            {!secure && (
              <div style={{ background: '#fff8e1', border: '1px solid #ffc107', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#856404', marginBottom: 12, lineHeight: 1.5 }}>
                ⚠️ HTTP კავშირი — ანაბეჭდი მოითხოვს HTTPS-ს. PIN კოდი მუშაობს.
              </div>
            )}
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="იუზერი" autoFocus autoCapitalize="off" autoCorrect="off"
              style={{ width: '100%', padding: '13px 16px', fontSize: 16, borderRadius: 12, border: '1.5px solid #e0e0e0', outline: 'none', marginBottom: 10 }} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="პაროლი"
              style={{ width: '100%', padding: '13px 16px', fontSize: 16, borderRadius: 12, border: '1.5px solid #e0e0e0', outline: 'none', marginBottom: 12 }} />
            {error && <div style={{ color: '#e94560', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{error}</div>}
            <button type="submit" disabled={loading || !username || !password} style={{
              width: '100%', padding: '14px', background: loading || !username || !password ? '#ccc' : '#1a1a2e',
              color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: loading || !username || !password ? 'default' : 'pointer',
            }}>{loading ? 'მოწმდება...' : 'შესვლა'}</button>
          </form>
        )}

        {/* PIN */}
        {screen === 'pin' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 4 }}>PIN კოდი</div>
            {loading && <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>მოწმდება...</div>}
            {isBioEnabled() && bioAvailable && secure && !loading && (
              <button onClick={() => handleBioAttempt(getStoredPin() || '')}
                style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 13, cursor: 'pointer', marginBottom: 4 }}>
                👆 ანაბეჭდი / Face ID
              </button>
            )}
            {isBioEnabled() && !secure && (
              <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>ანაბეჭდი: HTTPS საჭიროა</div>
            )}
            <PinDots value={pin} />
            {error && <div style={{ color: '#e94560', fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <NumPad onDigit={handlePinDigit} onDelete={() => setPin(p => p.slice(0, -1))} />
            <button onClick={() => { setScreen('password'); setPin(''); setError('') }}
              style={{ marginTop: 20, background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer' }}>
              პაროლით შესვლა
            </button>
          </div>
        )}

        {/* SET PIN */}
        {screen === 'set-pin' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 4 }}>
              {setPinStep === 1 ? '🔐 PIN კოდის დაყენება' : '🔁 გაიმეორე PIN'}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>
              {setPinStep === 1 ? 'შეიყვანე 4-ნიშნა PIN კოდი' : 'კიდევ ერთხელ შეიყვანე'}
            </div>
            <PinDots value={pin} />
            {error && <div style={{ color: '#e94560', fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <NumPad onDigit={handleSetPinDigit} onDelete={() => setPin(p => p.slice(0, -1))} />
            <button onClick={() => router.replace('/')}
              style={{ marginTop: 20, background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer' }}>
              გამოტოვება
            </button>
          </div>
        )}

        {/* SET BIOMETRIC */}
        {screen === 'set-bio' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👆</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>ბიომეტრიული შესვლა</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 24, lineHeight: 1.5 }}>
              შემდეგ სისტემაში შესვლისას გამოიყენე ანაბეჭდი ან Face ID
            </div>
            <button onClick={async () => { const ok = await registerBiometric(); if (ok) setBioEnabled(true); router.replace('/') }}
              style={{ width: '100%', padding: '14px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
              👆 ჩართვა
            </button>
            <button onClick={() => router.replace('/')}
              style={{ width: '100%', padding: '14px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 12, fontSize: 15, cursor: 'pointer' }}>
              გამოტოვება
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
