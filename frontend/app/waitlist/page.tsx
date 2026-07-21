'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => localStorage.getItem('archon-token') || ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

const PLAN_META: Record<string, { color: string; bg: string }> = {
  basic:  { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' },
  pro:    { color: '#60A5FA', bg: 'rgba(79,123,247,0.12)' },
  agency: { color: '#A78BFA', bg: 'rgba(139,92,246,0.12)' },
}
const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending:  { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', label: 'Pending' },
  approved: { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Approved' },
  rejected: { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Rejected' },
}

interface Entry {
  id: number; name: string; email: string; plan: string
  company: string | null; note: string | null; status: string; created_at: string
}

export default function WaitlistPage() {
  const isMobile = useIsMobile()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending')
  const [busy, setBusy] = useState<number | null>(null)
  const [approved, setApproved] = useState<{ email: string; temp_password: string | null; emailed: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const fetchEntries = async () => {
    try { const r = await axios.get(`${API}/auth/waitlist`, { headers: headers() }); setEntries(r.data) }
    catch (e: any) { if (e.response?.status === 403 || e.response?.status === 401) window.location.href = '/dashboard' }
    setLoading(false)
  }
  useEffect(() => { fetchEntries() }, [])

  const approve = async (id: number) => {
    setBusy(id)
    try {
      const r = await axios.post(`${API}/auth/waitlist/${id}/approve`, {}, { headers: headers() })
      setApproved({ email: r.data.email, temp_password: r.data.temp_password, emailed: r.data.emailed })
      fetchEntries()
    } catch (e: any) { alert(e.response?.data?.detail || 'Approve failed') }
    setBusy(null)
  }

  const remove = async (id: number) => {
    setBusy(id)
    try { await axios.delete(`${API}/auth/waitlist/${id}`, { headers: headers() }); setConfirmDelete(null); fetchEntries() }
    catch (e: any) { alert(e.response?.data?.detail || 'Delete failed') }
    setBusy(null)
  }

  const shown = entries.filter(e => filter === 'all' ? true : e.status === filter)
  const pendingCount = entries.filter(e => e.status === 'pending').length

  const card: React.CSSProperties = {
    background: 'var(--bg-card, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))',
    borderRadius: '14px', padding: '18px 20px',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg, #0B0E18)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', padding: isMobile ? '72px 16px 32px' : '32px 40px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text, #E2E8F0)', margin: 0 }}>
              Waitlist {pendingCount > 0 && <span style={{ fontSize: '13px', fontWeight: 600, color: '#FBBF24', marginLeft: '8px' }}>{pendingCount} pending</span>}
            </h1>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['pending', 'approved', 'all'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                    border: '1px solid ' + (filter === f ? 'rgba(79,123,247,0.4)' : 'var(--border, rgba(255,255,255,0.1))'),
                    background: filter === f ? 'rgba(79,123,247,0.15)' : 'transparent',
                    color: filter === f ? '#60A5FA' : 'var(--text-dim, rgba(255,255,255,0.5))' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-dim, rgba(255,255,255,0.45))', margin: '0 0 22px' }}>
            People who requested access from the landing page. Approving creates their account and generates a temporary password.
          </p>

          {loading ? (
            <p style={{ color: 'var(--text-dim, rgba(255,255,255,0.4))', fontSize: '14px' }}>Loading…</p>
          ) : shown.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim, rgba(255,255,255,0.4))', fontSize: '14px' }}>
              No {filter !== 'all' ? filter : ''} requests.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {shown.map(e => {
                const pm = PLAN_META[e.plan] || PLAN_META.basic
                const sm = STATUS_META[e.status] || STATUS_META.pending
                return (
                  <div key={e.id} style={card}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text, #E2E8F0)' }}>{e.name}</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: pm.color, background: pm.bg, textTransform: 'uppercase' }}>{e.plan}</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-dim, rgba(255,255,255,0.55))' }}>{e.email}</div>
                        {e.company && <div style={{ fontSize: '12.5px', color: 'var(--text-dim, rgba(255,255,255,0.4))', marginTop: '2px' }}>🏢 {e.company}</div>}
                        {e.note && <div style={{ fontSize: '12.5px', color: 'var(--text-dim, rgba(255,255,255,0.4))', marginTop: '6px', fontStyle: 'italic' }}>“{e.note}”</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        {e.status === 'pending' && (
                          <button onClick={() => approve(e.id)} disabled={busy === e.id}
                            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: busy === e.id ? 'wait' : 'pointer' }}>
                            {busy === e.id ? '…' : 'Approve'}
                          </button>
                        )}
                        {confirmDelete === e.id ? (
                          <button onClick={() => remove(e.id)} disabled={busy === e.id}
                            style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: '#EF4444', border: 'none', cursor: 'pointer' }}>
                            Confirm
                          </button>
                        ) : (
                          <button onClick={() => setConfirmDelete(e.id)}
                            style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-dim, rgba(255,255,255,0.5))', background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.12))', cursor: 'pointer' }}>
                            {e.status === 'pending' ? 'Reject' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Approval result — shows the temp password once */}
      {approved && (
        <div onClick={() => setApproved(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div onClick={ev => ev.stopPropagation()} style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-card, #161B27)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: '16px', padding: '26px' }}>
            <div style={{ fontSize: '34px', textAlign: 'center', marginBottom: '10px' }}>✅</div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text, #E2E8F0)', margin: '0 0 6px', textAlign: 'center' }}>Account approved</h2>

            {approved.temp_password ? (
              // Legacy entry with no user-chosen password — show generated one
              <>
                <p style={{ fontSize: '13px', color: 'var(--text-dim, rgba(255,255,255,0.5))', textAlign: 'center', margin: '0 0 18px', lineHeight: 1.6 }}>
                  This older request had no password, so we generated one. {approved.emailed ? 'It was emailed to the user; ' : ''}copy it now — it&apos;s shown only once.
                </p>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim, rgba(255,255,255,0.45))', marginBottom: '4px' }}>Email</div>
                  <div style={{ fontSize: '14px', color: 'var(--text, #E2E8F0)', marginBottom: '12px', wordBreak: 'break-all' }}>{approved.email}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim, rgba(255,255,255,0.45))', marginBottom: '4px' }}>Temporary password</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#34D399', fontFamily: 'monospace' }}>{approved.temp_password}</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { navigator.clipboard.writeText(`Email: ${approved.email}\nPassword: ${approved.temp_password}`); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                    style={{ flex: 1, padding: '11px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer' }}>
                    {copied ? '✓ Copied' : '📋 Copy credentials'}
                  </button>
                  <button onClick={() => setApproved(null)}
                    style={{ padding: '11px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'var(--text-dim, rgba(255,255,255,0.6))', background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.12))', cursor: 'pointer' }}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              // Normal flow — user already set their own password at signup
              <>
                <p style={{ fontSize: '13.5px', color: 'var(--text-dim, rgba(255,255,255,0.55))', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text, #E2E8F0)' }}>{approved.email}</strong> can now sign in with the password they chose.
                  {approved.emailed
                    ? ' A confirmation email has been sent to them.'
                    : ' (Email delivery is off, so let them know their account is active.)'}
                </p>
                <button onClick={() => setApproved(null)}
                  style={{ width: '100%', padding: '11px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer' }}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
