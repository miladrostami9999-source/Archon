'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Payment {
  id: number
  milestone_id: number
  milestone_title: string | null
  contract_id: number | null
  client_name: string | null
  amount: number
  currency: string
  method: string | null
  reference: string | null
  receipt_url: string | null
  note: string | null
  status: string
  admin_note: string | null
  created_at: string
}

interface Project {
  id: number
  title: string
  status: string
  created_at: string
}

interface Milestone {
  id: number
  title: string
  amount: number
  status: string
}

interface Contract {
  id: number
  project_title: string | null
  client_name: string | null
  freelancer_name: string | null
  total_amount: number | null
  currency: string
  status: string
  milestones: Milestone[]
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending:  { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', label: 'Pending' },
  approved: { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Approved' },
  rejected: { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Rejected' },
}

export default function MarketplaceAdminPage() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<'payments' | 'projects' | 'contracts' | 'payouts'>('payments')

  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentFilter, setPaymentFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [projects, setProjects] = useState<Project[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [msg, setMsg] = useState('')

  const [payoutForm, setPayoutForm] = useState({ milestone_id: '', amount: '', method: '', reference: '', admin_note: '' })
  const approvedMilestones = contracts.flatMap(c => c.milestones.filter(m => m.status === 'approved').map(m => ({ ...m, contract: c })))

  const load = () => {
    setLoading(true)
    Promise.all([
      axios.get(`${API}/marketplace/admin/payments`),
      axios.get(`${API}/marketplace/admin/projects`),
      axios.get(`${API}/marketplace/admin/contracts`),
    ]).then(([p, pr, c]) => {
      setPayments(p.data); setProjects(pr.data); setContracts(c.data)
    }).catch((e) => { if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard' })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const approvePayment = async (id: number) => {
    setBusy(id); setMsg('')
    try {
      const r = await axios.post(`${API}/marketplace/admin/payments/${id}/approve`)
      setMsg(`✓ ${r.data.message}`)
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Approve failed'}`) }
    setBusy(null)
  }

  const rejectPayment = async (id: number) => {
    setBusy(id); setMsg('')
    try {
      await axios.post(`${API}/marketplace/admin/payments/${id}/reject`, { admin_note: rejectNote })
      setRejectingId(null); setRejectNote('')
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Reject failed'}`) }
    setBusy(null)
  }

  const submitPayout = async () => {
    if (!payoutForm.milestone_id || !payoutForm.amount) { setMsg('✗ Pick a milestone and enter an amount'); return }
    setBusy(-1); setMsg('')
    try {
      const r = await axios.post(`${API}/marketplace/admin/payouts`, {
        milestone_id: Number(payoutForm.milestone_id),
        amount: Number(payoutForm.amount),
        method: payoutForm.method || null,
        reference: payoutForm.reference || null,
        admin_note: payoutForm.admin_note || null,
      })
      setMsg(`✓ ${r.data.message}`)
      setPayoutForm({ milestone_id: '', amount: '', method: '', reference: '', admin_note: '' })
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Payout failed'}`) }
    setBusy(null)
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px',
    fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  }
  const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }

  const shownPayments = payments.filter(p => paymentFilter === 'all' ? true : p.status === paymentFilter)
  const pendingCount = payments.filter(p => p.status === 'pending').length

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', height: '100vh', overflowY: 'auto', padding: isMobile ? '72px 16px 32px' : '32px 40px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Marketplace Admin</h1>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#A78BFA', background: 'rgba(139,92,246,0.12)', padding: '2px 8px', borderRadius: '999px', textTransform: 'uppercase' }}>Beta</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px' }}>
            Verify milestone payments, browse all projects and contracts, and record payouts to freelancers.
          </p>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {([
              ['payments', `Pending Payments${pendingCount ? ` (${pendingCount})` : ''}`],
              ['projects', 'All Projects'],
              ['contracts', 'All Contracts'],
              ['payouts', 'Payouts'],
            ] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid ' + (tab === t ? 'rgba(139,92,246,0.4)' : 'var(--border)'),
                  background: tab === t ? 'rgba(139,92,246,0.15)' : 'transparent',
                  color: tab === t ? '#A78BFA' : 'var(--text-muted)' }}>{label}</button>
            ))}
          </div>

          {msg && <p style={{ fontSize: '12.5px', color: msg.startsWith('✓') ? '#34D399' : '#F87171', marginBottom: '14px' }}>{msg}</p>}

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
          ) : tab === 'payments' ? (
            <>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                  <button key={f} onClick={() => setPaymentFilter(f)}
                    style={{ padding: '5px 12px', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                      border: '1px solid ' + (paymentFilter === f ? 'rgba(79,123,247,0.4)' : 'var(--border)'),
                      background: paymentFilter === f ? 'rgba(79,123,247,0.15)' : 'transparent',
                      color: paymentFilter === f ? '#60A5FA' : 'var(--text-muted)' }}>{f}</button>
                ))}
              </div>
              {shownPayments.length === 0 ? (
                <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                  No {paymentFilter !== 'all' ? paymentFilter : ''} payments.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {shownPayments.map(p => {
                    const sm = STATUS_META[p.status] || STATUS_META.pending
                    return (
                      <div key={p.id} style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{p.milestone_title || `Milestone #${p.milestone_id}`}</span>
                              <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                              {p.client_name} · <a href={`/contracts/${p.contract_id}`} style={{ color: '#60A5FA', textDecoration: 'none' }}>Contract #{p.contract_id}</a>
                            </div>
                            <div style={{ fontSize: '12.5px', color: 'var(--text)', marginTop: '6px' }}>
                              {p.amount.toLocaleString('en-US')} {p.currency}
                              {p.method ? ` · ${p.method}` : ''}
                              {p.reference ? <> · ref <strong>{p.reference}</strong></> : ''}
                            </div>
                            {p.receipt_url && (
                              <a href={p.receipt_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '6px', fontSize: '12.5px', color: '#60A5FA', textDecoration: 'none' }}>📎 View receipt</a>
                            )}
                            {p.note && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>"{p.note}"</div>}
                          </div>
                          {p.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                              <button onClick={() => approvePayment(p.id)} disabled={busy === p.id}
                                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: 'pointer' }}>
                                {busy === p.id ? '…' : 'Approve'}
                              </button>
                              <button onClick={() => { setRejectingId(rejectingId === p.id ? null : p.id); setRejectNote('') }}
                                style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                        {rejectingId === p.id && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                            <input value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Reason (shown to the client)" style={input} />
                            <button onClick={() => rejectPayment(p.id)} disabled={busy === p.id}
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
            </>
          ) : tab === 'projects' ? (
            projects.length === 0 ? (
              <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: '13.5px' }}>No projects yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {projects.map(p => (
                  <a key={p.id} href={`/projects/${p.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 16px', textDecoration: 'none' }}>
                    <span style={{ fontSize: '13.5px', color: 'var(--text)' }}>{p.title}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'capitalize' }}>{p.status.replace('_', ' ')}</span>
                  </a>
                ))}
              </div>
            )
          ) : tab === 'contracts' ? (
            contracts.length === 0 ? (
              <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: '13.5px' }}>No contracts yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {contracts.map(c => (
                  <a key={c.id} href={`/contracts/${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 16px', textDecoration: 'none', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontSize: '13.5px', color: 'var(--text)' }}>{c.project_title || `Contract #${c.id}`} — {c.client_name} → {c.freelancer_name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{c.total_amount?.toLocaleString('en-US')} {c.currency} · {c.status}</span>
                  </a>
                ))}
              </div>
            )
          ) : (
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '12px' }}>Record a payout</p>
              {approvedMilestones.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No milestones are approved and waiting for payout right now.</p>
              ) : (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={label}>Milestone</label>
                    <select value={payoutForm.milestone_id} onChange={e => {
                      const mid = e.target.value
                      const found = approvedMilestones.find(m => String(m.id) === mid)
                      setPayoutForm(f => ({ ...f, milestone_id: mid, amount: found ? String(found.amount) : f.amount }))
                    }} style={input}>
                      <option value="">Select a milestone…</option>
                      {approvedMilestones.map(m => (
                        <option key={m.id} value={m.id}>{m.contract.project_title || `Contract #${m.contract.id}`} — {m.title} ({m.amount} {m.contract.currency})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={label}>Amount</label>
                      <input type="number" value={payoutForm.amount} onChange={e => setPayoutForm(f => ({ ...f, amount: e.target.value }))} style={input} />
                    </div>
                    <div>
                      <label style={label}>Method</label>
                      <input value={payoutForm.method} onChange={e => setPayoutForm(f => ({ ...f, method: e.target.value }))} placeholder="Bank transfer, PayPal…" style={input} />
                    </div>
                    <div>
                      <label style={label}>Reference</label>
                      <input value={payoutForm.reference} onChange={e => setPayoutForm(f => ({ ...f, reference: e.target.value }))} style={input} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={label}>Note (optional)</label>
                    <input value={payoutForm.admin_note} onChange={e => setPayoutForm(f => ({ ...f, admin_note: e.target.value }))} style={input} />
                  </div>
                  <button onClick={submitPayout} disabled={busy === -1}
                    style={{ padding: '9px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer' }}>
                    {busy === -1 ? 'Recording…' : 'Record payout'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
