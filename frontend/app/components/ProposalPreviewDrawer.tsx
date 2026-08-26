'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { X, ArrowUpRight, Star, CheckCircle2, Paperclip, MessageCircle } from 'lucide-react'
import VerifiedBadge from './VerifiedBadge'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ProposalRow {
  id: number
  project_id: number
  project_title: string
  project_currency: string
  freelancer_id: number
  freelancer_name: string | null
  freelancer_verified: boolean
  freelancer_avatar: string
  freelancer_headline: string
  freelancer_rating: number | null
  freelancer_review_count: number
  freelancer_completed_contracts: number
  cover_letter: string | null
  attachment_urls: string[]
  highlighted_portfolio: { id: string; title: string; image?: string }[]
  proposed_amount: number | null
  proposed_days: number | null
  status: string
}

const PROPOSAL_STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending:   { color: 'var(--warning)', bg: 'rgba(221,162,63,0.12)', label: 'Pending' },
  accepted:  { color: 'var(--success)', bg: 'rgba(63,185,131,0.12)', label: 'Accepted' },
  rejected:  { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Rejected' },
  withdrawn: { color: 'var(--text-dim)', bg: 'var(--bg-input)', label: 'Withdrawn' },
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--text-dim)', margin: '0 0 10px',
}
const section: React.CSSProperties = { padding: '18px 24px', borderTop: '1px solid var(--border)' }

/** Full-width read of one proposal — everything a client needs to decide
 * whether to hire this freelancer, without leaving the Proposals inbox:
 * their track record, the full cover letter, every attachment and
 * portfolio highlight, plus a way to talk to them before committing. */
export default function ProposalPreviewDrawer({
  proposal, onClose, onAccept, onReject, busy,
}: {
  proposal: ProposalRow | null
  onClose: () => void
  onAccept: (id: number) => void
  onReject: (id: number) => void
  busy: boolean
}) {
  const [messaging, setMessaging] = useState(false)

  useEffect(() => {
    if (!proposal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [proposal, onClose])

  if (!proposal) return null

  const pm = PROPOSAL_STATUS_META[proposal.status] || PROPOSAL_STATUS_META.pending
  const initials = (proposal.freelancer_name || 'F').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const messageFreelancer = async () => {
    setMessaging(true)
    try {
      await axios.post(`${API}/marketplace/conversations/start`, { user_id: proposal.freelancer_id })
      window.location.href = '/messages'
    } catch {
      setMessaging(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: '540px', maxWidth: '100%',
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 61,
        display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        animation: 'proposalDrawerSlideIn 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Proposal</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', borderRadius: 'var(--radius-sm)' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Freelancer header */}
          <div style={{ padding: '20px 24px 18px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' }}>
              {proposal.freelancer_avatar
                ? <img src={proposal.freelancer_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '17px', fontWeight: 700, color: 'white' }}>{initials}</span>}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                <a href={`/members/${proposal.freelancer_id}`} style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  {proposal.freelancer_name || 'Freelancer'}{proposal.freelancer_verified && <VerifiedBadge size={13} />}
                </a>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', color: pm.color, background: pm.bg }}>{pm.label}</span>
              </div>
              {proposal.freelancer_headline && <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '0 0 6px' }}>{proposal.freelancer_headline}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                {proposal.freelancer_review_count > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--warning)' }}><Star size={13} strokeWidth={1.75} fill="currentColor" />{proposal.freelancer_rating} <span style={{ color: 'var(--text-dim)' }}>({proposal.freelancer_review_count})</span></span>
                ) : (
                  <span style={{ color: 'var(--text-dim)' }}>No reviews yet</span>
                )}
                {proposal.freelancer_completed_contracts > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={13} strokeWidth={1.75} />{proposal.freelancer_completed_contracts} completed</span>
                )}
              </div>
            </div>
          </div>

          {/* Terms */}
          <div style={section}>
            <p style={sectionLabel}>Proposed terms</p>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
              {proposal.proposed_amount?.toLocaleString('en-US')} {proposal.project_currency}
              {proposal.proposed_days ? <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '13px' }}> · {proposal.proposed_days} days</span> : null}
            </div>
            <a href={`/projects/${proposal.project_id}`} style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
              {proposal.project_title} <ArrowUpRight size={12} strokeWidth={1.75} />
            </a>
          </div>

          {/* Cover letter */}
          {proposal.cover_letter && (
            <div style={section}>
              <p style={sectionLabel}>Cover letter</p>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{proposal.cover_letter}</p>
            </div>
          )}

          {/* Attachments */}
          {proposal.attachment_urls?.length > 0 && (
            <div style={section}>
              <p style={sectionLabel}>Attachments ({proposal.attachment_urls.length})</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {proposal.attachment_urls.map((url, i) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={13} strokeWidth={1.75} />Attachment {proposal.attachment_urls.length > 1 ? i + 1 : ''}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio highlights */}
          {proposal.highlighted_portfolio?.length > 0 && (
            <div style={section}>
              <p style={sectionLabel}>Portfolio highlights</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {proposal.highlighted_portfolio.map(h => (
                  <div key={h.id} title={h.title} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                    <div style={{ width: '100%', aspectRatio: '4/3' }}>
                      {h.image
                        ? <img src={h.image} alt={h.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center', padding: '4px' }}>{h.title}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: '10px' }}>
          <button onClick={messageFreelancer} disabled={messaging}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '11px 16px', borderRadius: 'var(--radius-md)', fontSize: '13.5px', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-dim)', cursor: 'pointer' }}>
            <MessageCircle size={15} strokeWidth={1.75} />{messaging ? '…' : 'Message'}
          </button>
          {proposal.status === 'pending' && (
            <>
              <button onClick={() => onReject(proposal.id)} disabled={busy}
                style={{ padding: '11px 16px', borderRadius: 'var(--radius-md)', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                Reject
              </button>
              <button onClick={() => onAccept(proposal.id)} disabled={busy}
                style={{ flex: 1, padding: '11px 16px', borderRadius: 'var(--radius-md)', fontSize: '13.5px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? '…' : 'Accept & hire'}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes proposalDrawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  )
}
