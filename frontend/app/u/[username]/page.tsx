'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import VerifiedBadge from '../../components/VerifiedBadge'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface PortfolioImage { id: string; data: string; name: string; alt?: string }
interface PortfolioItem { id: string; title: string; desc: string; url: string; images: PortfolioImage[] }
interface PublicProfile {
  name: string; username: string; is_verified: boolean; avatar: string; bio: string
  location: string; website: string; company: string
  skills: string[]; customSkills: string[]; portfolio: PortfolioItem[]
  marketplace_rating: number | null; marketplace_review_count: number
  marketplace_satisfaction: number | null
  marketplace_completed_contracts: number
  marketplace_reviews: { rating: number; comment: string | null; reviewer_name: string; created_at: string }[]
  user_id: number
}

export default function PublicProfilePage() {
  const params = useParams()
  const username = params?.username as string
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedProject, setSelectedProject] = useState<PortfolioItem | null>(null)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const [messaging, setMessaging] = useState(false)
  const [msgError, setMsgError] = useState('')

  const messageThem = async () => {
    if (!profile) return
    if (!localStorage.getItem('archon-token')) {
      window.location.href = '/login'
      return
    }
    setMessaging(true); setMsgError('')
    try {
      const token = localStorage.getItem('archon-token')
      await axios.post(`${API}/marketplace/conversations/start`, { user_id: profile.user_id },
        { headers: { Authorization: `Bearer ${token}` } })
      window.location.href = '/messages'
    } catch (e: any) {
      setMsgError(e.response?.data?.detail || 'Could not open a conversation.')
      setMessaging(false)
    }
  }

  useEffect(() => {
    if (!username) return
    axios.get(`${API}/auth/profile/public/${username}`)
      .then(res => setProfile(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [username])

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const allSkills = profile ? [...(profile.skills || []), ...(profile.customSkills || [])] : []

  // ── LOADING ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0E15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '28px', height: '28px', border: '2px solid rgba(79,123,247,0.2)', borderTop: '2px solid #4F7BF7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── NOT FOUND ──
  if (notFound || !profile) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0E15', color: '#E7EAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', fontFamily: 'Inter, sans-serif', padding: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '48px', opacity: 0.15, margin: 0 }}>🔍</p>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Profile not found</h1>
        <p style={{ fontSize: '14px', color: 'rgba(231,234,240,0.5)', margin: 0 }}>This profile doesn't exist or hasn't been made public yet.</p>
        <a href="/" style={{ marginTop: '12px', fontSize: '13px', color: '#8FB3FF', textDecoration: 'none' }}>← Back to Archon</a>
      </div>
    )
  }

  // ── PROFILE ──
  return (
    <div style={{ minHeight: '100vh', background: '#0B0E15', color: '#E7EAF0', fontFamily: 'Inter, -apple-system, sans-serif' }}>

      {/* LIGHTBOX */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', backdropFilter: 'blur(8px)' }}>
          <img src={lightboxImg} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
        </div>
      )}

      {/* PROJECT MODAL */}
      {selectedProject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '20px' }}>
          <div style={{ background: '#11151F', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.09)', width: '100%', maxWidth: '800px', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#11151F' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{selectedProject.title}</h2>
                {selectedProject.desc && <p style={{ fontSize: '13px', color: 'rgba(231,234,240,0.6)', margin: '4px 0 0' }}>{selectedProject.desc}</p>}
              </div>
              <button onClick={() => setSelectedProject(null)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#E7EAF0', cursor: 'pointer', fontSize: '15px' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {selectedProject.images.length === 0 ? (
                <p style={{ color: 'rgba(231,234,240,0.4)', fontSize: '13px' }}>No images for this project.</p>
              ) : selectedProject.images.map(img => (
                <div key={img.id}>
                  <div onClick={() => setLightboxImg(img.data)} style={{ borderRadius: '10px', overflow: 'hidden', cursor: 'zoom-in', aspectRatio: '4/3', background: 'rgba(255,255,255,0.03)' }}>
                    <img src={img.data} alt={img.alt || img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  {img.alt && (
                    <p style={{ fontSize: '12px', color: 'rgba(231,234,240,0.5)', margin: '6px 2px 0', lineHeight: 1.5 }}>{img.alt}</p>
                  )}
                </div>
              ))}
              {selectedProject.url && (
                <a href={selectedProject.url} target="_blank" style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: '13px', color: '#8FB3FF', padding: '10px', border: '1px solid rgba(79,123,247,0.2)', borderRadius: '10px', textDecoration: 'none', background: 'rgba(79,123,247,0.06)' }}>
                  🔗 View External Link
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HERO */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '64px 24px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <div style={{ width: '84px', height: '84px', borderRadius: '20px', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(79,123,247,0.3)' }}>
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '30px', fontWeight: 800, color: 'white' }}>{initials(profile.name)}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {profile.name}{profile.is_verified && <VerifiedBadge size={19} />}
            </h1>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '13px', color: 'rgba(231,234,240,0.55)' }}>
              {profile.marketplace_review_count > 0 && (
                <span style={{ color: '#FBBF24' }}>★ {profile.marketplace_rating} <span style={{ color: 'rgba(231,234,240,0.55)' }}>({profile.marketplace_review_count} contract{profile.marketplace_review_count === 1 ? '' : 's'})</span></span>
              )}
              {profile.company && <span>🏢 {profile.company}</span>}
              {profile.location && <span>📍 {profile.location}</span>}
              {profile.website && <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" style={{ color: '#8FB3FF', textDecoration: 'none' }}>🌐 {profile.website.replace(/^https?:\/\//, '')}</a>}
            </div>
          </div>
          {/* Anyone signed in can start a conversation from here — the point
              of a public profile is being reachable. */}
          <button onClick={messageThem} disabled={messaging}
            style={{ flexShrink: 0, padding: '10px 20px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer', opacity: messaging ? 0.6 : 1 }}>
            {messaging ? 'Opening…' : '💬 Message'}
          </button>
        </div>
        {msgError && <p style={{ fontSize: '12.5px', color: '#F87171', margin: '-12px 0 16px' }}>{msgError}</p>}

        {profile.bio && (
          <p style={{ fontSize: '15px', color: 'rgba(231,234,240,0.75)', lineHeight: 1.7, marginBottom: '24px', maxWidth: '680px' }}>{profile.bio}</p>
        )}

        {allSkills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {allSkills.map(skill => (
              <span key={skill} style={{ fontSize: '12px', fontWeight: 600, color: '#8FB3FF', background: 'rgba(79,123,247,0.1)', border: '1px solid rgba(79,123,247,0.2)', padding: '5px 13px', borderRadius: '999px' }}>
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* REPUTATION — what people who actually worked with them said. A score
          on its own tells a prospective client nothing, so the comments are
          shown in full. */}
      {profile.marketplace_review_count > 0 && (
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '20px 24px 0' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(231,234,240,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px' }}>
            Reputation
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {([
              ['★ ' + profile.marketplace_rating, 'Average rating', '#FBBF24'],
              [`${profile.marketplace_satisfaction}%`, 'Satisfaction', '#34D399'],
              [String(profile.marketplace_completed_contracts), 'Contracts completed', '#60A5FA'],
              [String(profile.marketplace_review_count), 'Reviews', '#A78BFA'],
            ] as [string, string, string][]).map(([value, name, color]) => (
              <div key={name} style={{ flex: '1 1 130px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px 16px' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color, marginBottom: '2px' }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'rgba(231,234,240,0.45)' }}>{name}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {profile.marketplace_reviews.map((r, i) => (
              <div key={i} style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: r.comment ? '6px' : 0 }}>
                  <span style={{ fontSize: '13px', color: '#FBBF24', letterSpacing: '1px' }}>
                    {'★'.repeat(r.rating)}<span style={{ color: 'rgba(255,255,255,0.15)' }}>{'★'.repeat(5 - r.rating)}</span>
                  </span>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'rgba(231,234,240,0.8)' }}>{r.reviewer_name}</span>
                  <span style={{ fontSize: '11px', color: 'rgba(231,234,240,0.35)', marginLeft: 'auto' }}>
                    {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {r.comment && (
                  <p style={{ fontSize: '13px', color: 'rgba(231,234,240,0.7)', margin: 0, lineHeight: 1.6 }}>{r.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PORTFOLIO */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '20px 24px 80px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(231,234,240,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px' }}>
          Portfolio
        </p>

        {(!profile.portfolio || profile.portfolio.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(231,234,240,0.3)' }}>
            <p style={{ fontSize: '36px', marginBottom: '10px' }}>🏛</p>
            <p style={{ fontSize: '14px' }}>No portfolio items yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {profile.portfolio.map(item => {
              const cover = item.images?.[0]
              return (
                <div key={item.id} onClick={() => setSelectedProject(item)}
                  style={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.35)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.transform = 'none' }}>
                  <div style={{ height: '160px', background: 'linear-gradient(135deg, rgba(79,123,247,0.08), rgba(124,58,237,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {cover ? (
                      <img src={cover.data} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '40px', opacity: 0.15 }}>🏛</span>
                    )}
                    {item.images?.length > 1 && (
                      <span style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', borderRadius: '999px', padding: '2px 9px', fontSize: '11px', fontWeight: 600 }}>
                        +{item.images.length - 1}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px' }}>{item.title}</h4>
                    {item.desc && <p style={{ fontSize: '12px', color: 'rgba(231,234,240,0.5)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{item.desc}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px', textAlign: 'center' }}>
        <a href="/" style={{ fontSize: '12px', color: 'rgba(231,234,240,0.35)', textDecoration: 'none' }}>
          Powered by <strong style={{ color: 'rgba(231,234,240,0.6)' }}>Archon</strong>
        </a>
      </div>
    </div>
  )
}
