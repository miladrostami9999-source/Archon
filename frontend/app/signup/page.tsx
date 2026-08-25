'use client'
import { useState, useEffect, Suspense } from 'react'
import axios from 'axios'
import { useSearchParams } from 'next/navigation'
import { Palette, Briefcase, CheckCircle2, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const PLAN_LABELS: Record<string, string> = { trial: 'Free Trial (7 days)', basic: 'Basic', pro: 'Pro', agency: 'Agency' }

function SignupInner() {
  const searchParams = useSearchParams()
  const planParam = (searchParams.get('plan') || 'basic').toLowerCase()
  const plan = PLAN_LABELS[planParam] ? planParam : 'basic'
  // Every plan creates the account right away; the trial is usable at once,
  // paid plans unlock their quota features after payment is confirmed.
  const isTrial = plan === 'trial'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [company, setCompany] = useState('')
  const [note, setNote] = useState('')
  // Which side of the marketplace they mainly work on. Only decides which
  // view leads — either mode can both post work and take work, and it's
  // switchable later from the profile page.
  const [accountMode, setAccountMode] = useState<'freelancer' | 'client'>('freelancer')
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
        name: name.trim(), email: email.trim(), password, plan,
        company: company.trim(), note: note.trim(), account_mode: accountMode,
      })
      // Self-serve plans (the free trial) come back with a token — sign in
      // straight away instead of showing a "we'll be in touch" screen.
      if (res.data.instant && res.data.token) {
        localStorage.setItem('archon-token', res.data.token)
        localStorage.setItem('archon-user', JSON.stringify(res.data.user))
        // Paid plans start pending — send them straight to payment; the free
        // trial is usable immediately, so it goes to the dashboard.
        window.location.href = res.data.plan_status === 'pending' ? '/upgrade' : '/dashboard'
        return
      }
      setDoneMsg(res.data.message || "You're on the list!")
      setDone(true)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Something went wrong. Please try again.')
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
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = 'var(--accent)' }
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = 'var(--border)' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '400px', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px', fontWeight: 800, color: 'white' }}>A</div>
          </a>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Archon</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>by Armila Design</p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '28px 24px' }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><CheckCircle2 size={40} strokeWidth={1.5} color="var(--success)" /></div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>You&apos;re on the list</h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 20px' }}>{doneMsg}</p>
              <a href="/" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}>← Back to home</a>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>
                {isTrial ? 'Start your free trial' : `Create your ${PLAN_LABELS[plan]} account`}
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 }}>
                {isTrial ? (
                  <>Free for <strong style={{ color: 'var(--success)' }}>7 days</strong> — 10 companies, 10 emails, no card needed. Your account is created instantly.</>
                ) : (
                  <>Your account is created instantly and you can explore right away. Adding companies and sending email unlock once we confirm your payment.</>
                )}
              </p>

              {error && (
                <div style={{ background: 'rgba(228,114,111,0.1)', border: '1px solid rgba(228,114,111,0.25)', color: 'var(--error)', fontSize: '13px', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>How will you use Archon? *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {([
                      { key: 'freelancer', Icon: Palette, title: 'I take work', sub: 'Find projects and send proposals' },
                      { key: 'client', Icon: Briefcase, title: 'I hire', sub: 'Post projects and hire freelancers' },
                    ] as const).map(opt => {
                      const on = accountMode === opt.key
                      return (
                        <button key={opt.key} type="button" onClick={() => setAccountMode(opt.key)}
                          style={{
                            textAlign: 'left', padding: '12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                            background: on ? 'var(--accent-dim)' : 'var(--bg-input)',
                            transition: 'all 0.15s',
                          }}>
                          <opt.Icon size={17} strokeWidth={1.75} color={on ? 'var(--accent)' : 'var(--text-muted)'} style={{ marginBottom: '4px' }} />
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: on ? 'var(--accent)' : 'var(--text)' }}>{opt.title}</div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginTop: '2px', lineHeight: 1.4 }}>{opt.sub}</div>
                        </button>
                      )
                    })}
                  </div>
                  <p style={{ fontSize: '10.5px', color: 'var(--text-dim)', margin: '6px 0 0', lineHeight: 1.5 }}>
                    You can do both either way — this just sets which view you land on, and you can switch it any time.
                  </p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Full name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Password *</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Confirm password *</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Studio / Company <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Your studio" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Anything to add? <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Tell us about your studio..." rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} onFocus={onFocus} onBlur={onBlur} />
                </div>

                <button onClick={submit} disabled={loading}
                  style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, color: 'white', background: loading ? 'var(--accent-dim)' : 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {loading ? (<><Loader2 size={16} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</>) : (isTrial ? 'Create my account →' : 'Create account & pay →')}
                </button>
              </div>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-dim)', marginTop: '20px' }}>
          Already have an account? <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-main)' }} />}>
      <SignupInner />
    </Suspense>
  )
}
