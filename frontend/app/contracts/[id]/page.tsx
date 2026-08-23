'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import MarketplaceBeta from '../../components/MarketplaceBeta'
import ContractChat from '../../components/ContractChat'
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

interface Review {
  id: number
  contract_id: number
  reviewer_id: number
  reviewer_name: string | null
  reviewee_id: number
  rating: number
  comment: string | null
  created_at: string
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
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)

  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewHover, setReviewHover] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewMsg, setReviewMsg] = useState('')

  // Where the client actually sends the money. Without these on screen the
  // Fund panel asks for a transfer without saying where to.
  const [pay, setPay] = useState<{
    card_number: string; card_holder: string; paypal_email: string
    support_email: string; support_phone: string
  } | null>(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    axios.get(`${API}/auth/payment-methods`).then(r => setPay(r.data)).catch(() => {})
  }, [])

  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(''), 1800)
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem('archon-user')
      if (stored) setCurrentUserId(JSON.parse(stored).id)
    } catch {}
  }, [])

  const load = () => {
    if (!id) return
    axios.get(`${API}/marketplace/contracts/${id}`)
      .then(r => {
        setContract(r.data)
        if (r.data.status === 'completed') {
          axios.get(`${API}/marketplace/contracts/${id}/reviews`).then(rv => setReviews(rv.data)).catch(() => {})
        }
      })
      .catch((e) => {
        if (e.response?.status === 404) setNotFound(true)
        else if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard'
      })
      .finally(() => setLoading(false))
  }
  // The contract changes underneath you — the other party delivers, an admin
  // confirms a payment — so the page keeps itself current instead of making
  // people reload to find out. Skipped while a form panel is open so a poll
  // can't wipe what someone is halfway through typing.
  useEffect(() => {
    load()
    const timer = setInterval(() => { if (!openPanel) load() }, 6000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, openPanel])

  const submitReview = async () => {
    if (!reviewRating) { setReviewMsg('✗ Pick a star rating'); return }
    setReviewBusy(true); setReviewMsg('')
    try {
      await axios.post(`${API}/marketplace/contracts/${id}/review`, { rating: reviewRating, comment: reviewComment.trim() || null })
      setReviewComment('')
      load()
    } catch (e: any) { setReviewMsg(`✗ ${e.response?.data?.detail || 'Could not submit review'}`) }
    setReviewBusy(false)
  }

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

          <MarketplaceBeta />

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
                          {/* Send the money first, then record it here. */}
                          {pay && (pay.card_number || pay.paypal_email) ? (
                            <div style={{ borderRadius: '10px', border: '1px solid rgba(79,123,247,0.25)', background: 'rgba(79,123,247,0.06)', padding: '12px 14px', marginBottom: '14px' }}>
                              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60A5FA', margin: '0 0 8px' }}>
                                Step 1 — transfer {m.amount.toLocaleString('en-US')} {contract.currency}
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {pay.card_number && (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                    <div>
                                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Card to card (Iran)</div>
                                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.04em' }}>{pay.card_number}</div>
                                      {pay.card_holder && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{pay.card_holder}</div>}
                                    </div>
                                    <button onClick={() => copy('card', pay.card_number)}
                                      style={{ fontSize: '11px', fontWeight: 600, padding: '5px 11px', borderRadius: '7px', cursor: 'pointer', color: copied === 'card' ? '#34D399' : '#60A5FA', background: 'transparent', border: `1px solid ${copied === 'card' ? 'rgba(52,211,153,0.4)' : 'rgba(79,123,247,0.3)'}` }}>
                                      {copied === 'card' ? '✓ Copied' : 'Copy'}
                                    </button>
                                  </div>
                                )}
                                {pay.paypal_email && (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', paddingTop: pay.card_number ? '8px' : 0, borderTop: pay.card_number ? '1px solid var(--border)' : 'none' }}>
                                    <div>
                                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PayPal</div>
                                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>{pay.paypal_email}</div>
                                    </div>
                                    <button onClick={() => copy('paypal', pay.paypal_email)}
                                      style={{ fontSize: '11px', fontWeight: 600, padding: '5px 11px', borderRadius: '7px', cursor: 'pointer', color: copied === 'paypal' ? '#34D399' : '#60A5FA', background: 'transparent', border: `1px solid ${copied === 'paypal' ? 'rgba(52,211,153,0.4)' : 'rgba(79,123,247,0.3)'}` }}>
                                      {copied === 'paypal' ? '✓ Copied' : 'Copy'}
                                    </button>
                                  </div>
                                )}
                              </div>
                              <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '10px 0 0', lineHeight: 1.6 }}>
                                Archon holds the money and releases it to the freelancer once you approve their delivery.
                                {(pay.support_email || pay.support_phone) && <> Questions? {pay.support_email}{pay.support_email && pay.support_phone ? ' · ' : ''}{pay.support_phone}</>}
                              </p>
                            </div>
                          ) : (
                            <div style={{ borderRadius: '10px', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.07)', padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: '#FBBF24', lineHeight: 1.6 }}>
                              No payment details are configured yet — an admin needs to add them in the Admin Panel before anyone can fund a milestone.
                            </div>
                          )}
                          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', margin: '0 0 8px' }}>
                            Step 2 — record what you sent
                          </p>
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

              {contract.status === 'completed' && currentUserId && contract.viewer_role !== 'observer' && (() => {
                const myReview = reviews.find(r => r.reviewer_id === currentUserId)
                const theirReview = reviews.find(r => r.reviewer_id !== currentUserId)
                return (
                  <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: '18px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '12px' }}>
                      Review
                    </p>
                    {myReview ? (
                      <div style={{ marginBottom: theirReview ? '14px' : 0 }}>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 4px' }}>Your review:</p>
                        <div style={{ fontSize: '15px', color: '#FBBF24' }}>{'★'.repeat(myReview.rating)}{'☆'.repeat(5 - myReview.rating)}</div>
                        {myReview.comment && <p style={{ fontSize: '13px', color: 'var(--text)', margin: '6px 0 0' }}>{myReview.comment}</p>}
                      </div>
                    ) : (
                      <div style={{ marginBottom: theirReview ? '14px' : 0 }}>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                          How was working with {contract.viewer_role === 'client' ? contract.freelancer_name : contract.client_name}?
                        </p>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <button key={n} onClick={() => setReviewRating(n)}
                              onMouseEnter={() => setReviewHover(n)} onMouseLeave={() => setReviewHover(0)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1, color: n <= (reviewHover || reviewRating) ? '#FBBF24' : 'var(--border)' }}>
                              ★
                            </button>
                          ))}
                        </div>
                        <textarea rows={2} value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                          placeholder="Optional comment"
                          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', resize: 'vertical', marginBottom: '10px' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button onClick={submitReview} disabled={reviewBusy}
                            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer', opacity: reviewBusy ? 0.6 : 1 }}>
                            {reviewBusy ? 'Submitting…' : 'Submit review'}
                          </button>
                          {reviewMsg && <span style={{ fontSize: '12px', color: '#F87171' }}>{reviewMsg}</span>}
                        </div>
                      </div>
                    )}
                    {theirReview && (
                      <div style={{ paddingTop: myReview ? '14px' : 0, borderTop: myReview ? '1px solid var(--border)' : 'none' }}>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 4px' }}>{theirReview.reviewer_name} said:</p>
                        <div style={{ fontSize: '15px', color: '#FBBF24' }}>{'★'.repeat(theirReview.rating)}{'☆'.repeat(5 - theirReview.rating)}</div>
                        {theirReview.comment && <p style={{ fontSize: '13px', color: 'var(--text)', margin: '6px 0 0' }}>{theirReview.comment}</p>}
                      </div>
                    )}
                  </div>
                )
              })()}

              {currentUserId && contract.viewer_role !== 'observer' && (
                <div style={{ paddingBottom: '32px' }}>
                  <ContractChat contractId={contract.id} currentUserId={currentUserId} />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
