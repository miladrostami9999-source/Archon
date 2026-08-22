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

  useEffect(() => {
    if (!id) return
    axios.get(`${API}/marketplace/contracts/${id}`)
      .then(r => setContract(r.data))
      .catch((e) => {
        if (e.response?.status === 404) setNotFound(true)
        else if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard'
      })
      .finally(() => setLoading(false))
  }, [id])

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

              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '10px' }}>
                Milestones
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '32px' }}>
                {contract.milestones.map(m => {
                  const mm = MILESTONE_META[m.status] || MILESTONE_META.pending
                  const stepIdx = MILESTONE_STEPS.indexOf(m.status)
                  return (
                    <div key={m.id} style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <div>
                          <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>{m.title}</span>
                          {m.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{m.description}</p>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>{m.amount.toLocaleString('en-US')} {contract.currency}</div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: mm.color }}>{mm.label}</span>
                        </div>
                      </div>
                      {/* Simple step tracker — fund/deliver/release actions are
                          a later phase; this just shows where the milestone
                          sits in that flow. */}
                      {stepIdx >= 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {MILESTONE_STEPS.map((step, i) => (
                            <div key={step} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= stepIdx ? mm.color : 'var(--border)' }} />
                          ))}
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
