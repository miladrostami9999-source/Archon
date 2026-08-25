'use client'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import axios from 'axios'
import { Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    if (!token) setError('This reset link is missing a token. Please request a new one.')
  }, [token])

  const submit = async () => {
    if (!password || !confirm) { setError('Please fill in both fields'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true); setError('')
    try {
      await axios.post(`${API}/auth/reset-password`, { token, new_password: password })
      setDone(true)
      setTimeout(() => { window.location.href = '/login' }, 2500)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'This link is invalid or has expired.')
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

          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(63,185,131,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={22} strokeWidth={1.75} color="var(--success)" />
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Password reset</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                Redirecting you to login...
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', textAlign: 'center' }}>Choose a new password</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '0 0 22px', textAlign: 'center' }}>
                Must be at least 8 characters.
              </p>

              {error && (
                <div style={{ background: 'rgba(228,114,111,0.1)', border: '1px solid rgba(228,114,111,0.25)', color: 'var(--error)', fontSize: '13px', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ ...inputStyle, paddingRight: '44px' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
                  <button onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px', display: 'flex' }}>
                    {showPass ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Confirm Password</label>
                <input type={showPass ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="••••••••"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>

              <button onClick={submit} disabled={loading || !token}
                style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, color: 'white', background: (loading || !token) ? 'var(--accent-dim)' : 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: (loading || !token) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {loading ? <><Loader2 size={16} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> Resetting...</> : 'Reset Password →'}
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
