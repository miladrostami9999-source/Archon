'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import MarketplaceBeta, { BetaTag } from '../components/MarketplaceBeta'
import VerifiedBadge from '../components/VerifiedBadge'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import ContractPreviewDrawer from '../components/ContractPreviewDrawer'
import { useIsMobile } from '../hooks/useIsMobile'
import { FileCheck2 } from 'lucide-react'

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
  project_description: string | null
  project_deadline: string | null
  project_category: string | null
  client_id: number
  client_name: string | null
  client_verified: boolean
  client_avatar: string
  freelancer_id: number
  freelancer_name: string | null
  freelancer_verified: boolean
  freelancer_avatar: string
  total_amount: number | null
  currency: string
  status: string
  created_at: string
  viewer_role: 'client' | 'freelancer' | 'observer'
  milestones: Milestone[]
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  active:    { color: 'var(--accent)', bg: 'var(--accent-dim)', label: 'Active' },
  completed: { color: 'var(--success)', bg: 'rgba(63,185,131,0.12)', label: 'Completed' },
  disputed:  { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Disputed' },
  cancelled: { color: 'var(--text-dim)', bg: 'var(--bg-input)', label: 'Cancelled' },
}

export default function ContractsPage() {
  const isMobile = useIsMobile()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [previewContract, setPreviewContract] = useState<Contract | null>(null)
  const [accountMode, setAccountMode] = useState<'freelancer' | 'client' | null>(null)

  useEffect(() => {
    axios.get(`${API}/auth/me`).then(r => setAccountMode(r.data.account_mode === 'client' ? 'client' : 'freelancer')).catch(() => setAccountMode('freelancer'))
  }, [])

  useEffect(() => {
    // Wait for the account mode to resolve so the very first fetch is
    // already scoped — a client dashboard has no business listing a
    // contract this account is the freelancer on, and vice versa.
    if (!accountMode) return
    axios.get(`${API}/marketplace/contracts`, { params: { role: accountMode } })
      .then(r => setContracts(r.data))
      .catch((e) => { if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard' })
      .finally(() => setLoading(false))
  }, [accountMode])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', minWidth: 0, marginTop: isMobile ? '52px' : 0, height: isMobile ? 'calc(100vh - 52px)' : '100vh', overflowY: 'auto' }}>

        <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '0 16px' : '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>My Contracts</h1>
          <BetaTag />
        </div>

        <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', maxWidth: '860px', margin: '0 auto' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px' }}>
            Every contract you're party to, whether you're the client or the freelancer.
          </p>

          <MarketplaceBeta />

          {loading ? (
            <LoadingState fullPage />
          ) : contracts.length === 0 ? (
            <EmptyState icon={FileCheck2} title="No contracts yet"
              description="Accepting a proposal on a project you posted, or having your proposal accepted, creates one." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '32px' }}>
              {contracts.map(c => {
                const sm = STATUS_META[c.status] || STATUS_META.active
                const otherParty = c.viewer_role === 'client' ? c.freelancer_name : c.client_name
                const otherPartyVerified = c.viewer_role === 'client' ? c.freelancer_verified : c.client_verified
                const fundedCount = c.milestones.filter(m => m.status !== 'pending').length
                return (
                  <a key={c.id} href={`/contracts/${c.id}`}
                    onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); setPreviewContract(c) } }}
                    style={{ display: 'block', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 18px', textDecoration: 'none', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
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
                            style={{ cursor: 'pointer', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{otherParty || 'the other party'}{otherPartyVerified && <VerifiedBadge size={11} />}</span>
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
      </div>
      <ContractPreviewDrawer contract={previewContract} onClose={() => setPreviewContract(null)} />
    </div>
  )
}
