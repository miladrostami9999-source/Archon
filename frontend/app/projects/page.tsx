'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import MarketplaceBeta, { BetaTag } from '../components/MarketplaceBeta'
import VerifiedBadge from '../components/VerifiedBadge'
import RoleTag from '../components/RoleTag'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import ProjectPreviewDrawer from '../components/ProjectPreviewDrawer'
import ProposalPreviewDrawer from '../components/ProposalPreviewDrawer'
import AcceptProposalModal from '../components/AcceptProposalModal'
import { useIsMobile } from '../hooks/useIsMobile'
import { Calendar, Plus, Briefcase, X, Search, Heart, ShieldCheck, Star, MapPin, Bookmark, Inbox } from 'lucide-react'

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
  location: string | null
  created_at: string
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
  my_proposal_id: number | null
}

interface ProposalRow {
  id: number
  project_id: number
  project_title: string
  project_currency: string
  project_status: string
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
  seen_at: string | null
  created_at: string
}

const EXPERIENCE_META: Record<string, string> = { entry: 'Entry level', intermediate: 'Intermediate', expert: 'Expert' }

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  open:        { color: 'var(--accent)', bg: 'var(--accent-dim)', label: 'Open' },
  in_progress: { color: 'var(--warning)', bg: 'rgba(221,162,63,0.12)', label: 'In progress' },
  completed:   { color: 'var(--success)', bg: 'rgba(63,185,131,0.12)', label: 'Completed' },
  cancelled:   { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Cancelled' },
}

const PROPOSAL_STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending:   { color: 'var(--warning)', bg: 'rgba(221,162,63,0.12)', label: 'Proposal pending' },
  accepted:  { color: 'var(--success)', bg: 'rgba(63,185,131,0.12)', label: 'Proposal accepted' },
  rejected:  { color: 'var(--error)', bg: 'rgba(228,114,111,0.12)', label: 'Proposal rejected' },
  withdrawn: { color: 'var(--text-dim)', bg: 'var(--bg-input)', label: 'Proposal withdrawn' },
}

const budgetLabel = (p: Project) => {
  if (!p.budget_min && !p.budget_max) return null
  if (p.budget_min && p.budget_max) return `${p.budget_min.toLocaleString('en-US')}–${p.budget_max.toLocaleString('en-US')} ${p.currency}`
  return `${(p.budget_min || p.budget_max)!.toLocaleString('en-US')} ${p.currency}`
}

// Precise, ticking "posted X ago" — refined down to minutes for a fresh
// post, exactly the granularity a live marketplace board needs so a
// two-minute-old listing doesn't read the same as a two-day-old one.
const relativeTime = (iso: string, now: number) => {
  const diffMs = now - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  const mo = Math.floor(d / 30)
  return `${mo} month${mo === 1 ? '' : 's'} ago`
}

const formatSpent = (amount: number) => {
  if (amount <= 0) return null
  if (amount >= 1000) return `$${Math.floor(amount / 1000)}K+ spent`
  return `$${Math.round(amount)}+ spent`
}

export default function ProjectsPage() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<'open' | 'mine' | 'saved' | 'proposals'>('open')
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
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [pendingProposalCount, setPendingProposalCount] = useState(0)
  const [proposalsInbox, setProposalsInbox] = useState<ProposalRow[]>([])
  const [proposalsLoading, setProposalsLoading] = useState(true)
  const [proposalsSort, setProposalsSort] = useState<'newest' | 'price_asc' | 'price_desc' | 'best_match'>('newest')
  const [proposalsStatus, setProposalsStatus] = useState<'pending' | 'all'>('pending')
  const [acceptTarget, setAcceptTarget] = useState<ProposalRow | null>(null)
  const [acceptBusy, setAcceptBusy] = useState(false)
  const [acceptError, setAcceptError] = useState('')
  const [proposalBusy, setProposalBusy] = useState<number | null>(null)
  const [previewProposal, setPreviewProposal] = useState<ProposalRow | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', category: '', budget_min: '', budget_max: '', currency: 'USD', deadline: '',
    experience_level: '', location: '', skillsInput: '', skills: [] as string[],
  })

  const addSkill = () => {
    const s = form.skillsInput.trim()
    if (s && !form.skills.includes(s)) setForm(f => ({ ...f, skills: [...f.skills, s], skillsInput: '' }))
    else setForm(f => ({ ...f, skillsInput: '' }))
  }
  const removeSkill = (s: string) => setForm(f => ({ ...f, skills: f.skills.filter(x => x !== s) }))

  const load = () => {
    const params: Record<string, any> = {}
    if (tab === 'mine') params.mine = true
    else if (tab === 'saved') params.saved = true
    if (search.trim()) params.q = search.trim()
    axios.get(`${API}/marketplace/projects`, { params })
      .then(r => setProjects(r.data))
      .catch((e) => { if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard' })
      .finally(() => setLoading(false))
  }
  // Debounced so keystrokes don't each fire a request; also the vehicle for
  // "posted X ago" and proposal counts to stay live without a manual reload.
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(load, search ? 350 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search])

  useEffect(() => {
    const poll = setInterval(load, 30000)
    return () => clearInterval(poll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search])

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(clock)
  }, [])

  useEffect(() => {
    axios.get(`${API}/auth/me`)
      .then(r => {
        const mode = r.data.account_mode === 'client' ? 'client' : 'freelancer'
        setAccountMode(mode)
        if (mode === 'client') setTab('mine')
      })
      .catch(() => setAccountMode('freelancer'))
  }, [])

  const loadPendingCount = () => {
    axios.get(`${API}/marketplace/proposals/pending-count`).then(r => setPendingProposalCount(r.data.count)).catch(() => {})
  }
  useEffect(() => {
    loadPendingCount()
    const poll = setInterval(loadPendingCount, 30000)
    return () => clearInterval(poll)
  }, [])

  const loadProposalsInbox = () => {
    setProposalsLoading(true)
    axios.get(`${API}/marketplace/proposals/inbox`, { params: { status: proposalsStatus, sort: proposalsSort } })
      .then(r => setProposalsInbox(r.data))
      .catch(() => {})
      .finally(() => setProposalsLoading(false))
  }
  useEffect(() => {
    if (tab !== 'proposals') return
    loadProposalsInbox()
    const poll = setInterval(loadProposalsInbox, 15000)
    return () => clearInterval(poll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, proposalsSort, proposalsStatus])

  const acceptInboxProposal = async (milestones: { title: string; description?: string; amount: number; due_date?: string }[] | null) => {
    if (!acceptTarget) return
    setAcceptBusy(true); setAcceptError('')
    try {
      await axios.post(`${API}/marketplace/proposals/${acceptTarget.id}/accept`, milestones ? { milestones } : {})
      setAcceptTarget(null)
      setPreviewProposal(null)
      loadProposalsInbox()
      loadPendingCount()
    } catch (e: any) { setAcceptError(e.response?.data?.detail || 'Could not accept') }
    setAcceptBusy(false)
  }

  const rejectInboxProposal = async (proposalId: number) => {
    setProposalBusy(proposalId)
    try {
      await axios.post(`${API}/marketplace/proposals/${proposalId}/reject`)
      loadProposalsInbox()
      loadPendingCount()
    } catch {}
    setProposalBusy(null)
  }

  const toggleSave = (projectId: number) => {
    setProjects(ps => ps.map(p => p.id === projectId ? { ...p, is_saved: !p.is_saved } : p))
    axios.post(`${API}/marketplace/projects/${projectId}/save`).catch(() => {
      setProjects(ps => ps.map(p => p.id === projectId ? { ...p, is_saved: !p.is_saved } : p))
    })
  }

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
        location: form.location.trim() || null,
      })
      setForm({ title: '', description: '', category: '', budget_min: '', budget_max: '', currency: 'USD', deadline: '', experience_level: '', location: '', skillsInput: '', skills: [] })
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
          {accountMode === 'client' && (
            <button onClick={() => setShowPost(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              {showPost ? 'Cancel' : <><Plus size={14} strokeWidth={2} /> {isMobile ? 'Post' : 'Post a Project'}</>}
            </button>
          )}
        </div>

        <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', maxWidth: '860px', margin: '0 auto' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px' }}>
            {accountMode === 'client'
              ? 'Post a project to get proposals from freelancers. You can also browse the open board and propose on other people’s work.'
              : 'Browse open projects and send a proposal. You can post your own project here too — same account, no switching needed.'}
          </p>

          <MarketplaceBeta />

          {showPost && accountMode === 'client' && (
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
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
                  <label style={label}>Location <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Remote, or Dubai, UAE" style={input} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={submitPost} disabled={posting}
                  style={{ padding: '9px 20px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: posting ? 0.6 : 1 }}>
                  {posting ? 'Posting…' : 'Post project'}
                </button>
                {postMsg && <span style={{ fontSize: '12.5px', color: 'var(--error)' }}>{postMsg}</span>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {/* A client only ever needs their own projects and the
                  proposals on them — they're not a freelancer here, so
                  browsing everyone else's open board (or saving one for
                  later) doesn't apply. */}
              {(accountMode === 'client' ? (['mine'] as const) : (['open', 'mine', 'saved'] as const)).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
                    border: '1px solid ' + (tab === t ? 'var(--accent)' : 'var(--border)'),
                    background: tab === t ? 'var(--accent-dim)' : 'transparent',
                    color: tab === t ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {t === 'saved' && <Bookmark size={12} strokeWidth={2} />}
                  {t === 'open' ? 'Open board' : t === 'mine' ? 'My projects' : 'Saved'}
                </button>
              ))}
              {accountMode === 'client' && (
                <button onClick={() => setTab('proposals')}
                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', position: 'relative',
                    border: '1px solid ' + (tab === 'proposals' ? 'var(--accent)' : 'var(--border)'),
                    background: tab === 'proposals' ? 'var(--accent-dim)' : 'transparent',
                    color: tab === 'proposals' ? 'var(--accent)' : 'var(--text-muted)' }}>
                  <Inbox size={12} strokeWidth={2} /> Proposals
                  {pendingProposalCount > 0 && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', background: 'var(--error)', borderRadius: '999px', padding: '1px 6px', lineHeight: 1.4 }}>{pendingProposalCount}</span>
                  )}
                </button>
              )}
            </div>
            {tab === 'proposals' ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select value={proposalsStatus} onChange={e => setProposalsStatus(e.target.value as any)} style={{ ...input, width: 'auto' }}>
                  <option value="pending">Pending</option>
                  <option value="all">All</option>
                </select>
                <select value={proposalsSort} onChange={e => setProposalsSort(e.target.value as any)} style={{ ...input, width: 'auto' }}>
                  <option value="newest">Newer</option>
                  <option value="best_match">Best matches</option>
                  <option value="price_asc">Lower price</option>
                  <option value="price_desc">Higher price</option>
                </select>
              </div>
            ) : (
              <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                <Search size={14} strokeWidth={1.75} color="var(--text-dim)" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects by keyword, skill, category…"
                  style={{ ...input, paddingLeft: '32px' }} />
              </div>
            )}
          </div>

          {tab === 'proposals' ? (
            proposalsLoading ? (
              <LoadingState fullPage />
            ) : proposalsInbox.length === 0 ? (
              <EmptyState icon={Inbox} title={proposalsStatus === 'pending' ? 'No pending proposals' : 'No proposals yet'}
                description="Proposals sent to your projects will show up here." />
            ) : (
              <>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 10px' }}>
                  {proposalsInbox.length} {proposalsInbox.length === 1 ? 'proposal' : 'proposals'} {proposalsStatus === 'pending' ? 'pending' : 'total'} in this tab
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '32px' }}>
                  {proposalsInbox.map(p => {
                    const pm = PROPOSAL_STATUS_META[p.status] || PROPOSAL_STATUS_META.pending
                    const initials = (p.freelancer_name || 'F').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                    const unseen = p.status === 'pending' && !p.seen_at
                    return (
                      <div key={p.id} onClick={() => setPreviewProposal(p)}
                        style={{ cursor: 'pointer', borderRadius: 'var(--radius-lg)', border: '1px solid ' + (unseen ? 'var(--accent)' : 'var(--border)'), background: 'var(--bg-card)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = unseen ? 'var(--accent)' : 'var(--border)' }}>
                        {unseen && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' }}>
                          {p.freelancer_avatar
                            ? <img src={p.freelancer_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{initials}</span>}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {p.freelancer_name || 'Freelancer'}{p.freelancer_verified && <VerifiedBadge size={12} />}
                            </span>
                            <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', color: 'var(--text-dim)', background: 'var(--bg-tag)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Freelancer</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', color: pm.color, background: pm.bg }}>{pm.label}</span>
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.project_title}
                            {p.freelancer_review_count > 0 && <> · <Star size={10} strokeWidth={1.75} style={{ display: 'inline', verticalAlign: '-1px', color: 'var(--warning)' }} fill="currentColor" /> {p.freelancer_rating} ({p.freelancer_review_count})</>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{p.proposed_amount?.toLocaleString('en-US')} {p.project_currency}</div>
                          {p.proposed_days ? <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{p.proposed_days} days</div> : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          ) : loading ? (
            <LoadingState fullPage />
          ) : projects.length === 0 ? (
            <EmptyState icon={tab === 'saved' ? Bookmark : Briefcase}
              title={search ? 'No projects match your search' : tab === 'open' ? 'No open projects right now' : tab === 'saved' ? 'No saved projects yet' : "You haven't posted any projects yet"}
              description={search ? 'Try a different keyword.' : tab === 'open' ? 'Check back soon, or post your own project to get started.' : tab === 'saved' ? 'Save a project from the open board to find it here later.' : 'Post a project to start receiving proposals from freelancers.'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '32px' }}>
              {projects.map(p => {
                const sm = STATUS_META[p.status] || STATUS_META.open
                const budget = budgetLabel(p)
                const proposalMeta = p.my_proposal_status ? PROPOSAL_STATUS_META[p.my_proposal_status] : null
                const spent = formatSpent(p.client_total_spent)
                return (
                  <a key={p.id} href={`/projects/${p.id}`}
                    onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); setPreviewProject(p) } }}
                    style={{ display: 'block', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '18px 20px', textDecoration: 'none', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>

                    {/* Top row: freshness + proposal count on the left, save on the right */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: sm.color, background: sm.bg }}>{sm.label}</span>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                          Posted {relativeTime(p.created_at, now)} · {p.proposal_count} {p.proposal_count === 1 ? 'proposal' : 'proposals'}
                        </span>
                      </div>
                      {!p.is_owner && (
                        <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleSave(p.id) }}
                          title={p.is_saved ? 'Remove from saved' : 'Save project'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: p.is_saved ? 'var(--error)' : 'var(--text-dim)', flexShrink: 0 }}>
                          <Heart size={17} strokeWidth={1.75} fill={p.is_saved ? 'currentColor' : 'none'} />
                        </button>
                      )}
                    </div>

                    {/* Title, larger than everything else on the card */}
                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', lineHeight: 1.35 }}>{p.title}</h3>

                    {/* Terms subline */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      <span>Fixed-price</span>
                      {p.experience_level && EXPERIENCE_META[p.experience_level] && <><span>·</span><span>{EXPERIENCE_META[p.experience_level]}</span></>}
                      {budget && <><span>·</span><span>Est. Budget: {budget}</span></>}
                    </div>

                    {p.description && (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {p.description}
                      </p>
                    )}

                    {p.skills?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {p.skills.slice(0, 6).map(s => <span key={s} style={{ fontSize: '11px', background: 'var(--bg-tag)', color: 'var(--text-muted)', padding: '3px 10px', borderRadius: '999px' }}>{s}</span>)}
                      </div>
                    )}

                    {/* Client trust row — the hiring signal a freelancer decides on */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                      {p.client_verified && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={13} strokeWidth={1.75} color="var(--accent)" />Payment verified</span>
                      )}
                      {p.client_rating != null && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Star size={13} strokeWidth={1.75} fill="currentColor" color="var(--warning)" />{p.client_rating.toFixed(1)}{p.client_review_count > 0 ? ` (${p.client_review_count})` : ''}</span>
                      )}
                      {spent && <span>{spent}</span>}
                      {p.location && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={13} strokeWidth={1.75} color="var(--text-dim)" />{p.location}</span>
                      )}
                      {proposalMeta && <span style={{ color: proposalMeta.color, fontWeight: 600, marginLeft: 'auto' }}>{proposalMeta.label}</span>}
                      {p.is_owner && (
                        <span onClick={e => { e.preventDefault() }} style={{ marginLeft: 'auto', color: 'var(--text)', fontWeight: 600 }}>
                          {p.proposal_count} {p.proposal_count === 1 ? 'proposal' : 'proposals'}
                        </span>
                      )}
                      {!p.is_owner && !proposalMeta && (
                        <span onClick={e => { e.preventDefault(); e.stopPropagation(); window.location.href = `/members/${p.client_id}` }}
                          style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {p.client_name || 'a client'}{p.client_verified && <VerifiedBadge size={11} />}
                          <RoleTag role="client" />
                        </span>
                      )}
                    </div>

                    {p.deadline && (
                      <div style={{ marginTop: '8px', fontSize: '11.5px', color: p.deadline_days_left != null && p.deadline_days_left <= 3 ? 'var(--warning)' : 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} strokeWidth={1.75} />Due {new Date(p.deadline).toLocaleDateString()}
                      </div>
                    )}
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <ProjectPreviewDrawer project={previewProject} onClose={() => setPreviewProject(null)}
        onToggleSave={id => { toggleSave(id); setPreviewProject(p => p ? { ...p, is_saved: !p.is_saved } : p) }} />
      <ProposalPreviewDrawer
        proposal={previewProposal}
        onClose={() => setPreviewProposal(null)}
        onAccept={id => { const p = proposalsInbox.find(x => x.id === id); if (p) { setAcceptTarget(p); setAcceptError('') } }}
        onReject={id => { rejectInboxProposal(id); setPreviewProposal(null) }}
        busy={proposalBusy === previewProposal?.id}
        onSeen={() => {
          loadPendingCount()
          setProposalsInbox(rows => rows.map(r => r.id === previewProposal?.id ? { ...r, seen_at: new Date().toISOString() } : r))
        }}
      />
      {acceptTarget && (
        <AcceptProposalModal
          freelancerName={acceptTarget.freelancer_name || 'This freelancer'}
          proposedAmount={acceptTarget.proposed_amount || 0}
          proposedDays={acceptTarget.proposed_days}
          currency={acceptTarget.project_currency}
          busy={acceptBusy}
          error={acceptError}
          onAccept={acceptInboxProposal}
          onClose={() => setAcceptTarget(null)}
        />
      )}
    </div>
  )
}
