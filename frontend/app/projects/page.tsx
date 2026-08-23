'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import MarketplaceBeta, { BetaTag } from '../components/MarketplaceBeta'
import { useIsMobile } from '../hooks/useIsMobile'

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
  status: string
  created_at: string
  client_id: number
  client_name: string | null
  is_owner: boolean
  proposal_count: number
  my_proposal_status: string | null
  my_proposal_id: number | null
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  open:        { color: '#60A5FA', bg: 'rgba(79,123,247,0.12)', label: 'Open' },
  in_progress: { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', label: 'In progress' },
  completed:   { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Completed' },
  cancelled:   { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Cancelled' },
}

const PROPOSAL_STATUS_META: Record<string, { color: string; label: string }> = {
  pending:   { color: '#FBBF24', label: 'Proposal pending' },
  accepted:  { color: '#34D399', label: 'Proposal accepted' },
  rejected:  { color: '#F87171', label: 'Proposal rejected' },
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
  const [posting, setPosting] = useState(false)
  const [postMsg, setPostMsg] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', category: '', budget_min: '', budget_max: '', currency: 'USD', deadline: '',
  })

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
    if (!form.title.trim()) { setPostMsg('✗ Title is required'); return }
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
      })
      setForm({ title: '', description: '', category: '', budget_min: '', budget_max: '', currency: 'USD', deadline: '' })
      setShowPost(false)
      setTab('mine')
      load()
    } catch (e: any) {
      setPostMsg(`✗ ${e.response?.data?.detail || 'Could not post project'}`)
    }
    setPosting(false)
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px',
    fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  }
  const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', height: '100vh', overflowY: 'auto', padding: isMobile ? '72px 16px 32px' : '32px 40px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Projects</h1>
              <BetaTag />
            </div>
            <button onClick={() => setShowPost(s => !s)}
              style={{ padding: '9px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer' }}>
              {showPost ? 'Cancel' : '+ Post a Project'}
            </button>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px' }}>
            {accountMode === 'client'
              ? 'Post a project to get proposals from freelancers. You can also browse the open board and propose on other people’s work.'
              : 'Browse open projects and send a proposal. You can post your own project here too — same account, no switching needed.'}
          </p>

          <MarketplaceBeta />

          {showPost && (
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '18px', marginBottom: '20px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={submitPost} disabled={posting}
                  style={{ padding: '9px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer', opacity: posting ? 0.6 : 1 }}>
                  {posting ? 'Posting…' : 'Post project'}
                </button>
                {postMsg && <span style={{ fontSize: '12.5px', color: '#F87171' }}>{postMsg}</span>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {(['open', 'mine'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid ' + (tab === t ? 'rgba(79,123,247,0.4)' : 'var(--border)'),
                  background: tab === t ? 'rgba(79,123,247,0.15)' : 'transparent',
                  color: tab === t ? '#60A5FA' : 'var(--text-muted)' }}>
                {t === 'open' ? 'Open board' : 'My projects'}
              </button>
            ))}
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
          ) : projects.length === 0 ? (
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
              {tab === 'open' ? 'No open projects right now.' : "You haven't posted any projects yet."}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '32px' }}>
              {projects.map(p => {
                const sm = STATUS_META[p.status] || STATUS_META.open
                const budget = budgetLabel(p)
                const proposalMeta = p.my_proposal_status ? PROPOSAL_STATUS_META[p.my_proposal_status] : null
                return (
                  <a key={p.id} href={`/projects/${p.id}`}
                    style={{ display: 'block', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 18px', textDecoration: 'none', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.35)' }}
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
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-dim)' }}>
                          {budget && <span>💰 {budget}</span>}
                          {p.deadline && <span>📅 {new Date(p.deadline).toLocaleDateString()}</span>}
                          {!p.is_owner && <span>Posted by {p.client_name || 'a client'}</span>}
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
      </main>
    </div>
  )
}
