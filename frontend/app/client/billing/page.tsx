'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Wallet, Check, Receipt, Paperclip, CircleDollarSign } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Payment {
  id: number
  milestone_title: string
  contract_id: number
  project_title: string
  amount: number
  currency: string
  method: string | null
  status: string
  created_at: string
  reviewed_at: string | null
}

interface PayMethods {
  card_number: string; card_holder: string; paypal_email: string
  support_email: string; support_phone: string
}

interface UnfundedMilestone {
  id: number
  title: string
  amount: number
  contract_id: number
  project_title: string
  currency: string
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending:  { color: 'var(--warning)', bg: 'rgba(221,162,63,0.12)', label: 'Awaiting confirmation' },
  approved: { color: 'var(--success)', bg: 'rgba(63,185,131,0.12)', label: 'Confirmed' },
  rejected: { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Rejected' },
}

const card: React.CSSProperties = { borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: '16px' }

export default function ClientBillingPage() {
  const isMobile = useIsMobile()
  const [payments, setPayments] = useState<Payment[]>([])
  const [approvedTotal, setApprovedTotal] = useState(0)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [pay, setPay] = useState<PayMethods | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState('')
  const [unfunded, setUnfunded] = useState<UnfundedMilestone[]>([])
  const [openFund, setOpenFund] = useState<UnfundedMilestone | null>(null)
  const [fundForm, setFundForm] = useState({ amount: '', method: '', reference: '', note: '' })
  const [receipt, setReceipt] = useState<{ url: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fundMsg, setFundMsg] = useState('')

  const load = () => {
    Promise.all([
      axios.get(`${API}/marketplace/billing/history`),
      axios.get(`${API}/auth/payment-methods`).catch(() => ({ data: null })),
      axios.get(`${API}/marketplace/contracts`, { params: { role: 'client', status: 'active' } }),
    ])
      .then(([billing, methods, contracts]) => {
        setPayments(billing.data.payments)
        setApprovedTotal(billing.data.approved_total)
        setPendingTotal(billing.data.pending_total)
        setPay(methods.data)
        const rows: UnfundedMilestone[] = []
        for (const c of contracts.data as any[]) {
          for (const m of c.milestones) {
            if (m.status === 'pending') {
              rows.push({ id: m.id, title: m.title, amount: m.amount, contract_id: c.id, project_title: c.project_title, currency: c.currency })
            }
          }
        }
        setUnfunded(rows)
      })
      .catch((e) => { if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard' })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(''), 1800)
  }

  const startFund = (m: UnfundedMilestone) => {
    setOpenFund(m)
    setFundForm({ amount: String(m.amount), method: '', reference: '', note: '' })
    setReceipt(null)
    setFundMsg('')
  }

  const uploadReceipt = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await axios.post(`${API}/auth/upload/receipt`, fd)
      setReceipt({ url: r.data.url, name: file.name })
    } catch (e: any) {
      setFundMsg(e.response?.data?.detail || 'Upload failed')
    }
    setUploading(false)
  }

  const submitFund = async () => {
    if (!openFund) return
    if (!fundForm.reference.trim() && !receipt) { setFundMsg('Attach a receipt or enter a tracking number'); return }
    setSubmitting(true); setFundMsg('')
    try {
      await axios.post(`${API}/marketplace/milestones/${openFund.id}/fund`, {
        amount: Number(fundForm.amount),
        currency: openFund.currency,
        method: fundForm.method || null,
        reference: fundForm.reference || null,
        receipt_url: receipt?.url || null,
        note: fundForm.note || null,
      })
      setOpenFund(null)
      load()
    } catch (e: any) { setFundMsg(e.response?.data?.detail || 'Could not submit payment') }
    setSubmitting(false)
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '9px 11px',
    fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  }
  const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', marginTop: isMobile ? '52px' : 0, padding: isMobile ? '20px 16px 40px' : '32px 40px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>Billing</h1>

          {loading ? (
            <LoadingState fullPage />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={card}>
                  <Wallet size={16} strokeWidth={1.75} color="var(--text-dim)" />
                  <div className="mono" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '8px 0 2px' }}>{approvedTotal.toLocaleString('en-US')} USD</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>Confirmed spend</div>
                </div>
                <div style={card}>
                  <Receipt size={16} strokeWidth={1.75} color="var(--text-dim)" />
                  <div className="mono" style={{ fontSize: '22px', fontWeight: 700, color: pendingTotal > 0 ? 'var(--warning)' : 'var(--text)', margin: '8px 0 2px' }}>{pendingTotal.toLocaleString('en-US')} USD</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>Awaiting confirmation</div>
                </div>
              </div>

              {/* Where to actually send money — reused verbatim from the
                  Fund-milestone panel on the contract page, since it's the
                  same studio-held payee info either way. */}
              {pay && (pay.card_number || pay.paypal_email) && (
                <div style={{ ...card, border: '1px solid var(--accent-dim)', background: 'rgba(61,79,224,0.06)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 12px' }}>Where to send funds</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pay.card_number && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Card to card (Iran)</div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.04em' }}>{pay.card_number}</div>
                          {pay.card_holder && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{pay.card_holder}</div>}
                        </div>
                        <button onClick={() => copy('card', pay.card_number)}
                          style={{ fontSize: '11px', fontWeight: 600, padding: '5px 11px', borderRadius: '7px', cursor: 'pointer', color: copied === 'card' ? 'var(--success)' : 'var(--accent)', background: 'transparent', border: `1px solid ${copied === 'card' ? 'rgba(63,185,131,0.4)' : 'var(--accent-dim)'}` }}>
                          {copied === 'card' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Check size={11} strokeWidth={2} />Copied</span> : 'Copy'}
                        </button>
                      </div>
                    )}
                    {pay.paypal_email && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', paddingTop: pay.card_number ? '10px' : 0, borderTop: pay.card_number ? '1px solid var(--border)' : 'none' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PayPal</div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>{pay.paypal_email}</div>
                        </div>
                        <button onClick={() => copy('paypal', pay.paypal_email)}
                          style={{ fontSize: '11px', fontWeight: 600, padding: '5px 11px', borderRadius: '7px', cursor: 'pointer', color: copied === 'paypal' ? 'var(--success)' : 'var(--accent)', background: 'transparent', border: `1px solid ${copied === 'paypal' ? 'rgba(63,185,131,0.4)' : 'var(--accent-dim)'}` }}>
                          {copied === 'paypal' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Check size={11} strokeWidth={2} />Copied</span> : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '10px 0 0', lineHeight: 1.6 }}>
                    Fund each milestone from its contract page — this is just where the money goes.
                    {(pay.support_email || pay.support_phone) && <> Questions? {pay.support_email}{pay.support_email && pay.support_phone ? ' · ' : ''}{pay.support_phone}</>}
                  </p>
                </div>
              )}

              {unfunded.length > 0 && (
                <>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', margin: '20px 0 10px' }}>Awaiting payment ({unfunded.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    {unfunded.map(m => (
                      <div key={m.id} style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '12px 16px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{m.title}</div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{m.project_title}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <span className="mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{m.amount.toLocaleString('en-US')} {m.currency}</span>
                            {openFund?.id !== m.id && (
                              <button onClick={() => startFund(m)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer' }}>
                                <CircleDollarSign size={13} strokeWidth={1.75} /> Submit payment proof
                              </button>
                            )}
                          </div>
                        </div>

                        {openFund?.id === m.id && (
                          <div style={{ padding: '0 16px 16px' }}>
                            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label style={label}>Amount</label>
                                  <input type="number" value={fundForm.amount} onChange={e => setFundForm(f => ({ ...f, amount: e.target.value }))} style={input} />
                                </div>
                                <div>
                                  <label style={label}>Method</label>
                                  <select value={fundForm.method} onChange={e => setFundForm(f => ({ ...f, method: e.target.value }))} style={input}>
                                    <option value="">Select…</option>
                                    <option value="card_to_card">Card to card</option>
                                    <option value="bank_transfer">Bank transfer</option>
                                    <option value="paypal">PayPal</option>
                                    <option value="other">Other</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={label}>Reference no.</label>
                                  <input value={fundForm.reference} onChange={e => setFundForm(f => ({ ...f, reference: e.target.value }))} style={input} />
                                </div>
                              </div>
                              <div style={{ marginBottom: '10px' }}>
                                <label style={label}>Receipt / proof of payment</label>
                                {receipt ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <a href={receipt.url} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: 'var(--success)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Paperclip size={12} strokeWidth={1.75} />{receipt.name}</a>
                                    <button onClick={() => setReceipt(null)} style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                                  </div>
                                ) : (
                                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px dashed var(--border)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
                                    <Paperclip size={12} strokeWidth={1.75} />{uploading ? 'Uploading…' : 'Attach a receipt or screenshot'}
                                    <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadReceipt(f); e.target.value = '' }} />
                                  </label>
                                )}
                              </div>
                              {fundMsg && <p style={{ fontSize: '12px', color: 'var(--error)', margin: '0 0 10px' }}>{fundMsg}</p>}
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={submitFund} disabled={submitting}
                                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
                                  {submitting ? 'Submitting…' : 'Submit payment'}
                                </button>
                                <button onClick={() => setOpenFund(null)}
                                  style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', margin: '20px 0 10px' }}>Payment history</p>
              {payments.length === 0 ? (
                <EmptyState icon={Receipt} title="No payments yet" description="Milestone payments you submit will show up here." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '32px' }}>
                  {payments.map(p => {
                    const sm = STATUS_META[p.status] || STATUS_META.pending
                    return (
                      <a key={p.id} href={`/contracts/${p.contract_id}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 16px', textDecoration: 'none' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{p.milestone_title}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{p.project_title} · {new Date(p.created_at).toLocaleDateString()}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                          <span className="mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{p.amount.toLocaleString('en-US')} {p.currency}</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
