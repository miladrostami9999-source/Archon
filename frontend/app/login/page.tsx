'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'

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
    if (token) window.location.href = '/'
  }, [])

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter email and password'); return }
    setLoading(true); setError('')
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password })
      localStorage.setItem('archon-token', res.data.token)
      localStorage.setItem('archon-user', JSON.stringify(res.data.user))
      window.location.href = '/'
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Login failed')
    }
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', padding: '12px 16px',
    fontSize: '14px', color: '#E2E8F0', outline: 'none',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0B0E18', position: 'relative', overflow: 'hidden',
    }}>
      {/* BG glow */}
      <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(79,123,247,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '380px', padding: '0 16px' }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px', fontWeight: 800, color: 'white' }}>A</div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#E2E8F0', margin: '0 0 4px' }}>Archon</h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>by Armila Design</p>
        </div>

        {/* CARD */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px 24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#E2E8F0', margin: '0 0 24px', textAlign: 'center' }}>Sign in to your account</h2>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Email</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="you@armiladesign.com"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Password</label>
                <a href="/forgot-password" style={{ fontSize: '12px', color: '#60A5FA', textDecoration: 'none' }}>Forgot password?</a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
                <button onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '14px', padding: '4px' }}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button onClick={handleLogin} disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', background: loading ? 'rgba(79,123,247,0.5)' : 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px', transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading ? (
                <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Signing in...</>
              ) : 'Sign In →'}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '24px' }}>
          Archon CRM · Armila Design Studio
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
