'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Plan {
  plan: string
  max_companies: number
  max_emails_per_month: number
  period_days: number
  price_usd: number
  price_irr: number
}
interface MyRequest {
  id: number; plan: string; amount: number | null; currency: string
  reference: string; status: string; admin_note: string | null; created_at: string
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending:  { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', label: 'Awaiting review' },
  approved: { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Approved' },
  rejected: { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Rejected' },
}

const fmt = (n: number) => n.toLocaleString('en-US')

export default function UpgradePage() {
  const isMobile = useIsMobile()
  const [plans, setPlans] = useState<Plan[]>([])
  const [current, setCurrent] = useState('')
  const [instructions, setInstructions] = useState({ en: '', fa: '' })
  const [lang, setLang] = useState<'en' | 'fa'>('en')
  const [mine, setMine] = useState<MyRequest[]>([])
  const [selected, setSelected] = useState<Plan | null>(null)
  const [form, setForm] = useState({ currency: 'IRR', amount: '', method: '', reference: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const load = () => {
    axios.get(`${API}/auth/billing/plans`).then(r => {
      setPlans(r.data.plans); setCurrent(r.data.current_plan)
      setInstructions({ en: r.data.instructions_en, fa: r.data.instructions_fa })
    }).catch(() => {})
    axios.get(`${API}/auth/billing/requests/mine`).then(r => setMine(r.data)).catch(() => {})
  }
  useEffect(load, [])

  const submit = async () => {
    if (!selected) return
    if (!form.reference.trim()) { setError('Please enter the payment reference / tracking number.'); return }
    setSaving(true); setError('')
    try {
      const r = await axios.post(`${API}/auth/billing/requests`, {
        plan: selected.plan,
        amount: form.amount ? parseFloat(form.amount) : null,
        currency: form.currency,
        method: form.method,
        reference: form.reference,
        note: form.note,
      })
      setDone(r.data.message)
      setSelected(null)
      setForm({ currency: 'IRR', amount: '', method: '', reference: '', note: '' })
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Something went wrong.')
    }
    setSaving(false)
  }

  const pending = mine.find(m => m.status === 'pending')
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px',
    fontSize: '13px', color: 'var(--text)', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', height: '100vh', overflowY: 'auto', padding: isMobile ? '72px 16px 32px' : '32px 40px' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Upgrade your plan</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 24px' }}>
            You&apos;re currently on <strong style={{ color: '#A78BFA', textTransform: 'capitalize' }}>{current}</strong>.
          </p>

          {done && (
            <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34D399', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '18px' }}>
              ✅ {done}
            </div>
          )}

          {pending && (
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13.5px', color: '#FBBF24', fontWeight: 600, margin: '0 0 4px' }}>Payment under review</p>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                Your <strong style={{ textTransform: 'capitalize' }}>{pending.plan}</strong> payment (ref {pending.reference}) is being verified. We&apos;ll email you as soon as it&apos;s active.
              </p>
            </div>
          )}

          {/* PLANS */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '28px' }}>
            {plans.map(p => {
              const isCurrent = p.plan === current
              const isSel = selected?.plan === p.plan
              return (
                <div key={p.plan} style={{
                  borderRadius: '14px', padding: '18px',
                  border: `1px solid ${isSel ? 'rgba(79,123,247,0.5)' : 'var(--border)'}`,
                  background: isSel ? 'rgba(79,123,247,0.06)' : 'var(--bg-card)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{p.plan}</span>
                    {isCurrent && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: '#34D399', background: 'rgba(52,211,153,0.12)' }}>CURRENT</span>}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    {p.price_irr > 0 && (
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>
                        {fmt(p.price_irr)} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Toman</span>
                      </div>
                    )}
                    {p.price_usd > 0 && (
                      <div style={{ fontSize: p.price_irr > 0 ? '12.5px' : '18px', fontWeight: p.price_irr > 0 ? 500 : 800, color: p.price_irr > 0 ? 'var(--text-muted)' : 'var(--text)' }}>
                        ${p.price_usd}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>per {p.period_days} days</div>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      ✓ {p.max_companies === -1 ? 'Unlimited' : p.max_companies} companies
                    </li>
                    <li style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      ✓ {p.max_emails_per_month === -1 ? 'Unlimited' : p.max_emails_per_month} emails
                    </li>
                  </ul>
                  <button onClick={() => { setSelected(p); setDone(''); setForm(f => ({ ...f, amount: String(p.price_irr > 0 ? p.price_irr : p.price_usd), currency: p.price_irr > 0 ? 'IRR' : 'USD' })) }}
                    disabled={!!pending}
                    style={{ width: '100%', padding: '9px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.5 : 1 }}>
                    {isCurrent ? 'Renew' : 'Choose'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* PAYMENT FORM */}
          {selected && (
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  Pay for <span style={{ textTransform: 'capitalize', color: '#A78BFA' }}>{selected.plan}</span>
                </h2>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['en', 'fa'] as const).map(l => (
                    <button key={l} onClick={() => setLang(l)}
                      style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer',
                        border: '1px solid ' + (lang === l ? 'rgba(79,123,247,0.4)' : 'var(--border)'),
                        background: lang === l ? 'rgba(79,123,247,0.15)' : 'transparent',
                        color: lang === l ? '#60A5FA' : 'var(--text-muted)' }}>{l}</button>
                  ))}
                </div>
              </div>

              <pre style={{
                whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12.5px', lineHeight: 1.8,
                color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '14px', margin: '0 0 16px',
                direction: lang === 'fa' ? 'rtl' : 'ltr', textAlign: lang === 'fa' ? 'right' : 'left',
              }}>{lang === 'fa' ? instructions.fa : instructions.en}</pre>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '12.5px', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' }}>{error}</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Amount paid</label>
                  <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={input} placeholder="e.g. 2500000" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={input}>
                    <option value="IRR">Toman (IRR)</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Payment method</label>
                  <input value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} style={input} placeholder="card to card, transfer…" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Reference / tracking no. *</label>
                  <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} style={input} placeholder="Receipt or tracking number" />
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Note (optional)</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={submit} disabled={saving}
                  style={{ flex: 1, padding: '11px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Submitting…' : 'I have paid — submit for review'}
                </button>
                <button onClick={() => { setSelected(null); setError('') }}
                  style={{ padding: '11px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* HISTORY */}
          {mine.length > 0 && (
            <>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '10px' }}>Payment history</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '40px' }}>
                {mine.map(m => {
                  const sm = STATUS_META[m.status] || STATUS_META.pending
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 16px' }}>
                      <div>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{m.plan}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                          {m.amount ? `${fmt(m.amount)} ${m.currency}` : ''} · ref {m.reference}
                        </span>
                        {m.admin_note && <div style={{ fontSize: '11.5px', color: '#F87171', marginTop: '3px' }}>{m.admin_note}</div>}
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
