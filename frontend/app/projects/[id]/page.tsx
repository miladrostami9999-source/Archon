'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import MarketplaceBeta from '../../components/MarketplaceBeta'
import VerifiedBadge from '../../components/VerifiedBadge'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'
import { useIsMobile } from '../../hooks/useIsMobile'
import { DollarSign, Calendar, Star, CheckCircle2, Paperclip, ArrowLeft, SearchX, Inbox, Ban, X, Users, FileText } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
  created_at: string
  days_open: number
  client_id: number
  client_name: string | null
  client_verified: boolean
  client_posted_projects_count: number
  is_owner: boolean
  proposal_count: number
  my_proposal_status: string | null
  my_proposal_id: number | null
}

const EXPERIENCE_META: Record<string, string> = { entry: 'Entry level', intermediate: 'Intermediate', expert: 'Expert' }

interface Proposal {
  id: number
  project_id: number
  freelancer_id: number
  freelancer_name: string | null
  freelancer_verified: boolean
  freelancer_avatar: string
  freelancer_headline: string
  freelancer_username: string | null
  freelancer_rating: number | null
  freelancer_review_count: number
  freelancer_completed_contracts: number
  cover_letter: string | null
  attachment_url: string | null
  proposed_amount: number | null
  proposed_days: number | null
  status: string
  created_at: string
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  open:        { color: 'var(--accent)', bg: 'var(--accent-dim)', label: 'Open' },
  in_progress: { color: 'var(--warning)', bg: 'rgba(221,162,63,0.12)', label: 'In progress' },
  completed:   { color: 'var(--success)', bg: 'rgba(63,185,131,0.12)', label: 'Completed' },
  cancelled:   { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Cancelled' },
}

const PROPOSAL_STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending:   { color: 'var(--warning)', bg: 'rgba(221,162,63,0.12)', label: 'Pending' },
  accepted:  { color: 'var(--success)', bg: 'rgba(63,185,131,0.12)', label: 'Accepted' },
  rejected:  { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Rejected' },
  withdrawn: { color: 'var(--text-dim)', bg: 'var(--bg-input)', label: 'Withdrawn' },
}

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params?.id
  const isMobile = useIsMobile()
  const [project, setProject] = useState<Project | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState<number | 'submit' | null>(null)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ cover_letter: '', proposed_amount: '', proposed_days: '' })
  const [sample, setSample] = useState<{ url: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '', budget_min: '', budget_max: '', currency: 'USD', deadline: '', experience_level: '', skillsInput: '', skills: [] as string[] })

  const addSkill = () => {
    const s = editForm.skillsInput.trim()
    if (s && !editForm.skills.includes(s)) setEditForm(f => ({ ...f, skills: [...f.skills, s], skillsInput: '' }))
    else setEditForm(f => ({ ...f, skillsInput: '' }))
  }
  const removeSkill = (s: string) => setEditForm(f => ({ ...f, skills: f.skills.filter(x => x !== s) }))

  const startEdit = () => {
    if (!project) return
    setEditForm({
      title: project.title,
      description: project.description || '',
      category: project.category || '',
      budget_min: project.budget_min != null ? String(project.budget_min) : '',
      budget_max: project.budget_max != null ? String(project.budget_max) : '',
      currency: project.currency,
      deadline: project.deadline ? project.deadline.slice(0, 10) : '',
      experience_level: project.experience_level || '',
      skillsInput: '',
      skills: project.skills || [],
    })
    setEditing(true); setMsg('')
  }

  const saveEdit = async () => {
    if (!editForm.title.trim()) { setMsg('Title is required'); return }
    setBusy('submit'); setMsg('')
    try {
      await axios.patch(`${API}/marketplace/projects/${id}`, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        category: editForm.category.trim() || null,
        budget_min: editForm.budget_min ? Number(editForm.budget_min) : null,
        budget_max: editForm.budget_max ? Number(editForm.budget_max) : null,
        currency: editForm.currency,
        deadline: editForm.deadline || null,
        skills: editForm.skills,
        experience_level: editForm.experience_level || null,
      })
      setEditing(false)
      setMsg('Project updated')
      load()
    } catch (e: any) { setMsg(e.response?.data?.detail || 'Could not save') }
    setBusy(null)
  }

  const deleteProject = async () => {
    if (!window.confirm('Delete this project? Anyone who bid on it will be told, and their proposals go with it.')) return
    setBusy('submit'); setMsg('')
    try {
      await axios.delete(`${API}/marketplace/projects/${id}`)
      window.location.href = '/projects'
    } catch (e: any) {
      setMsg(e.response?.data?.detail || 'Could not delete')
      setBusy(null)
    }
  }

  const uploadSample = async (file: File) => {
    setUploading(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await axios.post(`${API}/auth/upload/receipt`, fd)
      setSample({ url: r.data.url, name: file.name })
    } catch (e: any) {
      setMsg(e.response?.data?.detail || 'Could not upload the file')
    }
    setUploading(false)
  }

  const load = () => {
    axios.get(`${API}/marketplace/projects/${id}`)
      .then(r => {
        setProject(r.data)
        if (r.data.is_owner) {
          axios.get(`${API}/marketplace/projects/${id}/proposals`).then(pr => setProposals(pr.data)).catch(() => {})
        }
      })
      .catch((e) => {
        if (e.response?.status === 404) setNotFound(true)
        else if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard'
      })
      .finally(() => setLoading(false))
  }
  // Proposals arrive while the owner is looking at the page, so it refreshes
  // itself rather than needing a reload to show them.
  useEffect(() => {
    if (!id) return
    load()
    const timer = setInterval(load, 8000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const submitProposal = async () => {
    if (!form.proposed_amount) { setMsg('Proposed amount is required'); return }
    setBusy('submit'); setMsg('')
    try {
      await axios.post(`${API}/marketplace/projects/${id}/proposals`, {
        cover_letter: form.cover_letter.trim() || null,
        proposed_amount: Number(form.proposed_amount),
        proposed_days: form.proposed_days ? Number(form.proposed_days) : null,
        attachment_url: sample?.url || null,
      })
      setMsg('Proposal submitted')
      load()
    } catch (e: any) { setMsg(e.response?.data?.detail || 'Could not submit proposal') }
    setBusy(null)
  }

  const acceptProposal = async (proposalId: number) => {
    if (!window.confirm('Accept this proposal? A contract will be created and every other proposal on this project will be rejected.')) return
    setBusy(proposalId); setMsg('')
    try {
      await axios.post(`${API}/marketplace/proposals/${proposalId}/accept`, {})
      setMsg('Proposal accepted — contract created')
      load()
    } catch (e: any) { setMsg(e.response?.data?.detail || 'Could not accept') }
    setBusy(null)
  }

  const rejectProposal = async (proposalId: number) => {
    setBusy(proposalId); setMsg('')
    try {
      await axios.post(`${API}/marketplace/proposals/${proposalId}/reject`)
      load()
    } catch (e: any) { setMsg(e.response?.data?.detail || 'Could not reject') }
    setBusy(null)
  }

  const withdrawProposal = async (proposalId: number) => {
    setBusy(proposalId); setMsg('')
    try {
      await axios.post(`${API}/marketplace/proposals/${proposalId}/withdraw`)
      load()
    } catch (e: any) { setMsg(e.response?.data?.detail || 'Could not withdraw') }
    setBusy(null)
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px',
    fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  }
  const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }

  const budget = project && (project.budget_min || project.budget_max)
    ? project.budget_min && project.budget_max
      ? `${project.budget_min.toLocaleString('en-US')}–${project.budget_max.toLocaleString('en-US')} ${project.currency}`
      : `${(project.budget_min || project.budget_max)!.toLocaleString('en-US')} ${project.currency}`
    : null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', height: '100vh', overflowY: 'auto', padding: isMobile ? '72px 16px 32px' : '32px 40px' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <a href="/projects" style={{ fontSize: '12.5px', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '14px' }}><ArrowLeft size={13} strokeWidth={1.75} />Back to projects</a>

          <MarketplaceBeta />

          {loading ? (
            <LoadingState fullPage />
          ) : notFound || !project ? (
            <EmptyState icon={SearchX} title="Project not found" description="It may have been removed or the link is incorrect." />
          ) : editing ? (
            /* ── EDIT ── same fields as posting, so nothing is lost by
               correcting a project after the fact. */
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: '18px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '14px' }}>Edit project</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={label}>Title</label>
                  <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={input} />
                </div>
                <div>
                  <label style={label}>Category</label>
                  <input value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={input} />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={label}>Description</label>
                <textarea rows={4} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={{ ...input, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={label}>Budget min</label>
                  <input type="number" value={editForm.budget_min} onChange={e => setEditForm(f => ({ ...f, budget_min: e.target.value }))} style={input} />
                </div>
                <div>
                  <label style={label}>Budget max</label>
                  <input type="number" value={editForm.budget_max} onChange={e => setEditForm(f => ({ ...f, budget_max: e.target.value }))} style={input} />
                </div>
                <div>
                  <label style={label}>Currency</label>
                  <select value={editForm.currency} onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))} style={input}>
                    <option value="USD">USD</option><option value="EUR">EUR</option><option value="IRR">IRR (Toman)</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Deadline</label>
                  <input type="date" value={editForm.deadline} onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))} style={input} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={label}>Experience level</label>
                  <select value={editForm.experience_level} onChange={e => setEditForm(f => ({ ...f, experience_level: e.target.value }))} style={input}>
                    <option value="">Not specified</option>
                    <option value="entry">Entry level</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Skills needed</label>
                  <input value={editForm.skillsInput} onChange={e => setEditForm(f => ({ ...f, skillsInput: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill() } }}
                    placeholder="e.g. 3D Rendering, Vray — press Enter" style={{ ...input, marginBottom: editForm.skills.length ? '8px' : 0 }} />
                  {editForm.skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {editForm.skills.map(s => (
                        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', background: 'var(--bg-tag)', color: 'var(--text-muted)', padding: '3px 6px 3px 9px', borderRadius: '999px' }}>
                          {s}
                          <button onClick={() => removeSkill(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 0 }}><X size={11} strokeWidth={2} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={saveEdit} disabled={busy === 'submit'}
                  style={{ padding: '9px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer' }}>
                  {busy === 'submit' ? 'Saving…' : 'Save changes'}
                </button>
                <button onClick={() => { setEditing(false); setMsg('') }}
                  style={{ padding: '9px 16px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  Cancel
                </button>
                {msg && <span style={{ fontSize: '12.5px', color: /updated|success/i.test(msg) ? 'var(--success)' : 'var(--error)' }}>{msg}</span>}
              </div>
            </div>
          ) : (
            <>
              <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: '18px' }}>
                {project.is_owner && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '10px' }}>
                    <button onClick={startEdit}
                      style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-dim)', cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={deleteProject} disabled={busy === 'submit'}
                      style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--error)', background: 'rgba(228,114,111,0.08)', border: '1px solid rgba(228,114,111,0.22)', cursor: 'pointer' }}>
                      Delete
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <h1 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{project.title}</h1>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: (STATUS_META[project.status] || STATUS_META.open).color, background: (STATUS_META[project.status] || STATUS_META.open).bg }}>
                    {(STATUS_META[project.status] || STATUS_META.open).label}
                  </span>
                  {project.category && <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{project.category}</span>}
                </div>
                {project.description && <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{project.description}</p>}
                {project.skills?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {project.skills.map(s => <span key={s} style={{ fontSize: '11px', background: 'var(--bg-tag)', color: 'var(--text-muted)', padding: '3px 9px', borderRadius: '999px' }}>{s}</span>)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12.5px', color: 'var(--text-dim)' }}>
                  {budget && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DollarSign size={13} strokeWidth={1.75} />{budget}</span>}
                  {project.deadline && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: project.deadline_days_left != null && project.deadline_days_left <= 3 ? 'var(--warning)' : 'var(--text-dim)' }}>
                      <Calendar size={13} strokeWidth={1.75} />Due {new Date(project.deadline).toLocaleDateString()}
                      {project.deadline_days_left != null && (project.deadline_days_left >= 0 ? ` (${project.deadline_days_left}d left)` : ' (past due)')}
                    </span>
                  )}
                  {project.experience_level && EXPERIENCE_META[project.experience_level] && (
                    <span>{EXPERIENCE_META[project.experience_level]}</span>
                  )}
                  {!project.is_owner && (
                    <span>Posted by <a href={`/members/${project.client_id}`} style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{project.client_name || 'a client'}{project.client_verified && <VerifiedBadge size={11} />}</a></span>
                  )}
                </div>
              </div>

              {/* Activity — mirrors the at-a-glance strip on job postings
                  elsewhere: how live this listing is, not just what it asks for. */}
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '14px 18px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  <Users size={13} strokeWidth={1.75} color="var(--text-dim)" />{project.proposal_count} {project.proposal_count === 1 ? 'proposal' : 'proposals'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  <FileText size={13} strokeWidth={1.75} color="var(--text-dim)" />
                  {project.client_posted_projects_count} {project.client_posted_projects_count === 1 ? 'project posted' : 'projects posted'} by this client
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  <Calendar size={13} strokeWidth={1.75} color="var(--text-dim)" />
                  Posted {project.days_open === 0 ? 'today' : `${project.days_open}d ago`}
                </div>
              </div>

              {msg && <p style={{ fontSize: '12.5px', color: /accepted|submitted/i.test(msg) ? 'var(--success)' : 'var(--error)', marginBottom: '14px' }}>{msg}</p>}

              {project.is_owner ? (
                <>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '10px' }}>
                    Proposals ({proposals.length})
                  </p>
                  {proposals.length === 0 ? (
                    <EmptyState icon={Inbox} compact title="No proposals yet" description="Freelancer proposals for this project will show up here." />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '32px' }}>
                      {proposals.map(p => {
                        const pm = PROPOSAL_STATUS_META[p.status] || PROPOSAL_STATUS_META.pending
                        return (
                          <div key={p.id} style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                              <div style={{ minWidth: 0, flex: 1, display: 'flex', gap: '12px' }}>
                                {/* Avatar — links through to the portfolio when
                                    the freelancer has made their profile public. */}
                                {(() => {
                                  const initials = (p.freelancer_name || 'F').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                                  const avatarEl = (
                                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' }}>
                                      {p.freelancer_avatar
                                        ? <img src={p.freelancer_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{initials}</span>}
                                    </div>
                                  )
                                  return <a href={`/members/${p.freelancer_id}`} title="View profile">{avatarEl}</a>
                                })()}

                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                    <a href={`/members/${p.freelancer_id}`}
                                      style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      {p.freelancer_name || 'Freelancer'}{p.freelancer_verified && <VerifiedBadge size={12} />}
                                    </a>
                                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', color: pm.color, background: pm.bg }}>{pm.label}</span>
                                  </div>

                                  {/* Track record — what the hiring decision rests on */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '11.5px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                                    {p.freelancer_review_count > 0 ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--warning)' }}><Star size={12} strokeWidth={1.75} fill="currentColor" />{p.freelancer_rating} <span style={{ color: 'var(--text-dim)' }}>({p.freelancer_review_count})</span></span>
                                    ) : (
                                      <span>No reviews yet</span>
                                    )}
                                    {p.freelancer_completed_contracts > 0 && (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><CheckCircle2 size={12} strokeWidth={1.75} />{p.freelancer_completed_contracts} completed</span>
                                    )}
                                    {p.freelancer_headline && <span>· {p.freelancer_headline}</span>}
                                  </div>

                                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                                    {p.proposed_amount?.toLocaleString('en-US')} {project.currency}
                                    {p.proposed_days ? ` · ${p.proposed_days} days` : ''}
                                  </div>
                                  {p.cover_letter && <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{p.cover_letter}</p>}
                                  {p.attachment_url && (
                                    <a href={p.attachment_url} target="_blank" rel="noreferrer"
                                      style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Paperclip size={12} strokeWidth={1.75} />Work sample</a>
                                  )}
                                </div>
                              </div>
                              {p.status === 'pending' && (
                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                  <button onClick={() => acceptProposal(p.id)} disabled={busy === p.id}
                                    style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: 'pointer' }}>
                                    {busy === p.id ? '…' : 'Accept'}
                                  </button>
                                  <button onClick={() => rejectProposal(p.id)} disabled={busy === p.id}
                                    style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : project.status !== 'open' ? (
                <EmptyState icon={Ban} compact title="Not accepting proposals" description="This project is no longer open for proposals." />
              ) : project.my_proposal_status ? (
                <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13.5px', color: 'var(--text)' }}>Your proposal:</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: (PROPOSAL_STATUS_META[project.my_proposal_status] || PROPOSAL_STATUS_META.pending).color, background: (PROPOSAL_STATUS_META[project.my_proposal_status] || PROPOSAL_STATUS_META.pending).bg }}>
                        {(PROPOSAL_STATUS_META[project.my_proposal_status] || PROPOSAL_STATUS_META.pending).label}
                      </span>
                    </div>
                    {project.my_proposal_status === 'pending' && project.my_proposal_id && (
                      <button onClick={() => withdrawProposal(project.my_proposal_id!)} disabled={busy === project.my_proposal_id}
                        style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                        {busy === project.my_proposal_id ? '…' : 'Withdraw'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '12px' }}>Submit a proposal</p>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={label}>Cover letter</label>
                    <textarea rows={4} value={form.cover_letter} onChange={e => setForm(f => ({ ...f, cover_letter: e.target.value }))} placeholder="Why you're a good fit for this project" style={{ ...input, resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={label}>Proposed amount ({project.currency})</label>
                      <input type="number" value={form.proposed_amount} onChange={e => setForm(f => ({ ...f, proposed_amount: e.target.value }))} placeholder="0" style={input} />
                    </div>
                    <div>
                      <label style={label}>Estimated days</label>
                      <input type="number" value={form.proposed_days} onChange={e => setForm(f => ({ ...f, proposed_days: e.target.value }))} placeholder="0" style={input} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={label}>Work sample <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
                    {sample ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <a href={sample.url} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: 'var(--success)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Paperclip size={12} strokeWidth={1.75} />{sample.name}</a>
                        <button onClick={() => setSample(null)} style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                      </div>
                    ) : (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px dashed var(--border)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <Paperclip size={12} strokeWidth={1.75} />{uploading ? 'Uploading…' : 'Attach an image or PDF'}
                        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadSample(f); e.target.value = '' }} />
                      </label>
                    )}
                  </div>
                  <button onClick={submitProposal} disabled={busy === 'submit'}
                    style={{ padding: '9px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: busy === 'submit' ? 0.6 : 1 }}>
                    {busy === 'submit' ? 'Submitting…' : 'Submit proposal'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
