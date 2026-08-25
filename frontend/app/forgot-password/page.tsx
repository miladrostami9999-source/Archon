'use client'
import { useState } from 'react'
import axios from 'axios'
import { Mail, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!email) { setError('Please enter your email'); return }
    setLoading(true); setError('')
    try {
      await axios.post(`${API}/auth/forgot-password`, { email })
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '380px', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px', fontWeight: 800, color: 'white' }}>A</div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Archon</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>by Armila Design</p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '28px 24px' }}>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(63,185,131,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Mail size={22} strokeWidth={1.75} color="var(--success)" />
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Check your email</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 20px' }}>
                If an account exists for <strong style={{ color: 'var(--text)' }}>{email}</strong>, we've sent a link to reset your password. It expires in 30 minutes.
              </p>
              <a href="/login" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}>← Back to login</a>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', textAlign: 'center' }}>Reset your password</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '0 0 22px', textAlign: 'center', lineHeight: 1.6 }}>
                Enter your email and we'll send you a link to reset it.
              </p>

              {error && (
                <div style={{ background: 'rgba(228,114,111,0.1)', border: '1px solid rgba(228,114,111,0.25)', color: 'var(--error)', fontSize: '13px', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Email</label>
                <input type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="you@armiladesign.com"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>

              <button onClick={submit} disabled={loading}
                style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, color: 'white', background: loading ? 'var(--accent-dim)' : 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {loading ? <><Loader2 size={16} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</> : 'Send Reset Link →'}
              </button>

              <p style={{ textAlign: 'center', marginTop: '18px' }}>
                <a href="/login" style={{ fontSize: '13px', color: 'var(--text-dim)', textDecoration: 'none' }}>← Back to login</a>
              </p>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
