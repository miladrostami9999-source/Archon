'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import MarketplaceBeta, { BetaTag } from '../components/MarketplaceBeta'
import VerifiedBadge from '../components/VerifiedBadge'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import ProjectPreviewDrawer from '../components/ProjectPreviewDrawer'
import { useIsMobile } from '../hooks/useIsMobile'
import { DollarSign, Calendar, Plus, Briefcase, X } from 'lucide-react'

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

const budgetLabel = (p: Project) => {
  if (!p.budget_min && !p.budget_max) return null
  if (p.budget_min && p.budget_max) return `${p.budget_min.toLocaleString('en-US')}–${p.budget_max.toLocaleString('en-US')} ${p.currency}`
  return `${(p.budget_min || p.budget_max)!.toLocaleString('en-US')} ${p.currency}`
}

export default function ProjectsPage() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<'open' | 'mine'>('open')
  // Which view leads. A client lands on the projects they've posted (where
  // proposals arrive); a freelancer lands on the open board. Either can use
  // both tabs — this only picks the starting one.
  const [accountMode, setAccountMode] = useState<'freelancer' | 'client' | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showPost, setShowPost] = useState(false)
  const [previewProject, setPreviewProject] = useState<Project | null>(null)
  const [posting, setPosting] = useState(false)
  const [postMsg, setPostMsg] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', category: '', budget_min: '', budget_max: '', currency: 'USD', deadline: '',
    experience_level: '', skillsInput: '', skills: [] as string[],
  })

  const addSkill = () => {
    const s = form.skillsInput.trim()
    if (s && !form.skills.includes(s)) setForm(f => ({ ...f, skills: [...f.skills, s], skillsInput: '' }))
    else setForm(f => ({ ...f, skillsInput: '' }))
  }
  const removeSkill = (s: string) => setForm(f => ({ ...f, skills: f.skills.filter(x => x !== s) }))

  const load = () => {
    setLoading(true)
    axios.get(`${API}/marketplace/projects`, { params: tab === 'mine' ? { mine: true } : {} })
      .then(r => setProjects(r.data))
      .catch((e) => { if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard' })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [tab])

  useEffect(() => {
    axios.get(`${API}/auth/me`)
      .then(r => {
        const mode = r.data.account_mode === 'client' ? 'client' : 'freelancer'
        setAccountMode(mode)
        if (mode === 'client') setTab('mine')
      })
      .catch(() => setAccountMode('freelancer'))
  }, [])

  const submitPost = async () => {
    if (!form.title.trim()) { setPostMsg('Title is required'); return }
    setPosting(true); setPostMsg('')
    try {
      await axios.post(`${API}/marketplace/projects`, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        currency: form.currency,
        deadline: form.deadline || null,
        skills: form.skills.length ? form.skills : null,
        experience_level: form.experience_level || null,
      })
      setForm({ title: '', description: '', category: '', budget_min: '', budget_max: '', currency: 'USD', deadline: '', experience_level: '', skillsInput: '', skills: [] })
      setShowPost(false)
      setTab('mine')
      load()
    } catch (e: any) {
      setPostMsg(e.response?.data?.detail || 'Could not post project')
    }
    setPosting(false)
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '9px 11px',
    fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  }
  const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', minWidth: 0, marginTop: isMobile ? '52px' : 0, height: isMobile ? 'calc(100vh - 52px)' : '100vh', overflowY: 'auto' }}>

        <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Projects</h1>
            <BetaTag />
          </div>
          <button onClick={() => setShowPost(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            {showPost ? 'Cancel' : <><Plus size={14} strokeWidth={2} /> {isMobile ? 'Post' : 'Post a Project'}</>}
          </button>
        </div>

        <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', maxWidth: '860px', margin: '0 auto' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px' }}>
            {accountMode === 'client'
              ? 'Post a project to get proposals from freelancers. You can also browse the open board and propose on other people’s work.'
              : 'Browse open projects and send a proposal. You can post your own project here too — same account, no switching needed.'}
          </p>

          <MarketplaceBeta />

          {showPost && (
            <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '18px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={label}>Title</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. 5 exterior renders for a villa" style={input} />
                </div>
                <div>
                  <label style={label}>Category</label>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. 3D Visualization" style={input} />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={label}>Description</label>
                <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What do you need done?" style={{ ...input, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={label}>Budget min</label>
                  <input type="number" value={form.budget_min} onChange={e => setForm(f => ({ ...f, budget_min: e.target.value }))} placeholder="0" style={input} />
                </div>
                <div>
                  <label style={label}>Budget max</label>
                  <input type="number" value={form.budget_max} onChange={e => setForm(f => ({ ...f, budget_max: e.target.value }))} placeholder="0" style={input} />
                </div>
                <div>
                  <label style={label}>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={input}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="IRR">IRR (Toman)</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={input} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={label}>Experience level</label>
                  <select value={form.experience_level} onChange={e => setForm(f => ({ ...f, experience_level: e.target.value }))} style={input}>
                    <option value="">Not specified</option>
                    <option value="entry">Entry level</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Skills needed</label>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: form.skills.length ? '8px' : 0 }}>
                    <input value={form.skillsInput} onChange={e => setForm(f => ({ ...f, skillsInput: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill() } }}
                      placeholder="e.g. 3D Rendering, Vray — press Enter" style={input} />
                  </div>
                  {form.skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {form.skills.map(s => (
                        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', background: 'var(--bg-tag)', color: 'var(--text-muted)', padding: '3px 6px 3px 9px', borderRadius: '999px' }}>
                          {s}
                          <button onClick={() => removeSkill(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 0 }}><X size={11} strokeWidth={2} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={submitPost} disabled={posting}
                  style={{ padding: '9px 20px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: posting ? 0.6 : 1 }}>
                  {posting ? 'Posting…' : 'Post project'}
                </button>
                {postMsg && <span style={{ fontSize: '12.5px', color: 'var(--error)' }}>{postMsg}</span>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {(['open', 'mine'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid ' + (tab === t ? 'var(--accent)' : 'var(--border)'),
                  background: tab === t ? 'var(--accent-dim)' : 'transparent',
                  color: tab === t ? 'var(--accent)' : 'var(--text-muted)' }}>
                {t === 'open' ? 'Open board' : 'My projects'}
              </button>
            ))}
          </div>

          {loading ? (
            <LoadingState fullPage />
          ) : projects.length === 0 ? (
            <EmptyState icon={Briefcase}
              title={tab === 'open' ? 'No open projects right now' : "You haven't posted any projects yet"}
              description={tab === 'open' ? 'Check back soon, or post your own project to get started.' : 'Post a project to start receiving proposals from freelancers.'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '32px' }}>
              {projects.map(p => {
                const sm = STATUS_META[p.status] || STATUS_META.open
                const budget = budgetLabel(p)
                const proposalMeta = p.my_proposal_status ? PROPOSAL_STATUS_META[p.my_proposal_status] : null
                return (
                  <a key={p.id} href={`/projects/${p.id}`}
                    onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); setPreviewProject(p) } }}
                    style={{ display: 'block', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 18px', textDecoration: 'none', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text)' }}>{p.title}</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
                          {p.category && <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>{p.category}</span>}
                        </div>
                        {p.description && (
                          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {p.description}
                          </p>
                        )}
                        {p.skills?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                            {p.skills.slice(0, 5).map(s => <span key={s} style={{ fontSize: '10.5px', background: 'var(--bg-tag)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '999px' }}>{s}</span>)}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-dim)' }}>
                          {budget && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DollarSign size={12} strokeWidth={1.75} />{budget}</span>}
                          {p.deadline && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: p.deadline_days_left != null && p.deadline_days_left <= 3 ? 'var(--warning)' : 'var(--text-dim)' }}>
                              <Calendar size={12} strokeWidth={1.75} />{new Date(p.deadline).toLocaleDateString()}
                            </span>
                          )}
                          {p.experience_level && EXPERIENCE_META[p.experience_level] && (
                            <span>{EXPERIENCE_META[p.experience_level]}</span>
                          )}
                          {!p.is_owner && (
                            <span onClick={e => { e.preventDefault(); e.stopPropagation(); window.location.href = `/members/${p.client_id}` }}
                              style={{ cursor: 'pointer', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              Posted by {p.client_name || 'a client'}{p.client_verified && <VerifiedBadge size={11} />}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {p.is_owner ? (
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' }}>{p.proposal_count} {p.proposal_count === 1 ? 'proposal' : 'proposals'}</span>
                        ) : proposalMeta ? (
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: proposalMeta.color }}>{proposalMeta.label}</span>
                        ) : null}
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <ProjectPreviewDrawer project={previewProject} onClose={() => setPreviewProject(null)} />
    </div>
  )
}
