'use client'
import { useEffect } from 'react'
import { X, ArrowRight, DollarSign, Calendar, Users, FileText, BarChart3, MapPin, Star, ShieldCheck, Heart } from 'lucide-react'
import VerifiedBadge from './VerifiedBadge'

interface Project {
  id: number
  title: string
  description: string | null
  category: string | null
  budget_min: number | null
  budget_max: number | null
  currency: string
  deadline: string | null
  deadline_days_left: number | null
  status: string
  skills: string[]
  experience_level: string | null
  location: string | null
  days_open: number
  client_id: number
  client_name: string | null
  client_verified: boolean
  client_posted_projects_count: number
  client_rating: number | null
  client_review_count: number
  client_total_spent: number
  is_owner: boolean
  is_saved: boolean
  proposal_count: number
  my_proposal_status: string | null
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  open:        { color: 'var(--accent)', bg: 'var(--accent-dim)', label: 'Open' },
  in_progress: { color: 'var(--warning)', bg: 'rgba(221,162,63,0.12)', label: 'In progress' },
  completed:   { color: 'var(--success)', bg: 'rgba(63,185,131,0.12)', label: 'Completed' },
  cancelled:   { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Cancelled' },
}

const PROPOSAL_STATUS_META: Record<string, { color: string; label: string }> = {
  pending:   { color: 'var(--warning)', label: 'Proposal pending' },
  accepted:  { color: 'var(--success)', label: 'Proposal accepted' },
  rejected:  { color: 'var(--error)', label: 'Proposal rejected' },
  withdrawn: { color: 'var(--text-dim)', label: 'Proposal withdrawn' },
}

const EXPERIENCE_META: Record<string, string> = { entry: 'Entry level', intermediate: 'Intermediate', expert: 'Expert' }

const budgetLabel = (p: Project) => {
  if (!p.budget_min && !p.budget_max) return null
  if (p.budget_min && p.budget_max) return `${p.budget_min.toLocaleString('en-US')}–${p.budget_max.toLocaleString('en-US')} ${p.currency}`
  return `${(p.budget_min || p.budget_max)!.toLocaleString('en-US')} ${p.currency}`
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--text-dim)', margin: '0 0 10px',
}
const section: React.CSSProperties = { padding: '18px 24px', borderTop: '1px solid var(--border)' }

/** Quick-preview drawer for a project row — same slide-in-from-right pattern
 * as the company drawer on Dashboard and MemberPreviewDrawer, widened and
 * split into clearly divided sections (per Milad's feedback that the first
 * pass felt cramped and undifferentiated). The list already has the full
 * project object per row, so this needs no fetch of its own. */
export default function ProjectPreviewDrawer({ project, onClose, onToggleSave }: { project: Project | null; onClose: () => void; onToggleSave?: (projectId: number) => void }) {
  useEffect(() => {
    if (!project) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [project, onClose])

  if (!project) return null

  const sm = STATUS_META[project.status] || STATUS_META.open
  const budget = budgetLabel(project)
  const proposalMeta = project.my_proposal_status ? PROPOSAL_STATUS_META[project.my_proposal_status] : null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: '540px', maxWidth: '100%',
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 61,
        display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        animation: 'projectDrawerSlideIn 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick preview</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!project.is_owner && onToggleSave && (
              <button onClick={() => onToggleSave(project.id)} title={project.is_saved ? 'Remove from saved' : 'Save project'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: project.is_saved ? 'var(--error)' : 'var(--text-muted)' }}>
                <Heart size={18} strokeWidth={1.75} fill={project.is_saved ? 'currentColor' : 'none'} />
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', borderRadius: 'var(--radius-sm)' }}>
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
              {project.category && <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{project.category}</span>}
              {proposalMeta && <span style={{ fontSize: '11.5px', fontWeight: 600, color: proposalMeta.color, marginLeft: 'auto' }}>{proposalMeta.label}</span>}
            </div>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.35 }}>{project.title}</h2>
          </div>

          {/* Description */}
          {project.description && (
            <div style={section}>
              <p style={sectionLabel}>Description</p>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{project.description}</p>
            </div>
          )}

          {/* Skills & experience */}
          {(project.skills?.length > 0 || project.experience_level) && (
            <div style={section}>
              <p style={sectionLabel}>Skills & experience</p>
              {project.skills?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: project.experience_level ? '10px' : 0 }}>
                  {project.skills.map(s => <span key={s} style={{ fontSize: '12px', background: 'var(--bg-tag)', color: 'var(--text-muted)', padding: '4px 11px', borderRadius: '999px' }}>{s}</span>)}
                </div>
              )}
              {project.experience_level && EXPERIENCE_META[project.experience_level] && (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{EXPERIENCE_META[project.experience_level]}</span>
              )}
            </div>
          )}

          {/* Budget & timeline */}
          <div style={section}>
            <p style={sectionLabel}>Budget & timeline</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: 'var(--text-muted)' }}>
              {budget && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><DollarSign size={15} strokeWidth={1.75} color="var(--text-dim)" />{budget}</span>}
              {project.deadline && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: project.deadline_days_left != null && project.deadline_days_left <= 3 ? 'var(--warning)' : 'var(--text-muted)' }}>
                  <Calendar size={15} strokeWidth={1.75} color="currentColor" />Due {new Date(project.deadline).toLocaleDateString()}
                  {project.deadline_days_left != null && (project.deadline_days_left >= 0 ? ` (${project.deadline_days_left}d left)` : ' (past due)')}
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={15} strokeWidth={1.75} color="var(--text-dim)" />Posted {project.days_open === 0 ? 'today' : `${project.days_open}d ago`}
              </span>
              {project.location && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={15} strokeWidth={1.75} color="var(--text-dim)" />{project.location}
                </span>
              )}
            </div>
          </div>

          {/* Activity & client */}
          <div style={section}>
            <p style={sectionLabel}>Activity & client</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: 'var(--text-muted)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Users size={15} strokeWidth={1.75} color="var(--text-dim)" />{project.proposal_count} {project.proposal_count === 1 ? 'proposal' : 'proposals'}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={15} strokeWidth={1.75} color="var(--text-dim)" />
                {project.client_posted_projects_count} {project.client_posted_projects_count === 1 ? 'project posted' : 'projects posted'} by this client
              </span>
              {project.client_verified && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={15} strokeWidth={1.75} color="var(--accent)" />Payment verified
                </span>
              )}
              {project.client_rating != null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Star size={15} strokeWidth={1.75} fill="currentColor" color="var(--warning)" />
                  {project.client_rating.toFixed(1)} rating{project.client_review_count > 0 ? ` (${project.client_review_count} reviews)` : ''}
                </span>
              )}
              {project.client_total_spent > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={15} strokeWidth={1.75} color="var(--text-dim)" />
                  {project.client_total_spent >= 1000 ? `$${Math.floor(project.client_total_spent / 1000)}K+ spent` : `$${Math.round(project.client_total_spent)}+ spent`}
                </span>
              )}
              {!project.is_owner && (
                <span onClick={() => { window.location.href = `/members/${project.client_id}` }}
                  style={{ cursor: 'pointer', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  Posted by {project.client_name || 'a client'}{project.client_verified && <VerifiedBadge size={13} />}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => { window.location.href = `/projects/${project.id}` }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: 'pointer' }}>
            Open full project <ArrowRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <style>{`@keyframes projectDrawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  )
}
