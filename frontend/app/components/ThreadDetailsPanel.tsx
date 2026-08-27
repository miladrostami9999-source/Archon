'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  ArrowUpRight, Calendar, CheckCircle2, Circle, Clock, DollarSign,
  MapPin, Star, Briefcase, Palette, Plus,
} from 'lucide-react'
import VerifiedBadge from './VerifiedBadge'
import LoadingState from './LoadingState'
import ProposeMilestoneModal from './ProposeMilestoneModal'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Milestone {
  id: number; title: string; description: string | null; amount: number
  due_date: string | null; status: string; deliverable_url: string | null
  proposed_by: number | null
}

// Ordered so the step tracker reads left-to-right as the money/work
// actually moves — matches the Activity-style progress on the full
// contract page, just compact enough for the sidebar.
const MILESTONE_STEPS = ['pending', 'funded', 'delivered', 'approved', 'released']

interface ContractDetail {
  id: number; project_id: number; project_title: string | null
  project_description: string | null; project_deadline: string | null
  project_category: string | null
  client_id: number; client_name: string | null; client_verified: boolean
  client_avatar: string; client_member_since: string | null
  freelancer_id: number; freelancer_name: string | null; freelancer_verified: boolean
  freelancer_avatar: string; freelancer_member_since: string | null
  total_amount: number; currency: string; status: string
  viewer_role: 'client' | 'freelancer' | 'observer'
  milestones: Milestone[]
}

interface MemberAbout {
  id: number; name: string; is_verified: boolean; account_mode: string
  avatar: string; bio: string; location: string
  skills: string[]; customSkills: string[]
  rating: number | null; review_count: number; completed_contracts: number
}

const MILESTONE_META: Record<string, { color: string; bg: string; label: string }> = {
  proposed:  { color: 'var(--warning)', bg: 'rgba(221,162,63,0.12)', label: 'Awaiting approval' },
  pending:   { color: 'var(--text-dim)', bg: 'var(--bg-input)', label: 'Not funded' },
  funded:    { color: 'var(--warning)', bg: 'rgba(221,162,63,0.12)', label: 'Funded' },
  delivered: { color: 'var(--accent)', bg: 'var(--accent-dim)', label: 'Delivered' },
  approved:  { color: 'var(--success)', bg: 'rgba(63,185,131,0.12)', label: 'Approved' },
  released:  { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', label: 'Paid out' },
  disputed:  { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Disputed' },
}

const CONTRACT_META: Record<string, { color: string; bg: string; label: string }> = {
  pending_approval: { color: 'var(--warning)', bg: 'rgba(221,162,63,0.12)', label: 'Awaiting approval' },
  active:    { color: 'var(--accent)', bg: 'var(--accent-dim)', label: 'Active' },
  completed: { color: 'var(--success)', bg: 'rgba(63,185,131,0.12)', label: 'Completed' },
  disputed:  { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Disputed' },
  cancelled: { color: 'var(--text-dim)', bg: 'var(--bg-input)', label: 'Cancelled' },
  declined:  { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Declined' },
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--text-dim)', margin: '0 0 10px',
}

function Avatar({ url, name, size = 40 }: { url?: string; name?: string | null; size?: number }) {
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.35, fontWeight: 700, color: 'white' }}>{initials}</span>}
    </div>
  )
}

/** Right-hand sidebar in Messages — inspired by Upwork's thread panel:
 * contract/project context, milestone + payment progress, and who you're
 * talking to. For a direct message with no contract yet, falls back to a
 * simple "about this person" card instead. */
export default function ThreadDetailsPanel({
  contractId, otherPartyId, currentUserId,
}: { contractId: number | null; otherPartyId: number; currentUserId: number | null }) {
  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [member, setMember] = useState<MemberAbout | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPropose, setShowPropose] = useState(false)
  const [milestoneBusy, setMilestoneBusy] = useState<number | null>(null)

  const loadContract = () => {
    if (!contractId) return
    axios.get(`${API}/marketplace/contracts/${contractId}`)
      .then(r => setContract(r.data)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true); setContract(null); setMember(null)
    if (contractId) {
      loadContract()
    } else {
      axios.get(`${API}/marketplace/members/${otherPartyId}`)
        .then(r => setMember(r.data)).catch(() => {}).finally(() => setLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, otherPartyId])

  const acceptMilestoneProposal = async (id: number) => {
    setMilestoneBusy(id)
    try { await axios.post(`${API}/marketplace/milestones/${id}/accept-proposal`); loadContract() } catch {}
    setMilestoneBusy(null)
  }
  const rejectMilestoneProposal = async (id: number) => {
    setMilestoneBusy(id)
    try { await axios.post(`${API}/marketplace/milestones/${id}/reject-proposal`); loadContract() } catch {}
    setMilestoneBusy(null)
  }
  const decideContract = async (decision: 'approve' | 'decline') => {
    if (!contract) return
    if (decision === 'decline' && !window.confirm('Decline this contract? The project will reopen for other freelancers.')) return
    setMilestoneBusy(-1)
    try { await axios.post(`${API}/marketplace/contracts/${contract.id}/${decision}`); loadContract() } catch {}
    setMilestoneBusy(null)
  }

  const card: React.CSSProperties = { borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px' }

  if (loading) {
    return <div style={{ width: '300px', flexShrink: 0, borderLeft: '1px solid var(--border)', padding: '30px 0' }}><LoadingState /></div>
  }

  if (contract) {
    const cm = CONTRACT_META[contract.status] || CONTRACT_META.active
    const otherIsClient = otherPartyId === contract.client_id
    const otherName = otherIsClient ? contract.client_name : contract.freelancer_name
    const otherAvatar = otherIsClient ? contract.client_avatar : contract.freelancer_avatar
    const otherVerified = otherIsClient ? contract.client_verified : contract.freelancer_verified
    const otherSince = otherIsClient ? contract.client_member_since : contract.freelancer_member_since
    const released = contract.milestones.filter(m => m.status === 'released').reduce((a, m) => a + m.amount, 0)
    const progressPct = contract.total_amount ? Math.min(100, Math.round((released / contract.total_amount) * 100)) : 0

    return (
      <>
      <div style={{ width: '300px', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg-main)', overflowY: 'auto', padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Other party */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Avatar url={otherAvatar} name={otherName} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {otherName || 'Unknown'}{otherVerified && <VerifiedBadge size={12} />}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{otherIsClient ? 'Client' : 'Freelancer'}</div>
              </div>
            </div>
            {otherSince && (
              <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>Member since {new Date(otherSince).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</p>
            )}
            <a href={`/members/${otherIsClient ? contract.client_id : contract.freelancer_id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', marginTop: '8px' }}>
              View profile <ArrowUpRight size={12} strokeWidth={1.75} />
            </a>
          </div>

          {/* Project & contract */}
          <div style={card}>
            <p style={sectionLabel}>Contract</p>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{contract.project_title || 'Direct contract'}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: cm.color, background: cm.bg, flexShrink: 0 }}>{cm.label}</span>
            </div>
            {contract.project_description && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {contract.project_description}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '10px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><DollarSign size={12} strokeWidth={1.75} />{contract.total_amount?.toLocaleString('en-US')} {contract.currency}</span>
              {contract.project_deadline && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Calendar size={12} strokeWidth={1.75} />Due {new Date(contract.project_deadline).toLocaleDateString()}</span>
              )}
            </div>
            <a href={`/contracts/${contract.id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
              Open contract <ArrowUpRight size={13} strokeWidth={1.75} />
            </a>
          </div>

          {/* Contract pending the freelancer's confirmation — nothing below
              (funding, delivering) is possible until this is resolved. */}
          {contract.status === 'pending_approval' && (
            <div style={{ ...card, border: '1px solid var(--warning)', background: 'rgba(221,162,63,0.08)' }}>
              {contract.viewer_role === 'freelancer' ? (
                <>
                  <p style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Confirm this contract to start work</p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => decideContract('approve')} disabled={milestoneBusy === -1}
                      style={{ flex: 1, padding: '7px', borderRadius: 'var(--radius-sm)', fontSize: '11.5px', fontWeight: 700, color: 'white', background: 'var(--success)', border: 'none', cursor: milestoneBusy === -1 ? 'wait' : 'pointer' }}>
                      Approve
                    </button>
                    <button onClick={() => decideContract('decline')} disabled={milestoneBusy === -1}
                      style={{ flex: 1, padding: '7px', borderRadius: 'var(--radius-sm)', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: milestoneBusy === -1 ? 'wait' : 'pointer' }}>
                      Decline
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Waiting for the freelancer to confirm the contract.</p>
              )}
            </div>
          )}

          {/* Payment progress */}
          <div style={card}>
            <p style={sectionLabel}>Payments</p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span className="mono" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{released.toLocaleString('en-US')} {contract.currency}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>of {contract.total_amount?.toLocaleString('en-US')} {contract.currency}</span>
            </div>
            <div style={{ height: '6px', borderRadius: '999px', background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, borderRadius: '999px', background: 'var(--accent)', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Milestones — the compact equivalent of Upwork's Activity tab:
              every milestone in order, each with its own step tracker. */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ ...sectionLabel, margin: 0 }}>Milestones {contract.milestones.length > 0 ? `(${contract.milestones.length})` : ''}</p>
              {contract.status === 'active' && contract.viewer_role !== 'observer' && (
                <button onClick={() => setShowPropose(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: 'var(--radius-sm)', fontSize: '10.5px', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-dim)', cursor: 'pointer' }}>
                  <Plus size={11} strokeWidth={2} /> Propose
                </button>
              )}
            </div>
            {contract.milestones.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>No milestones yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {contract.milestones.map((m, i) => {
                  const mm = MILESTONE_META[m.status] || MILESTONE_META.pending
                  const stepIdx = MILESTONE_STEPS.indexOf(m.status)
                  const isDone = m.status === 'released' || m.status === 'approved'
                  const canDecide = m.status === 'proposed' && m.proposed_by !== currentUserId
                  return (
                    <div key={m.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      {isDone
                        ? <CheckCircle2 size={14} strokeWidth={1.75} color="var(--success)" style={{ marginTop: '1px', flexShrink: 0 }} />
                        : <Circle size={14} strokeWidth={1.75} color="var(--text-dim)" style={{ marginTop: '1px', flexShrink: 0 }} />}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ fontSize: '12.5px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i + 1}. {m.title}</span>
                          <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>{m.amount.toLocaleString('en-US')}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', marginBottom: stepIdx >= 0 ? '5px' : 0 }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '999px', color: mm.color, background: mm.bg }}>{mm.label}</span>
                          {m.due_date && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', color: 'var(--text-dim)' }}><Clock size={10} strokeWidth={1.75} />{new Date(m.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                        {/* Step tracker — only meaningful once the milestone
                            is actually in the funded pipeline. */}
                        {stepIdx >= 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            {MILESTONE_STEPS.map((step, si) => (
                              <div key={step} style={{ flex: 1, height: '3px', borderRadius: '2px', background: si <= stepIdx ? mm.color : 'var(--border)' }} />
                            ))}
                          </div>
                        )}
                        {canDecide && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <button onClick={() => acceptMilestoneProposal(m.id)} disabled={milestoneBusy === m.id}
                              style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: '10.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: 'pointer' }}>
                              Accept
                            </button>
                            <button onClick={() => rejectMilestoneProposal(m.id)} disabled={milestoneBusy === m.id}
                              style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                              Decline
                            </button>
                          </div>
                        )}
                        {m.status === 'proposed' && m.proposed_by === currentUserId && (
                          <p style={{ fontSize: '10.5px', color: 'var(--text-dim)', margin: '4px 0 0' }}>Waiting for the other party.</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {showPropose && (
        <ProposeMilestoneModal
          contractId={contract.id}
          currency={contract.currency}
          onClose={() => setShowPropose(false)}
          onProposed={loadContract}
        />
      )}
      </>
    )
  }

  if (member) {
    const skills = [...(member.skills || []), ...(member.customSkills || [])].slice(0, 8)
    return (
      <div style={{ width: '300px', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg-main)', overflowY: 'auto', padding: '16px' }}>
        <div style={card}>
          <p style={sectionLabel}>About</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Avatar url={member.avatar} name={member.name} size={48} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {member.name}{member.is_verified && <VerifiedBadge size={12} />}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-dim)' }}>
                {member.account_mode === 'client' ? <Briefcase size={11} strokeWidth={1.75} /> : <Palette size={11} strokeWidth={1.75} />}
                {member.account_mode === 'client' ? 'Hires' : 'Takes work'}
              </div>
            </div>
          </div>
          {member.location && (
            <p style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
              <MapPin size={12} strokeWidth={1.5} />{member.location}
            </p>
          )}
          {member.bio && <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.55, margin: '0 0 12px' }}>{member.bio}</p>}
          {skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
              {skills.map(s => <span key={s} style={{ fontSize: '10.5px', background: 'var(--bg-tag)', color: 'var(--text-muted)', padding: '3px 8px', borderRadius: '999px' }}>{s}</span>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {member.rating && <Star size={11} strokeWidth={1.5} fill="currentColor" color="var(--warning)" />}
              {member.rating ? member.rating.toFixed(1) : 'No ratings'}{member.review_count > 0 ? ` (${member.review_count})` : ''}
            </span>
            <span>{member.completed_contracts} completed</span>
          </div>
          <a href={`/members/${member.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
            View full profile <ArrowUpRight size={13} strokeWidth={1.75} />
          </a>
        </div>
      </div>
    )
  }

  return null
}
