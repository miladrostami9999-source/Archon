'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import { useIsMobile } from '../../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Milestone {
  id: number
  title: string
  description: string | null
  amount: number
  due_date: string | null
  order_index: number
  status: string
  deliverable_url: string | null
  delivered_at: string | null
  approved_at: string | null
}

interface Contract {
  id: number
  project_id: number
  project_title: string | null
  client_id: number
  client_name: string | null
  freelancer_id: number
  freelancer_name: string | null
  total_amount: number | null
  currency: string
  status: string
  created_at: string
  viewer_role: 'client' | 'freelancer' | 'observer'
  milestones: Milestone[]
}

const CONTRACT_STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  active:    { color: '#60A5FA', bg: 'rgba(79,123,247,0.12)', label: 'Active' },
  completed: { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Completed' },
  disputed:  { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Disputed' },
  cancelled: { color: 'var(--text-dim)', bg: 'var(--bg-input)', label: 'Cancelled' },
}

// Ordered so the timeline reads left-to-right as the money/work actually
// moves: nothing paid yet -> paid & held -> work handed over -> client
// signed off -> freelancer paid out.
const MILESTONE_STEPS = ['pending', 'funded', 'delivered', 'approved', 'released']
const MILESTONE_META: Record<string, { color: string; label: string }> = {
  pending:   { color: 'var(--text-dim)', label: 'Not funded yet' },
  funded:    { color: '#60A5FA', label: 'Funded' },
  delivered: { color: '#FBBF24', label: 'Delivered' },
  approved:  { color: '#34D399', label: 'Approved' },
  released:  { color: '#A78BFA', label: 'Paid out' },
  disputed:  { color: '#F87171', label: 'Disputed' },
}

export default function ContractDetailPage() {
  const params = useParams()
  const id = params?.id
  const isMobile = useIsMobile()
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [openPanel, setOpenPanel] = useState<{ milestoneId: number; kind: 'fund' | 'deliver' } | null>(null)
  const [fundForm, setFundForm] = useState({ amount: '', currency: 'USD', method: '', reference: '', note: '' })
  const [receipt, setReceipt] = useState<{ url: string; name: string } | null>(null)
  const [deliverUrl, setDeliverUrl] = useState('')
  const [deliverFile, setDeliverFile] = useState<{ url: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [msg, setMsg] = useState('')

  const load = () => {
    if (!id) return
    axios.get(`${API}/marketplace/contracts/${id}`)
      .then(r => setContract(r.data))
      .catch((e) => {
        if (e.response?.status === 404) setNotFound(true)
        else if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard'
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [id])

  const uploadFile = async (file: File, setter: (v: { url: string; name: string } | null) => void) => {
    setUploading(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await axios.post(`${API}/auth/upload/receipt`, fd)
      setter({ url: r.data.url, name: file.name })
    } catch (e: any) {
      setMsg(`✗ ${e.response?.data?.detail || 'Upload failed'}`)
    }
    setUploading(false)
  }

  const openFund = (m: Milestone) => {
    setOpenPanel({ milestoneId: m.id, kind: 'fund' })
    setFundForm({ amount: String(m.amount), currency: contract?.currency || 'USD', method: '', reference: '', note: '' })
    setReceipt(null)
    setMsg('')
  }
  const openDeliver = (m: Milestone) => {
    setOpenPanel({ milestoneId: m.id, kind: 'deliver' })
    setDeliverUrl('')
    setDeliverFile(null)
    setMsg('')
  }

  const submitFund = async (milestoneId: number) => {
    if (!fundForm.reference.trim() && !receipt) { setMsg('✗ Attach a receipt or enter a tracking number'); return }
    setBusy(milestoneId); setMsg('')
    try {
      await axios.post(`${API}/marketplace/milestones/${milestoneId}/fund`, {
        amount: Number(fundForm.amount),
        currency: fundForm.currency,
        method: fundForm.method || null,
        reference: fundForm.reference || null,
        receipt_url: receipt?.url || null,
        note: fundForm.note || null,
      })
      setMsg('✓ Payment submitted — the admin will verify and fund this milestone')
      setOpenPanel(null)
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not submit payment'}`) }
    setBusy(null)
  }

  const submitDeliver = async (milestoneId: number) => {
    const url = deliverFile?.url || deliverUrl.trim()
    if (!url) { setMsg('✗ Attach a file or paste a link to the delivered work'); return }
    setBusy(milestoneId); setMsg('')
    try {
      await axios.post(`${API}/marketplace/milestones/${milestoneId}/deliver`, { deliverable_url: url })
      setMsg('✓ Delivery submitted')
      setOpenPanel(null)
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not submit delivery'}`) }
    setBusy(null)
  }

  const approve = async (milestoneId: number) => {
    if (!window.confirm('Approve this delivery? The admin will process payout to the freelancer next.')) return
    setBusy(milestoneId); setMsg('')
    try {
      await axios.post(`${API}/marketplace/milestones/${milestoneId}/approve`)
      setMsg('✓ Delivery approved')
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not approve'}`) }
    setBusy(null)
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px',
    fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  }
  const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }

  const sm = contract ? (CONTRACT_STATUS_META[contract.status] || CONTRACT_STATUS_META.active) : null
  const otherParty = contract && (contract.viewer_role === 'client' ? contract.freelancer_name : contract.client_name)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', height: '100vh', overflowY: 'auto', padding: isMobile ? '72px 16px 32px' : '32px 40px' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <a href="/contracts" style={{ fontSize: '12.5px', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-block', marginBottom: '14px' }}>← Back to contracts</a>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
          ) : notFound || !contract || !sm ? (
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
              Contract not found.
            </div>
          ) : (
            <>
              <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <h1 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{contract.project_title || `Contract #${contract.id}`}</h1>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
                </div>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12.5px', color: 'var(--text-dim)' }}>
                  <span>💰 {contract.total_amount?.toLocaleString('en-US')} {contract.currency}</span>
                  <span>With {otherParty || 'the other party'}</span>
                  <span style={{ textTransform: 'capitalize' }}>You're the {contract.viewer_role}</span>
                </div>
              </div>

              {msg && <p style={{ fontSize: '12.5px', color: msg.startsWith('✓') ? '#34D399' : '#F87171', marginBottom: '14px' }}>{msg}</p>}

              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '10px' }}>
                Milestones
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '32px' }}>
                {contract.milestones.map(m => {
                  const mm = MILESTONE_META[m.status] || MILESTONE_META.pending
                  const stepIdx = MILESTONE_STEPS.indexOf(m.status)
                  const isClient = contract.viewer_role === 'client'
                  const isFreelancer = contract.viewer_role === 'freelancer'
                  const panelOpen = openPanel?.milestoneId === m.id
                  return (
                    <div key={m.id} style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <div>
                          <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>{m.title}</span>
                          {m.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{m.description}</p>}
                          {m.deliverable_url && (
                            <a href={m.deliverable_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '4px', fontSize: '12px', color: '#60A5FA', textDecoration: 'none' }}>
                              📎 View delivered work
                            </a>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>{m.amount.toLocaleString('en-US')} {contract.currency}</div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: mm.color }}>{mm.label}</span>
                        </div>
                      </div>

                      {stepIdx >= 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
                          {MILESTONE_STEPS.map((step, i) => (
                            <div key={step} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= stepIdx ? mm.color : 'var(--border)' }} />
                          ))}
                        </div>
                      )}

                      {/* ── ACTIONS ── */}
                      {isClient && m.status === 'pending' && !panelOpen && (
                        <button onClick={() => openFund(m)}
                          style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer' }}>
                          Fund this milestone
                        </button>
                      )}
                      {isFreelancer && m.status === 'funded' && !panelOpen && (
                        <button onClick={() => openDeliver(m)}
                          style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer' }}>
                          Mark as delivered
                        </button>
                      )}
                      {isClient && m.status === 'delivered' && (
                        <button onClick={() => approve(m.id)} disabled={busy === m.id}
                          style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: 'pointer' }}>
                          {busy === m.id ? '…' : 'Approve delivery'}
                        </button>
                      )}
                      {isFreelancer && m.status === 'delivered' && (
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>Waiting for the client to approve.</p>
                      )}
                      {isClient && m.status === 'approved' && (
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>Approved — waiting for the admin to process payout.</p>
                      )}
                      {isFreelancer && m.status === 'approved' && (
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>Approved — waiting for the admin to pay you out.</p>
                      )}

                      {/* FUND PANEL */}
                      {panelOpen && openPanel!.kind === 'fund' && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
                            <div>
                              <label style={label}>Amount</label>
                              <input type="number" value={fundForm.amount} onChange={e => setFundForm(f => ({ ...f, amount: e.target.value }))} style={input} />
                            </div>
                            <div>
                              <label style={label}>Currency</label>
                              <input value={fundForm.currency} onChange={e => setFundForm(f => ({ ...f, currency: e.target.value }))} style={input} />
                            </div>
                            <div>
                              <label style={label}>Method</label>
                              <select value={fundForm.method} onChange={e => setFundForm(f => ({ ...f, method: e.target.value }))} style={input}>
                                <option value="">Select…</option>
                                <option value="card_to_card">Card to card (Iran)</option>
                                <option value="bank_transfer">Bank transfer</option>
                                <option value="paypal">PayPal</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={label}>Reference / tracking no. (optional if you attach a receipt)</label>
                            <input value={fundForm.reference} onChange={e => setFundForm(f => ({ ...f, reference: e.target.value }))} style={input} />
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={label}>Receipt</label>
                            {receipt ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <a href={receipt.url} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: '#34D399', textDecoration: 'none' }}>📎 {receipt.name}</a>
                                <button onClick={() => setReceipt(null)} style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                              </div>
                            ) : (
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px dashed var(--border)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
                                📎 {uploading ? 'Uploading…' : 'Attach a receipt'}
                                <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, setReceipt); e.target.value = '' }} />
                              </label>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => submitFund(m.id)} disabled={busy === m.id}
                              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer' }}>
                              {busy === m.id ? 'Submitting…' : 'Submit payment'}
                            </button>
                            <button onClick={() => setOpenPanel(null)}
                              style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* DELIVER PANEL */}
                      {panelOpen && openPanel!.kind === 'deliver' && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={label}>Link to delivered work (optional if you attach a file)</label>
                            <input value={deliverUrl} onChange={e => setDeliverUrl(e.target.value)} placeholder="https://…" style={input} />
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={label}>Or attach a file</label>
                            {deliverFile ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <a href={deliverFile.url} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: '#34D399', textDecoration: 'none' }}>📎 {deliverFile.name}</a>
                                <button onClick={() => setDeliverFile(null)} style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                              </div>
                            ) : (
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px dashed var(--border)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
                                📎 {uploading ? 'Uploading…' : 'Attach a file'}
                                <input type="file" style={{ display: 'none' }}
                                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, setDeliverFile); e.target.value = '' }} />
                              </label>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => submitDeliver(m.id)} disabled={busy === m.id}
                              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer' }}>
                              {busy === m.id ? 'Submitting…' : 'Submit delivery'}
                            </button>
                            <button onClick={() => setOpenPanel(null)}
                              style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
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
