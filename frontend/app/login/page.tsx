'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    // If already logged in, redirect
    const token = localStorage.getItem('archon-token')
    if (token) window.location.href = '/dashboard'
  }, [])

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter email and password'); return }
    setLoading(true); setError('')
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password })
      localStorage.setItem('archon-token', res.data.token)
      localStorage.setItem('archon-user', JSON.stringify(res.data.user))
      window.location.href = '/dashboard'
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Login failed')
    }
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '12px 16px',
    fontSize: '14px', color: 'var(--text)', outline: 'none',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-main)', position: 'relative', overflow: 'hidden',
    }}>
      {/* BG glow */}
      <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '380px', padding: '0 16px' }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px', fontWeight: 800, color: 'white' }}>A</div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Archon</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>by Armila Design</p>
        </div>

        {/* CARD */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '28px 24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 24px', textAlign: 'center' }}>Sign in to your account</h2>

          {error && (
            <div style={{ background: 'rgba(228,114,111,0.1)', border: '1px solid rgba(228,114,111,0.25)', color: 'var(--error)', fontSize: '13px', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Email</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="you@armiladesign.com"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Password</label>
                <a href="/forgot-password" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>Forgot password?</a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
                <button onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px', display: 'flex' }}>
                  {showPass ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
            </div>

            <button onClick={handleLogin} disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, color: 'white', background: loading ? 'var(--accent-dim)' : 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px', transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading ? (
                <><Loader2 size={16} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</>
              ) : 'Sign In →'}
            </button>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: '0 0 10px' }}>Don&apos;t have an account yet?</p>
            <a href="/signup"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', boxSizing: 'border-box', padding: '11px', borderRadius: 'var(--radius-md)', fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', background: 'transparent', border: '1px solid var(--border)', textDecoration: 'none' }}>
              Create an account
            </a>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-dim)', marginTop: '24px', opacity: 0.7 }}>
          Archon CRM · Armila Design Studio
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
