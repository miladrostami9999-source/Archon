'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import VerifiedBadge from '../../components/VerifiedBadge'
import { useIsMobile } from '../../hooks/useIsMobile'
import PortfolioGrid, { type PortfolioItem } from '../../components/PortfolioGrid'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Member {
  id: number; name: string; username: string | null; is_public: boolean
  is_verified: boolean
  account_mode: string; avatar: string; bio: string; location: string
  website: string; company: string
  skills: string[]; customSkills: string[]; portfolio: PortfolioItem[]
  rating: number | null; review_count: number
  satisfaction: number | null; completed_contracts: number
  reviews: { rating: number; comment: string | null; reviewer_name: string; reviewer_id: number; reviewer_verified: boolean; created_at: string }[]
  is_me: boolean
}

interface Post {
  id: number; text: string; image_url: string | null; created_at: string
  like_count: number; comment_count: number
}

export default function MemberProfilePage() {
  const params = useParams()
  const id = params?.id
  const isMobile = useIsMobile()
  const [m, setM] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [err, setErr] = useState('')
  const [posts, setPosts] = useState<Post[]>([])

  useEffect(() => {
    if (!id) return
    axios.get(`${API}/marketplace/members/${id}`)
      .then(r => setM(r.data))
      .catch(e => {
        if (e.response?.status === 404) setNotFound(true)
        else if (e.response?.status === 401) window.location.href = '/login'
      })
      .finally(() => setLoading(false))

    axios.get(`${API}/marketplace/feed/users/${id}/posts`)
      .then(r => setPosts(r.data.items))
      .catch(() => {})
  }, [id])

  const message = async () => {
    if (!m) return
    setMessaging(true); setErr('')
    try {
      await axios.post(`${API}/marketplace/conversations/start`, { user_id: m.id })
      window.location.href = '/messages'
    } catch (e: any) {
      setErr(e.response?.data?.detail || 'Could not open a conversation.')
      setMessaging(false)
    }
  }

  const initials = (m?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const allSkills = m ? [...(m.skills || []), ...(m.customSkills || [])] : []

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', height: '100vh', overflowY: 'auto', padding: isMobile ? '72px 16px 32px' : '32px 40px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <button onClick={() => window.history.back()}
            style={{ fontSize: '12.5px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>← Back</button>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
          ) : notFound || !m ? (
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
              Member not found.
            </div>
          ) : (
            <>
              {/* HEADER */}
              <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '22px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: '68px', height: '68px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: '2px solid rgba(61,79,224,0.25)' }}>
                    {m.avatar
                      ? <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '22px', fontWeight: 800, color: 'white' }}>{initials}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <h1 style={{ fontSize: '21px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                      {m.name}{m.is_verified && <VerifiedBadge size={17} />}
                    </h1>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12.5px', color: 'var(--text-dim)' }}>
                      <span>{m.account_mode === 'client' ? '💼 Hires' : '🎨 Takes work'}</span>
                      {m.company && <span>🏢 {m.company}</span>}
                      {m.location && <span>📍 {m.location}</span>}
                      {m.review_count > 0 && <span style={{ color: '#FBBF24' }}>★ {m.rating} ({m.review_count})</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {m.is_public && m.username && (
                      <a href={`/u/${m.username}`} target="_blank" rel="noreferrer"
                        style={{ padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', textDecoration: 'none' }}>
                        Public page ↗
                      </a>
                    )}
                    {!m.is_me && (
                      <button onClick={message} disabled={messaging}
                        style={{ padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: messaging ? 0.6 : 1 }}>
                        {messaging ? 'Opening…' : '💬 Message'}
                      </button>
                    )}
                  </div>
                </div>
                {m.bio && <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, margin: '14px 0 0' }}>{m.bio}</p>}
                {allSkills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                    {allSkills.map(s => (
                      <span key={s} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', color: '#60A5FA', background: 'rgba(61,79,224,0.1)', border: '1px solid rgba(61,79,224,0.2)' }}>{s}</span>
                    ))}
                  </div>
                )}
                {err && <p style={{ fontSize: '12.5px', color: '#F87171', margin: '10px 0 0' }}>{err}</p>}
              </div>

              {/* REPUTATION */}
              {m.review_count > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '10px' }}>Reputation</p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {([
                      ['★ ' + m.rating, 'Average', '#FBBF24'],
                      [`${m.satisfaction}%`, 'Satisfaction', '#34D399'],
                      [String(m.completed_contracts), 'Completed', '#60A5FA'],
                      [String(m.review_count), 'Reviews', '#A78BFA'],
                    ] as [string, string, string][]).map(([v, name, color]) => (
                      <div key={name} style={{ flex: '1 1 120px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '13px 15px' }}>
                        <div style={{ fontSize: '19px', fontWeight: 800, color, marginBottom: '2px' }}>{v}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{name}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {m.reviews.map((r, i) => (
                      <div key={i} style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '13px 15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: r.comment ? '5px' : 0 }}>
                          <span style={{ fontSize: '13px', color: '#FBBF24', letterSpacing: '1px' }}>
                            {'★'.repeat(r.rating)}<span style={{ opacity: 0.25 }}>{'★'.repeat(5 - r.rating)}</span>
                          </span>
                          <a href={`/members/${r.reviewer_id}`} style={{ fontSize: '12.5px', fontWeight: 600, color: '#60A5FA', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{r.reviewer_name}{r.reviewer_verified && <VerifiedBadge size={11} />}</a>
                          <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                            {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        {r.comment && <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* POSTS */}
              {posts.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '10px' }}>Posts</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {posts.map(p => (
                      <div key={p.id} style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '14px 16px' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text)', margin: '0 0 8px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{p.text}</p>
                        {p.image_url && <img src={p.image_url} alt="" style={{ maxWidth: '100%', borderRadius: '10px', marginBottom: '8px', display: 'block' }} />}
                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-dim)' }}>
                          <span>{new Date(p.created_at).toLocaleDateString()}</span>
                          <span>♡ {p.like_count}</span>
                          <span>💬 {p.comment_count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PORTFOLIO */}
              <div style={{ paddingBottom: '32px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '10px' }}>Portfolio</p>
                <PortfolioGrid items={m.portfolio} isMobile={isMobile}
                  emptyTitle="No portfolio yet" emptySubtitle="This member hasn't added any projects yet." />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
