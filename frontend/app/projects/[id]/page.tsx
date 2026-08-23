'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import { useIsMobile } from '../../hooks/useIsMobile'

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

interface Proposal {
  id: number
  project_id: number
  freelancer_id: number
  freelancer_name: string | null
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
  open:        { color: '#60A5FA', bg: 'rgba(79,123,247,0.12)', label: 'Open' },
  in_progress: { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', label: 'In progress' },
  completed:   { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Completed' },
  cancelled:   { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Cancelled' },
}

const PROPOSAL_STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending:   { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', label: 'Pending' },
  accepted:  { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Accepted' },
  rejected:  { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Rejected' },
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

  const uploadSample = async (file: File) => {
    setUploading(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await axios.post(`${API}/auth/upload/receipt`, fd)
      setSample({ url: r.data.url, name: file.name })
    } catch (e: any) {
      setMsg(`✗ ${e.response?.data?.detail || 'Could not upload the file'}`)
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
  useEffect(() => { if (id) load() }, [id])

  const submitProposal = async () => {
    if (!form.proposed_amount) { setMsg('✗ Proposed amount is required'); return }
    setBusy('submit'); setMsg('')
    try {
      await axios.post(`${API}/marketplace/projects/${id}/proposals`, {
        cover_letter: form.cover_letter.trim() || null,
        proposed_amount: Number(form.proposed_amount),
        proposed_days: form.proposed_days ? Number(form.proposed_days) : null,
        attachment_url: sample?.url || null,
      })
      setMsg('✓ Proposal submitted')
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not submit proposal'}`) }
    setBusy(null)
  }

  const acceptProposal = async (proposalId: number) => {
    if (!window.confirm('Accept this proposal? A contract will be created and every other proposal on this project will be rejected.')) return
    setBusy(proposalId); setMsg('')
    try {
      await axios.post(`${API}/marketplace/proposals/${proposalId}/accept`, {})
      setMsg('✓ Proposal accepted — contract created')
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not accept'}`) }
    setBusy(null)
  }

  const rejectProposal = async (proposalId: number) => {
    setBusy(proposalId); setMsg('')
    try {
      await axios.post(`${API}/marketplace/proposals/${proposalId}/reject`)
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not reject'}`) }
    setBusy(null)
  }

  const withdrawProposal = async (proposalId: number) => {
    setBusy(proposalId); setMsg('')
    try {
      await axios.post(`${API}/marketplace/proposals/${proposalId}/withdraw`)
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not withdraw'}`) }
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
          <a href="/projects" style={{ fontSize: '12.5px', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-block', marginBottom: '14px' }}>← Back to projects</a>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
          ) : notFound || !project ? (
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
              Project not found.
            </div>
          ) : (
            <>
              <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <h1 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{project.title}</h1>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: (STATUS_META[project.status] || STATUS_META.open).color, background: (STATUS_META[project.status] || STATUS_META.open).bg }}>
                    {(STATUS_META[project.status] || STATUS_META.open).label}
                  </span>
                  {project.category && <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{project.category}</span>}
                </div>
                {project.description && <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{project.description}</p>}
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12.5px', color: 'var(--text-dim)' }}>
                  {budget && <span>💰 {budget}</span>}
                  {project.deadline && <span>📅 Due {new Date(project.deadline).toLocaleDateString()}</span>}
                  {!project.is_owner && <span>Posted by {project.client_name || 'a client'}</span>}
                </div>
              </div>

              {msg && <p style={{ fontSize: '12.5px', color: msg.startsWith('✓') ? '#34D399' : '#F87171', marginBottom: '14px' }}>{msg}</p>}

              {project.is_owner ? (
                <>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '10px' }}>
                    Proposals ({proposals.length})
                  </p>
                  {proposals.length === 0 ? (
                    <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                      No proposals yet.
                    </div>
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
                                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '2px solid rgba(79,123,247,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)' }}>
                                      {p.freelancer_avatar
                                        ? <img src={p.freelancer_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{initials}</span>}
                                    </div>
                                  )
                                  return p.freelancer_username
                                    ? <a href={`/u/${p.freelancer_username}`} target="_blank" rel="noreferrer" title="View portfolio">{avatarEl}</a>
                                    : avatarEl
                                })()}

                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                    {p.freelancer_username ? (
                                      <a href={`/u/${p.freelancer_username}`} target="_blank" rel="noreferrer"
                                        style={{ fontSize: '13.5px', fontWeight: 600, color: '#60A5FA', textDecoration: 'none' }}>
                                        {p.freelancer_name || 'Freelancer'} ↗
                                      </a>
                                    ) : (
                                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>{p.freelancer_name || 'Freelancer'}</span>
                                    )}
                                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', color: pm.color, background: pm.bg }}>{pm.label}</span>
                                  </div>

                                  {/* Track record — what the hiring decision rests on */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '11.5px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                                    {p.freelancer_review_count > 0 ? (
                                      <span style={{ color: '#FBBF24' }}>★ {p.freelancer_rating} <span style={{ color: 'var(--text-dim)' }}>({p.freelancer_review_count})</span></span>
                                    ) : (
                                      <span>No reviews yet</span>
                                    )}
                                    {p.freelancer_completed_contracts > 0 && (
                                      <span>✓ {p.freelancer_completed_contracts} completed</span>
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
                                      style={{ fontSize: '12px', color: '#60A5FA', textDecoration: 'none' }}>📎 Work sample</a>
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
                <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                  This project is no longer accepting proposals.
                </div>
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
                        <a href={sample.url} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: '#34D399', textDecoration: 'none' }}>📎 {sample.name}</a>
                        <button onClick={() => setSample(null)} style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                      </div>
                    ) : (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px dashed var(--border)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
                        📎 {uploading ? 'Uploading…' : 'Attach an image or PDF'}
                        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadSample(f); e.target.value = '' }} />
                      </label>
                    )}
                  </div>
                  <button onClick={submitProposal} disabled={busy === 'submit'}
                    style={{ padding: '9px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer', opacity: busy === 'submit' ? 0.6 : 1 }}>
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
