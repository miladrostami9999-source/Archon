'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Wallet, Check, Receipt } from 'lucide-react'

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

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/marketplace/billing/history`),
      axios.get(`${API}/auth/payment-methods`).catch(() => ({ data: null })),
    ])
      .then(([billing, methods]) => {
        setPayments(billing.data.payments)
        setApprovedTotal(billing.data.approved_total)
        setPendingTotal(billing.data.pending_total)
        setPay(methods.data)
      })
      .catch((e) => { if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard' })
      .finally(() => setLoading(false))
  }, [])

  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(''), 1800)
  }

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
