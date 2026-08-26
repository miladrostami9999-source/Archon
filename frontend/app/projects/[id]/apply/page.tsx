'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import Sidebar from '../../../components/Sidebar'
import EmptyState from '../../../components/EmptyState'
import LoadingState from '../../../components/LoadingState'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { ArrowLeft, DollarSign, Calendar, Tag, Paperclip, CheckCircle2, SearchX } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const MAX_HIGHLIGHTS = 4

interface Project {
  id: number
  title: string
  category: string | null
  budget_min: number | null
  budget_max: number | null
  currency: string
  deadline: string | null
  experience_level: string | null
  status: string
  my_proposal_status: string | null
  is_owner: boolean
}

interface PortfolioItem {
  id: string
  title: string
  desc?: string
  images: { id: string; data: string }[]
}

const EXPERIENCE_META: Record<string, string> = { entry: 'Entry level', intermediate: 'Intermediate', expert: 'Expert' }

const budgetLabel = (p: Project) => {
  if (!p.budget_min && !p.budget_max) return null
  if (p.budget_min && p.budget_max) return `${p.budget_min.toLocaleString('en-US')}–${p.budget_max.toLocaleString('en-US')} ${p.currency}`
  return `${(p.budget_min || p.budget_max)!.toLocaleString('en-US')} ${p.currency}`
}

const card: React.CSSProperties = { borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: '16px' }
const sectionTitle: React.CSSProperties = { fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '9px 11px',
  fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
}
const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }

export default function ApplyToProjectPage() {
  const params = useParams()
  const id = params?.id
  const isMobile = useIsMobile()

  const [project, setProject] = useState<Project | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [coverLetter, setCoverLetter] = useState('')
  const [proposedAmount, setProposedAmount] = useState('')
  const [proposedDays, setProposedDays] = useState('')
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      axios.get(`${API}/marketplace/projects/${id}`),
      axios.get(`${API}/auth/profile/me`).catch(() => ({ data: {} })),
    ])
      .then(([pr, prof]) => {
        setProject(pr.data)
        setPortfolio(prof.data.portfolio || [])
      })
      .catch((e) => {
        if (e.response?.status === 404) setNotFound(true)
        else if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard'
      })
      .finally(() => setLoading(false))
  }, [id])

  const toggleHighlight = (itemId: string) => {
    setSelectedHighlights(sel => {
      if (sel.includes(itemId)) return sel.filter(x => x !== itemId)
      if (sel.length >= MAX_HIGHLIGHTS) return sel
      return [...sel, itemId]
    })
  }

  const uploadAttachment = async (file: File) => {
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await axios.post(`${API}/auth/upload/receipt`, fd)
      setAttachment({ url: r.data.url, name: file.name })
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Could not upload the file')
    }
    setUploading(false)
  }

  const submit = async () => {
    if (!proposedAmount) { setError('Enter your proposed amount'); return }
    setBusy(true); setError('')
    try {
      const highlights = portfolio
        .filter(p => selectedHighlights.includes(p.id))
        .map(p => ({ id: p.id, title: p.title, image: p.images?.[0]?.data || undefined }))
      await axios.post(`${API}/marketplace/projects/${id}/proposals`, {
        cover_letter: coverLetter.trim() || null,
        proposed_amount: Number(proposedAmount),
        proposed_days: proposedDays ? Number(proposedDays) : null,
        attachment_url: attachment?.url || null,
        highlighted_portfolio: highlights.length ? highlights : null,
      })
      window.location.href = `/projects/${id}`
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Could not submit proposal')
      setBusy(false)
    }
  }

  const budget = project ? budgetLabel(project) : null
  const alreadyBlocked = project && (project.is_owner || project.status !== 'open' || !!project.my_proposal_status)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', padding: isMobile ? '72px 16px 40px' : '32px 40px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <a href={`/projects/${id}`} style={{ fontSize: '12.5px', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '18px' }}>
            <ArrowLeft size={13} strokeWidth={1.75} />Back to project
          </a>

          {loading ? (
            <LoadingState fullPage />
          ) : notFound || !project ? (
            <EmptyState icon={SearchX} title="Project not found" description="It may have been removed or the link is incorrect." />
          ) : alreadyBlocked ? (
            <EmptyState icon={CheckCircle2} title="Can't apply here"
              description={project.is_owner ? "You can't propose on your own project." : project.my_proposal_status ? 'You already submitted a proposal for this project.' : 'This project is no longer accepting proposals.'} />
          ) : (
            <>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>Submit a proposal</h1>

              {/* Job details recap */}
              <div style={card}>
                <p style={sectionTitle}>Job details</p>
                <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>{project.title}</p>
                {project.category && <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '0 0 14px' }}>{project.category}</p>}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {budget && (
                    <div style={{ flex: '1 1 140px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                      <DollarSign size={14} strokeWidth={1.75} color="var(--text-dim)" />
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>{budget}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Client's budget</div>
                    </div>
                  )}
                  <div style={{ flex: '1 1 140px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                    <Tag size={14} strokeWidth={1.75} color="var(--text-dim)" />
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>{project.experience_level && EXPERIENCE_META[project.experience_level] ? EXPERIENCE_META[project.experience_level] : 'Any level'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Experience level</div>
                  </div>
                  {project.deadline && (
                    <div style={{ flex: '1 1 140px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                      <Calendar size={14} strokeWidth={1.75} color="var(--text-dim)" />
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>{new Date(project.deadline).toLocaleDateString()}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Deadline</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Terms and payment */}
              <div style={card}>
                <p style={sectionTitle}>Terms and payment</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={label}>Your proposed amount ({project.currency})</label>
                    <input type="number" value={proposedAmount} onChange={e => setProposedAmount(e.target.value)} placeholder="0" style={input} />
                  </div>
                  <div>
                    <label style={label}>Estimated days to complete</label>
                    <input type="number" value={proposedDays} onChange={e => setProposedDays(e.target.value)} placeholder="0" style={input} />
                  </div>
                </div>
              </div>

              {/* Additional details */}
              <div style={card}>
                <p style={sectionTitle}>Additional details</p>
                <div style={{ marginBottom: '14px' }}>
                  <label style={label}>Cover letter</label>
                  <textarea rows={5} value={coverLetter} onChange={e => setCoverLetter(e.target.value)} placeholder="Why you're a good fit for this project" style={{ ...input, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={label}>Attachment <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
                  {attachment ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <a href={attachment.url} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: 'var(--success)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Paperclip size={12} strokeWidth={1.75} />{attachment.name}</a>
                      <button onClick={() => setAttachment(null)} style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                    </div>
                  ) : (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px dashed var(--border)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <Paperclip size={12} strokeWidth={1.75} />{uploading ? 'Uploading…' : 'Attach an image or PDF'}
                      <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); e.target.value = '' }} />
                    </label>
                  )}
                </div>
              </div>

              {/* Profile highlights */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <p style={{ ...sectionTitle, margin: 0 }}>Profile highlights</p>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{selectedHighlights.length}/{MAX_HIGHLIGHTS} selected</span>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 14px' }}>
                  Pick up to {MAX_HIGHLIGHTS} portfolio pieces to show the client alongside this proposal.
                </p>
                {portfolio.length === 0 ? (
                  <EmptyState compact icon={CheckCircle2} title="No portfolio items yet" description="Add work to your profile's portfolio to feature it here." />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px' }}>
                    {portfolio.map(p => {
                      const selected = selectedHighlights.includes(p.id)
                      const disabled = !selected && selectedHighlights.length >= MAX_HIGHLIGHTS
                      return (
                        <button key={p.id} onClick={() => toggleHighlight(p.id)} disabled={disabled}
                          style={{
                            position: 'relative', textAlign: 'left', padding: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: disabled ? 'not-allowed' : 'pointer',
                            border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--bg-input)', opacity: disabled ? 0.45 : 1,
                          }}>
                          <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: 'var(--bg-tag)' }}>
                            {p.images?.[0]?.data
                              ? <img src={p.images[0].data} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>No image</div>}
                          </div>
                          <div style={{ padding: '6px 8px', fontSize: '11.5px', color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                          {selected && (
                            <div style={{ position: 'absolute', top: '6px', right: '6px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CheckCircle2 size={14} strokeWidth={2.5} color="white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {error && <p style={{ fontSize: '12.5px', color: 'var(--error)', margin: '0 0 14px' }}>{error}</p>}

              <button onClick={submit} disabled={busy}
                style={{ width: '100%', padding: '13px', borderRadius: 'var(--radius-md)', fontSize: '14.5px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Sending…' : 'Send proposal'}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
