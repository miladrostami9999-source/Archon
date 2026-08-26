'use client'
import { useEffect } from 'react'
import { X, ArrowRight, DollarSign, Calendar, Users, FileText } from 'lucide-react'
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
  days_open: number
  client_id: number
  client_name: string | null
  client_verified: boolean
  client_posted_projects_count: number
  is_owner: boolean
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

/** Quick-preview drawer for a project row — same slide-in-from-right pattern
 * as the company drawer on Dashboard and MemberPreviewDrawer. The list
 * already has the full project object per row, so this needs no fetch of
 * its own; it just renders what's passed in. */
export default function ProjectPreviewDrawer({ project, onClose }: { project: Project | null; onClose: () => void }) {
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
        position: 'fixed', top: 0, right: 0, height: '100vh', width: '420px', maxWidth: '100%',
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 61,
        display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        animation: 'projectDrawerSlideIn 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick preview</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', borderRadius: 'var(--radius-sm)' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
            {project.category && <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{project.category}</span>}
          </div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px', lineHeight: 1.3 }}>{project.title}</h2>

          {project.description && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 14px', whiteSpace: 'pre-wrap' }}>{project.description}</p>
          )}

          {project.skills?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {project.skills.map(s => <span key={s} style={{ fontSize: '11px', background: 'var(--bg-tag)', color: 'var(--text-muted)', padding: '3px 9px', borderRadius: '999px' }}>{s}</span>)}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            {budget && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><DollarSign size={14} strokeWidth={1.75} color="var(--text-dim)" />{budget}</span>}
            {project.deadline && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: project.deadline_days_left != null && project.deadline_days_left <= 3 ? 'var(--warning)' : 'var(--text-muted)' }}>
                <Calendar size={14} strokeWidth={1.75} color="currentColor" />Due {new Date(project.deadline).toLocaleDateString()}
                {project.deadline_days_left != null && (project.deadline_days_left >= 0 ? ` (${project.deadline_days_left}d left)` : ' (past due)')}
              </span>
            )}
            {project.experience_level && EXPERIENCE_META[project.experience_level] && (
              <span>{EXPERIENCE_META[project.experience_level]}</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '14px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Users size={13} strokeWidth={1.75} color="var(--text-dim)" />{project.proposal_count} {project.proposal_count === 1 ? 'proposal' : 'proposals'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={13} strokeWidth={1.75} color="var(--text-dim)" />
              {project.client_posted_projects_count} {project.client_posted_projects_count === 1 ? 'project posted' : 'projects posted'} by this client
            </span>
            {!project.is_owner && (
              <span onClick={() => { window.location.href = `/members/${project.client_id}` }}
                style={{ cursor: 'pointer', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Posted by {project.client_name || 'a client'}{project.client_verified && <VerifiedBadge size={12} />}
              </span>
            )}
            {proposalMeta && <span style={{ color: proposalMeta.color, fontWeight: 600 }}>{proposalMeta.label}</span>}
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => { window.location.href = `/projects/${project.id}` }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: 'pointer' }}>
            Open full project <ArrowRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <style>{`@keyframes projectDrawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  )
}
