'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import MarketplaceBeta, { BetaTag } from '../components/MarketplaceBeta'
import { useIsMobile } from '../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Milestone {
  id: number
  title: string
  amount: number
  status: string
}

interface Contract {
  id: number
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

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  active:    { color: '#60A5FA', bg: 'rgba(79,123,247,0.12)', label: 'Active' },
  completed: { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Completed' },
  disputed:  { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Disputed' },
  cancelled: { color: 'var(--text-dim)', bg: 'var(--bg-input)', label: 'Cancelled' },
}

export default function ContractsPage() {
  const isMobile = useIsMobile()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API}/marketplace/contracts`)
      .then(r => setContracts(r.data))
      .catch((e) => { if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard' })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', height: '100vh', overflowY: 'auto', padding: isMobile ? '72px 16px 32px' : '32px 40px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>My Contracts</h1>
            <BetaTag />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px' }}>
            Every contract you're party to, whether you're the client or the freelancer.
          </p>

          <MarketplaceBeta />

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
          ) : contracts.length === 0 ? (
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
              No contracts yet. Accepting a proposal on a project you posted, or having your proposal accepted, creates one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '32px' }}>
              {contracts.map(c => {
                const sm = STATUS_META[c.status] || STATUS_META.active
                const otherParty = c.viewer_role === 'client' ? c.freelancer_name : c.client_name
                const fundedCount = c.milestones.filter(m => m.status !== 'pending').length
                return (
                  <a key={c.id} href={`/contracts/${c.id}`}
                    style={{ display: 'block', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 18px', textDecoration: 'none', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.35)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text)' }}>{c.project_title || `Contract #${c.id}`}</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', textTransform: 'capitalize' }}>You're the {c.viewer_role}</span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>
                          With{' '}
                          <span onClick={e => { e.preventDefault(); e.stopPropagation(); window.location.href = `/members/${c.viewer_role === 'client' ? c.freelancer_id : c.client_id}` }}
                            style={{ cursor: 'pointer', color: '#60A5FA' }}>{otherParty || 'the other party'}</span>
                          {' '}· {c.total_amount?.toLocaleString('en-US')} {c.currency}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '12px', color: 'var(--text-dim)' }}>
                        {fundedCount}/{c.milestones.length} milestones moved
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
