'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import VerifiedBadge from '../components/VerifiedBadge'
import LoadingState from '../components/LoadingState'
import { useIsMobile } from '../hooks/useIsMobile'
import { Briefcase, Inbox, FileCheck2, Wallet, Star, Plus, MessageCircle, ArrowRight, Rocket } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Project {
  id: number
  title: string
  status: string
  proposal_count: number
  client_rating: number | null
  client_review_count: number
}

interface ProposalRow {
  id: number
  project_id: number
  project_title: string
  project_currency: string
  freelancer_name: string | null
  freelancer_verified: boolean
  proposed_amount: number | null
  created_at: string
}

interface Conversation {
  conversation_id: number
  other_party_name: string | null
  last_message: string | null
  unread: number
}

const card: React.CSSProperties = { borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '18px' }

export default function ClientOverviewPage() {
  const isMobile = useIsMobile()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [recentProposals, setRecentProposals] = useState<ProposalRow[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [spendApproved, setSpendApproved] = useState(0)
  const [contractsActive, setContractsActive] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/marketplace/projects`, { params: { mine: true } }),
      axios.get(`${API}/marketplace/proposals/pending-count`),
      axios.get(`${API}/marketplace/proposals/inbox`, { params: { status: 'pending', sort: 'newest' } }),
      axios.get(`${API}/marketplace/conversations`, { params: { role: 'client' } }),
      axios.get(`${API}/marketplace/billing/history`),
      axios.get(`${API}/marketplace/contracts`, { params: { role: 'client' } }),
    ])
      .then(([proj, pending, inbox, convos, billing, contracts]) => {
        setProjects(proj.data)
        setPendingCount(pending.data.count || 0)
        setRecentProposals(inbox.data.slice(0, 5))
        setConversations(convos.data.slice(0, 5))
        setSpendApproved(billing.data.approved_total || 0)
        setContractsActive((contracts.data as any[]).filter(c => c.status === 'active').length)
      })
      .catch((e) => { if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard' })
      .finally(() => setLoading(false))
  }, [])

  const openCount = projects?.filter(p => p.status === 'open').length || 0
  const rating = projects?.find(p => p.client_review_count > 0)
  const unreadTotal = conversations.reduce((a, c) => a + c.unread, 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', marginTop: isMobile ? '52px' : 0, padding: isMobile ? '20px 16px 40px' : '32px 40px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>Client Overview</h1>

          {loading ? (
            <LoadingState fullPage />
          ) : (
            <>
              {/* A small landing-page-style section, not just a button — the
                  one on-ramp into the whole client dashboard, so it gets
                  real visual weight instead of competing with the KPI row. */}
              <div style={{
                borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-dim)', background: 'linear-gradient(135deg, rgba(61,79,224,0.08), rgba(46,59,176,0.03))',
                padding: isMobile ? '24px 20px' : '32px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' }}>
                    <Rocket size={22} strokeWidth={1.75} color="white" />
                  </div>
                  <div>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: '0 0 3px' }}>
                      {projects && projects.length === 0 ? 'Create your first project' : 'Ready to hire again?'}
                    </p>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                      {projects && projects.length === 0
                        ? 'Describe what you need done and start receiving proposals from freelancers today.'
                        : 'Post a new project and start receiving proposals from freelancers.'}
                    </p>
                  </div>
                </div>
                <a href="/projects"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 26px', borderRadius: 'var(--radius-md)', fontSize: '14.5px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', textDecoration: 'none', flexShrink: 0, boxShadow: '0 4px 16px rgba(61,79,224,0.35)' }}>
                  <Plus size={16} strokeWidth={2.25} /> Post a Project
                </a>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <a href="/projects" style={{ ...card, textDecoration: 'none' }}>
                  <Briefcase size={16} strokeWidth={1.75} color="var(--text-dim)" />
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '8px 0 2px' }}>{openCount}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>Open projects</div>
                </a>
                <a href="/projects?tab=proposals" style={{ ...card, textDecoration: 'none', position: 'relative' }}>
                  <Inbox size={16} strokeWidth={1.75} color="var(--text-dim)" />
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: pendingCount > 0 ? 'var(--warning)' : 'var(--text)', margin: '8px 0 2px' }}>{pendingCount}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>Pending proposals</div>
                </a>
                <a href="/contracts" style={{ ...card, textDecoration: 'none' }}>
                  <FileCheck2 size={16} strokeWidth={1.75} color="var(--text-dim)" />
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '8px 0 2px' }}>{contractsActive}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>Active contracts</div>
                </a>
                <a href="/client/billing" style={{ ...card, textDecoration: 'none' }}>
                  <Wallet size={16} strokeWidth={1.75} color="var(--text-dim)" />
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '8px 0 2px' }}>{spendApproved >= 1000 ? `$${(spendApproved / 1000).toFixed(1)}K` : `$${Math.round(spendApproved)}`}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>Total spent</div>
                </a>
              </div>

              {rating?.client_review_count ? (
                <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <Star size={16} strokeWidth={1.75} fill="currentColor" color="var(--warning)" />
                  <span style={{ fontSize: '13.5px', color: 'var(--text)', fontWeight: 600 }}>{rating.client_rating?.toFixed(1)}</span>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>({rating.client_review_count} reviews from freelancers you've hired)</span>
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', margin: 0 }}>Recent proposals</p>
                    <a href="/projects?tab=proposals" style={{ fontSize: '11.5px', color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>All <ArrowRight size={11} strokeWidth={2} /></a>
                  </div>
                  {recentProposals.length === 0 ? (
                    <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: 0 }}>No pending proposals right now.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {recentProposals.map(p => (
                        <a key={p.id} href={`/projects/${p.project_id}`} style={{ textDecoration: 'none', display: 'block' }}>
                          <div style={{ fontSize: '12.5px', color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {p.freelancer_name || 'Freelancer'}{p.freelancer_verified && <VerifiedBadge size={11} />}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                            {p.project_title} · {p.proposed_amount?.toLocaleString('en-US')} {p.project_currency}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', margin: 0 }}>Messages</p>
                    <a href="/messages" style={{ fontSize: '11.5px', color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>All <ArrowRight size={11} strokeWidth={2} /></a>
                  </div>
                  {conversations.length === 0 ? (
                    <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: 0 }}>No conversations yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {conversations.map(c => (
                        <a key={c.conversation_id} href="/messages" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MessageCircle size={13} strokeWidth={1.75} color={c.unread > 0 ? 'var(--accent)' : 'var(--text-dim)'} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '12.5px', color: 'var(--text)', fontWeight: c.unread > 0 ? 700 : 500 }}>{c.other_party_name || 'Unknown'}</div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.last_message || 'No messages yet'}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
