'use client'
import { useState, useEffect, Suspense } from 'react'
import axios from 'axios'
import { useSearchParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const PLAN_LABELS: Record<string, string> = { basic: 'Basic', pro: 'Pro', agency: 'Agency' }

function SignupInner() {
  const searchParams = useSearchParams()
  const planParam = (searchParams.get('plan') || 'basic').toLowerCase()
  const plan = PLAN_LABELS[planParam] ? planParam : 'basic'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [company, setCompany] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('archon-token')
    if (token) window.location.href = '/dashboard'
  }, [])

  const submit = async () => {
    if (!name.trim() || !email.trim()) { setError('Please enter your name and email.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    try {
      const res = await axios.post(`${API}/auth/signup`, {
        name: name.trim(), email: email.trim(), password, plan, company: company.trim(), note: note.trim(),
      })
      setDoneMsg(res.data.message || "You're on the list!")
      setDone(true)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Something went wrong. Please try again.')
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
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B0E18', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(79,123,247,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '400px', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px', fontWeight: 800, color: 'white' }}>A</div>
          </a>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#E2E8F0', margin: '0 0 4px' }}>Archon</h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>by Armila Design</p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px 24px' }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#E2E8F0', margin: '0 0 10px' }}>You&apos;re on the list</h2>
              <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: '0 0 20px' }}>{doneMsg}</p>
              <a href="/" style={{ fontSize: '13px', color: '#60A5FA', textDecoration: 'none' }}>← Back to home</a>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#E2E8F0', margin: '0 0 6px', textAlign: 'center' }}>Request early access</h2>
              <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.4)', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 }}>
                We&apos;re onboarding studios gradually. Join the list for the <strong style={{ color: '#A78BFA' }}>{PLAN_LABELS[plan]}</strong> plan and we&apos;ll email you when your account is ready.
              </p>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Full name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Password *</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Confirm password *</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Studio / Company <span style={{ color: 'rgba(255,255,255,0.25)' }}>(optional)</span></label>
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Your studio" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Anything to add? <span style={{ color: 'rgba(255,255,255,0.25)' }}>(optional)</span></label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Tell us about your studio..." rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} onFocus={onFocus} onBlur={onBlur} />
                </div>

                <button onClick={submit} disabled={loading}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', background: loading ? 'rgba(79,123,247,0.5)' : 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {loading ? (<><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Submitting...</>) : 'Join the waitlist →'}
                </button>
              </div>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '20px' }}>
          Already have an account? <a href="/login" style={{ color: '#60A5FA', textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0B0E18' }} />}>
      <SignupInner />
    </Suspense>
  )
}
