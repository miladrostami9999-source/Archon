'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import MarketplaceBeta, { BetaTag } from '../components/MarketplaceBeta'
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
  const [tab, setTab] = useState<'payments' | 'verifications' | 'projects' | 'contracts' | 'payouts'>('payments')
  const [verifications, setVerifications] = useState<any[]>([])
  const [rejectVerifyId, setRejectVerifyId] = useState<number | null>(null)
  const [verifyNote, setVerifyNote] = useState('')

  const reviewVerification = async (userId: number, action: 'approve' | 'reject') => {
    setBusy(userId); setMsg('')
    try {
      await axios.post(`${API}/marketplace/verification/admin/${userId}/${action}`,
        action === 'reject' ? { admin_note: verifyNote } : {})
      setRejectVerifyId(null); setVerifyNote('')
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Failed'}`) }
    setBusy(null)
  }

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
  const [cap, setCap] = useState('')
  const [capSaving, setCapSaving] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [copied, setCopied] = useState('')

  const openContract = async (contractId: number) => {
    setDetailLoading(true); setDetail(null); setMsg('')
    try {
      const r = await axios.get(`${API}/marketplace/admin/contracts/${contractId}`)
      setDetail(r.data)
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not open contract'}`) }
    setDetailLoading(false)
  }

  const copy = (key: string, value: string) => {
    navigator.clipboard?.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(''), 1800)
  }

  const payMilestone = async (milestoneId: number, amount: number) => {
    if (!window.confirm(`Record a payout of ${amount.toLocaleString('en-US')}? Do this after the transfer has actually gone out.`)) return
    setBusy(milestoneId); setMsg('')
    try {
      const r = await axios.post(`${API}/marketplace/admin/payouts`, { milestone_id: milestoneId, amount })
      setMsg(`✓ ${r.data.message}`)
      await openContract(detail.id)
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Payout failed'}`) }
    setBusy(null)
  }

  const saveCap = async () => {
    setCapSaving(true); setMsg('')
    try {
      const r = await axios.put(`${API}/marketplace/admin/settings`, { max_contract_usd: Number(cap || 0) })
      setMsg(`✓ ${r.data.message}`)
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not save'}`) }
    setCapSaving(false)
  }
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
    axios.get(`${API}/marketplace/admin/settings`)
      .then(r => setCap(String(r.data.max_contract_usd ?? '')))
      .catch(() => {})
    axios.get(`${API}/marketplace/verification/admin/pending`)
      .then(r => setVerifications(r.data))
      .catch(() => {})
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
            <BetaTag />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px' }}>
            Verify milestone payments, browse all projects and contracts, and record payouts to freelancers.
          </p>

          <MarketplaceBeta />

          <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {([
              ['payments', `Pending Payments${pendingCount ? ` (${pendingCount})` : ''}`],
              ['verifications', `Verifications${verifications.length ? ` (${verifications.length})` : ''}`],
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
          ) : tab === 'verifications' ? (
            verifications.length === 0 ? (
              <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                Nobody is waiting on verification.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {verifications.map(v => (
                  <div key={v.user_id} style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      <div>
                        <a href={`/members/${v.user_id}`} style={{ fontSize: '14px', fontWeight: 600, color: '#60A5FA', textDecoration: 'none' }}>{v.user_name}</a>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{v.user_email}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button onClick={() => reviewVerification(v.user_id, 'approve')} disabled={busy === v.user_id}
                          style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: 'pointer' }}>
                          {busy === v.user_id ? '…' : 'Approve'}
                        </button>
                        <button onClick={() => { setRejectVerifyId(rejectVerifyId === v.user_id ? null : v.user_id); setVerifyNote('') }}
                          style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                          Reject
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '6px 16px', fontSize: '12.5px' }}>
                      {([
                        ['Legal name', v.legal_name], ['National ID', v.national_id],
                        ['Phone', v.phone], ['City', v.city],
                        ['Address', v.address], ['Bank', v.bank_name],
                        ['Account holder', v.account_holder], ['Card', v.card_number],
                        ['IBAN', v.iban],
                      ] as [string, string][]).filter(([, val]) => val).map(([name, val]) => (
                        <div key={name}>
                          <span style={{ color: 'var(--text-dim)' }}>{name}: </span>
                          <span style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{val}</span>
                        </div>
                      ))}
                    </div>
                    {v.id_document_url && (
                      <a href={v.id_document_url} target="_blank" rel="noreferrer"
                        style={{ display: 'inline-block', marginTop: '8px', fontSize: '12.5px', color: '#60A5FA', textDecoration: 'none' }}>📎 View ID document</a>
                    )}
                    {rejectVerifyId === v.user_id && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <input value={verifyNote} onChange={e => setVerifyNote(e.target.value)}
                          placeholder="What needs correcting? (shown to them)" style={input} />
                        <button onClick={() => reviewVerification(v.user_id, 'reject')} disabled={busy === v.user_id}
                          style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: '#EF4444', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                          Confirm
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
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
                {contracts.map(c => {
                  const due = c.milestones.filter(m => m.status === 'approved').length
                  return (
                    <button key={c.id} onClick={() => openContract(c.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', borderRadius: '12px', border: `1px solid ${due ? 'rgba(52,211,153,0.35)' : 'var(--border)'}`, background: due ? 'rgba(52,211,153,0.06)' : 'var(--bg-card)', padding: '12px 16px', cursor: 'pointer', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '13.5px', color: 'var(--text)' }}>
                        {c.project_title || `Contract #${c.id}`} — {c.client_name} → {c.freelancer_name}
                        {due > 0 && <span style={{ marginLeft: '8px', fontSize: '10.5px', fontWeight: 700, color: '#34D399', background: 'rgba(52,211,153,0.14)', padding: '2px 8px', borderRadius: '999px' }}>💰 payout due</span>}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{c.total_amount?.toLocaleString('en-US')} {c.currency} · {c.status}</span>
                    </button>
                  )
                })}
              </div>
            )
          ) : (
            <>
            {/* Beta exposure limit — every open contract is money Archon is
                holding, so this caps how much can be in flight at once. */}
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>Beta limits</p>
              <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '0 0 14px', lineHeight: 1.6 }}>
                The most a single contract may be worth while the marketplace is in beta. Checked when a client accepts a
                proposal, converted from the contract&apos;s own currency. Use <strong>0</strong> to remove the limit.
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ width: '190px' }}>
                  <label style={label}>Max per contract (USD)</label>
                  <input type="number" value={cap} onChange={e => setCap(e.target.value)} placeholder="500" style={input} />
                </div>
                <button onClick={saveCap} disabled={capSaving}
                  style={{ padding: '9px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer', opacity: capSaving ? 0.6 : 1 }}>
                  {capSaving ? 'Saving…' : 'Save limit'}
                </button>
              </div>
            </div>

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
            </>
          )}
        </div>

        {/* ── CONTRACT DETAIL ──
            Everything needed to act on one contract in a single place: where
            each milestone stands, and — when a payout is due — the account to
            transfer to, so there's no hunting through another page for it. */}
        {(detail || detailLoading) && (
          <div onClick={() => setDetail(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? '16px' : '40px 20px', overflowY: 'auto' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '680px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', overflow: 'hidden' }}>
              {detailLoading || !detail ? (
                <p style={{ padding: '32px', color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Loading…</p>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: '0 0 3px' }}>
                        {detail.project_title || `Contract #${detail.id}`}
                      </h2>
                      <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>
                        <a href={`/members/${detail.client.id}`} style={{ color: '#60A5FA', textDecoration: 'none' }}>{detail.client_name}</a>
                        {' → '}
                        <a href={`/members/${detail.freelancer.id}`} style={{ color: '#60A5FA', textDecoration: 'none' }}>{detail.freelancer_name}</a>
                        {' · '}{detail.total_amount?.toLocaleString('en-US')} {detail.currency} · {detail.status}
                      </p>
                    </div>
                    <button onClick={() => setDetail(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '16px', padding: '2px' }}>✕</button>
                  </div>

                  <div style={{ padding: '18px 20px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '10px' }}>Milestones</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                      {detail.milestone_detail.map((m: any) => {
                        const payable = m.status === 'approved'
                        const pending = m.payments.find((p: any) => p.status === 'pending')
                        return (
                          <div key={m.id} style={{ borderRadius: '11px', border: `1px solid ${payable ? 'rgba(52,211,153,0.35)' : 'var(--border)'}`, background: payable ? 'rgba(52,211,153,0.06)' : 'var(--bg-input)', padding: '13px 15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                              <div>
                                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>{m.title}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '8px' }}>{m.amount?.toLocaleString('en-US')} {detail.currency}</span>
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'capitalize', color: payable ? '#34D399' : 'var(--text-dim)' }}>
                                {m.status === 'pending' ? 'awaiting funding' : m.status}
                              </span>
                            </div>

                            {/* What the admin is being asked to do, if anything */}
                            {pending && (
                              <p style={{ fontSize: '12px', color: '#FBBF24', margin: '8px 0 0' }}>
                                💳 Client says they paid {pending.amount?.toLocaleString('en-US')} {pending.currency}
                                {pending.reference ? ` · ref ${pending.reference}` : ''} — confirm it in the Pending Payments tab.
                              </p>
                            )}
                            {m.deliverable_url && (
                              <a href={m.deliverable_url} target="_blank" rel="noreferrer"
                                style={{ display: 'inline-block', marginTop: '6px', fontSize: '12px', color: '#60A5FA', textDecoration: 'none' }}>📎 Delivered work</a>
                            )}
                            {m.payouts.length > 0 && (
                              <p style={{ fontSize: '12px', color: '#A78BFA', margin: '6px 0 0' }}>
                                🏦 Paid out {m.payouts[0].amount?.toLocaleString('en-US')}
                                {m.payouts[0].reference ? ` · ref ${m.payouts[0].reference}` : ''}
                              </p>
                            )}
                            {payable && (
                              <button onClick={() => payMilestone(m.id, m.amount)} disabled={busy === m.id}
                                style={{ marginTop: '10px', padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: 'pointer' }}>
                                {busy === m.id ? 'Recording…' : `Mark as paid — ${m.amount?.toLocaleString('en-US')} ${detail.currency}`}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Payout details — only worth showing when money is due */}
                    {detail.payout_due.length > 0 && (
                      <>
                        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '8px' }}>Send it here</p>
                        {detail.freelancer.verification_status !== 'verified' && (
                          <div style={{ borderRadius: '10px', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.07)', padding: '10px 12px', marginBottom: '10px', fontSize: '12px', color: '#FBBF24', lineHeight: 1.6 }}>
                            ⚠ This freelancer is <strong>{detail.freelancer.verification_status}</strong> — their details haven&apos;t been checked. Verify them before transferring.
                          </div>
                        )}
                        <div style={{ borderRadius: '11px', border: '1px solid var(--border)', background: 'var(--bg-input)', padding: '14px 16px', marginBottom: '8px' }}>
                          {([
                            ['Account holder', detail.freelancer.account_holder || detail.freelancer.legal_name],
                            ['Card number', detail.freelancer.card_number],
                            ['IBAN / Sheba', detail.freelancer.iban],
                            ['Bank', detail.freelancer.bank_name],
                            ['National ID', detail.freelancer.national_id],
                            ['Phone', detail.freelancer.phone],
                          ] as [string, string][]).filter(([, val]) => val).map(([name, val]) => (
                            <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '5px 0' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{name}</div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>{val}</div>
                              </div>
                              <button onClick={() => copy(name, val)}
                                style={{ flexShrink: 0, fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '7px', cursor: 'pointer', color: copied === name ? '#34D399' : '#60A5FA', background: 'transparent', border: `1px solid ${copied === name ? 'rgba(52,211,153,0.4)' : 'rgba(79,123,247,0.3)'}` }}>
                                {copied === name ? '✓' : 'Copy'}
                              </button>
                            </div>
                          ))}
                          {!detail.freelancer.card_number && !detail.freelancer.iban && (
                            <p style={{ fontSize: '12px', color: '#F87171', margin: 0, lineHeight: 1.6 }}>
                              This freelancer hasn&apos;t entered payout details yet. Ask them to complete verification before you transfer.
                            </p>
                          )}
                        </div>
                        <a href={`/contracts/${detail.id}`}
                          style={{ fontSize: '12px', color: '#60A5FA', textDecoration: 'none' }}>Open the contract as a participant →</a>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
