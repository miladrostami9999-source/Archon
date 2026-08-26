'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'
import { Paperclip } from 'lucide-react'
import InlineStatus from '../components/InlineStatus'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface PayReq {
  id: number; plan: string; amount: number | null; currency: string
  method: string | null; reference: string; note: string | null; receipt_url: string | null
  status: string; created_at: string; user_name: string; user_email: string
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending:  { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', label: 'Pending' },
  approved: { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Approved' },
  rejected: { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Rejected' },
}

export default function PaymentsPage() {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<PayReq[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending')
  const [busy, setBusy] = useState<number | null>(null)
  const [rejecting, setRejecting] = useState<number | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [msg, setMsg] = useState('')

  const load = () => {
    axios.get(`${API}/auth/billing/requests`)
      .then(r => setRows(r.data))
      .catch((e) => { if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard' })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [])

  const approve = async (id: number) => {
    setBusy(id); setMsg('')
    try {
      const r = await axios.post(`${API}/auth/billing/requests/${id}/approve`)
      setMsg(`✓ Activated ${r.data.plan} until ${new Date(r.data.expires_at).toLocaleDateString()}`)
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Approve failed'}`) }
    setBusy(null)
  }

  const reject = async (id: number) => {
    setBusy(id); setMsg('')
    try {
      await axios.post(`${API}/auth/billing/requests/${id}/reject`, { admin_note: rejectNote })
      setRejecting(null); setRejectNote(''); load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Reject failed'}`) }
    setBusy(null)
  }

  const shown = rows.filter(r => filter === 'all' ? true : r.status === filter)
  const pendingCount = rows.filter(r => r.status === 'pending').length
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px',
    fontSize: '12.5px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
    resize: 'vertical',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', height: '100vh', overflowY: 'auto', padding: isMobile ? '72px 16px 32px' : '32px 40px' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Payments {pendingCount > 0 && <span style={{ fontSize: '13px', fontWeight: 600, color: '#FBBF24', marginLeft: '8px' }}>{pendingCount} to verify</span>}
            </h1>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['pending', 'approved', 'all'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                    border: '1px solid ' + (filter === f ? 'rgba(61,79,224,0.4)' : 'var(--border)'),
                    background: filter === f ? 'rgba(61,79,224,0.15)' : 'transparent',
                    color: filter === f ? '#60A5FA' : 'var(--text-muted)' }}>{f}</button>
              ))}
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px' }}>
            Verify the transfer landed, then approve — the plan activates immediately with a fresh period. Payment details and instructions are configured in the Admin Panel.
          </p>

          {msg && (
            <div style={{ marginBottom: '14px' }}><InlineStatus text={msg} /></div>
          )}

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
          ) : shown.length === 0 ? (
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
              No {filter !== 'all' ? filter : ''} payments.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {shown.map(r => {
                const sm = STATUS_META[r.status] || STATUS_META.pending
                return (
                  <div key={r.id} style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text)' }}>{r.user_name}</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: '#A78BFA', background: 'rgba(139,92,246,0.12)', textTransform: 'uppercase' }}>{r.plan}</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{r.user_email}</div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text)', marginTop: '6px' }}>
                          {r.amount ? `${r.amount.toLocaleString('en-US')} ${r.currency}` : '—'}
                          {r.method ? ` · ${r.method}` : ''}
                          {' · ref '}<strong>{r.reference}</strong>
                        </div>
                        {r.receipt_url && (
                          <a href={r.receipt_url} target="_blank" rel="noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '12.5px', color: '#60A5FA', textDecoration: 'none' }}>
                            <Paperclip size={12} strokeWidth={1.75} /> View receipt
                          </a>
                        )}
                        {r.note && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>“{r.note}”</div>}
                      </div>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <button onClick={() => approve(r.id)} disabled={busy === r.id}
                            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: busy === r.id ? 'wait' : 'pointer' }}>
                            {busy === r.id ? '…' : 'Approve'}
                          </button>
                          <button onClick={() => { setRejecting(rejecting === r.id ? null : r.id); setRejectNote('') }}
                            style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                    {rejecting === r.id && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <input value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Reason (shown to the user)" style={{ ...input, resize: 'none' }} />
                        <button onClick={() => reject(r.id)} disabled={busy === r.id}
                          style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: '#EF4444', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                          Confirm
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
