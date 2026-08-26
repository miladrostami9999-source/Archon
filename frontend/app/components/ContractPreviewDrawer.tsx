'use client'
import { useEffect } from 'react'
import { X, ArrowRight, DollarSign, Calendar, CheckCircle2, Circle, Clock } from 'lucide-react'
import VerifiedBadge from './VerifiedBadge'

interface Milestone {
  id: number
  title: string
  amount: number
  status: string
  due_date?: string | null
}

interface Contract {
  id: number
  project_title: string | null
  project_description?: string | null
  project_deadline?: string | null
  project_category?: string | null
  client_id: number
  client_name: string | null
  client_verified: boolean
  client_avatar?: string
  freelancer_id: number
  freelancer_name: string | null
  freelancer_verified: boolean
  freelancer_avatar?: string
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

const MILESTONE_META: Record<string, { color: string; bg: string; label: string }> = {
  pending:   { color: 'var(--text-dim)', bg: 'var(--bg-input)', label: 'Not funded' },
  funded:    { color: 'var(--warning)', bg: 'rgba(221,162,63,0.12)', label: 'Funded' },
  delivered: { color: 'var(--accent)', bg: 'var(--accent-dim)', label: 'Delivered' },
  approved:  { color: 'var(--success)', bg: 'rgba(63,185,131,0.12)', label: 'Approved' },
  released:  { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', label: 'Paid out' },
  disputed:  { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Disputed' },
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--text-dim)', margin: '0 0 10px',
}
const section: React.CSSProperties = { padding: '18px 24px', borderTop: '1px solid var(--border)' }

function Avatar({ url, name, size = 36 }: { url?: string; name?: string | null; size?: number }) {
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.4, fontWeight: 700, color: 'white' }}>{initials}</span>}
    </div>
  )
}

/** Quick-preview drawer for a contract row — the same widened, sectioned
 * pattern as ProjectPreviewDrawer. The contracts list already carries every
 * field this needs (serialize_contract), so no extra fetch. */
export default function ContractPreviewDrawer({ contract, onClose }: { contract: Contract | null; onClose: () => void }) {
  useEffect(() => {
    if (!contract) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contract, onClose])

  if (!contract) return null

  const sm = STATUS_META[contract.status] || STATUS_META.active
  const otherIsClient = contract.viewer_role === 'freelancer'
  const otherName = otherIsClient ? contract.client_name : contract.freelancer_name
  const otherAvatar = otherIsClient ? contract.client_avatar : contract.freelancer_avatar
  const otherVerified = otherIsClient ? contract.client_verified : contract.freelancer_verified
  const otherId = otherIsClient ? contract.client_id : contract.freelancer_id
  const released = contract.milestones.filter(m => m.status === 'released').reduce((a, m) => a + m.amount, 0)
  const total = contract.total_amount || 0
  const progressPct = total ? Math.min(100, Math.round((released / total) * 100)) : 0

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: '540px', maxWidth: '100%',
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 61,
        display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        animation: 'contractDrawerSlideIn 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick preview</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', borderRadius: 'var(--radius-sm)' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
              {contract.project_category && <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{contract.project_category}</span>}
              <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', textTransform: 'capitalize', marginLeft: 'auto' }}>You're the {contract.viewer_role}</span>
            </div>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.35 }}>{contract.project_title || `Contract #${contract.id}`}</h2>
          </div>

          {/* Description */}
          {contract.project_description && (
            <div style={section}>
              <p style={sectionLabel}>Description</p>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{contract.project_description}</p>
            </div>
          )}

          {/* Terms */}
          <div style={section}>
            <p style={sectionLabel}>Terms</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: 'var(--text-muted)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={15} strokeWidth={1.75} color="var(--text-dim)" />{total.toLocaleString('en-US')} {contract.currency} total
              </span>
              {contract.project_deadline && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={15} strokeWidth={1.75} color="var(--text-dim)" />Due {new Date(contract.project_deadline).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Payments */}
          <div style={section}>
            <p style={sectionLabel}>Payments</p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="mono" style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>{released.toLocaleString('en-US')} {contract.currency}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>of {total.toLocaleString('en-US')} {contract.currency}</span>
            </div>
            <div style={{ height: '7px', borderRadius: '999px', background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, borderRadius: '999px', background: 'var(--accent)', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Milestones */}
          {contract.milestones.length > 0 && (
            <div style={section}>
              <p style={sectionLabel}>Milestones ({contract.milestones.length})</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {contract.milestones.map(m => {
                  const mm = MILESTONE_META[m.status] || MILESTONE_META.pending
                  const isDone = m.status === 'released' || m.status === 'approved'
                  return (
                    <div key={m.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      {isDone
                        ? <CheckCircle2 size={16} strokeWidth={1.75} color="var(--success)" style={{ marginTop: '1px', flexShrink: 0 }} />
                        : <Circle size={16} strokeWidth={1.75} color="var(--text-dim)" style={{ marginTop: '1px', flexShrink: 0 }} />}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '13.5px', color: 'var(--text)' }}>{m.title}</span>
                          <span className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{m.amount.toLocaleString('en-US')}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: mm.color, background: mm.bg }}>{mm.label}</span>
                          {m.due_date && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-dim)' }}><Clock size={11} strokeWidth={1.75} />{new Date(m.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Other party */}
          <div style={section}>
            <p style={sectionLabel}>{otherIsClient ? 'Client' : 'Freelancer'}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Avatar url={otherAvatar} name={otherName} />
              <span onClick={() => { window.location.href = `/members/${otherId}` }}
                style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {otherName || 'Unknown'}{otherVerified && <VerifiedBadge size={13} />}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => { window.location.href = `/contracts/${contract.id}` }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: 'pointer' }}>
            Open full contract <ArrowRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <style>{`@keyframes contractDrawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  )
}
