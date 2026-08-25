'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import VerifiedBadge from '../../components/VerifiedBadge'
import PortfolioGrid, { type PortfolioItem } from '../../components/PortfolioGrid'
import { useIsMobile } from '../../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface EducationItem { id: string; school: string; degree: string; field: string; start_year: string; end_year: string }
interface ExperienceItem { id: string; title: string; company: string; start_date: string; end_date: string; description: string }

interface PublicProfile {
  name: string; username: string; email: string; is_verified: boolean; avatar: string
  headline: string; bio: string
  location: string; website: string; company: string
  skills: string[]; customSkills: string[]; portfolio: PortfolioItem[]
  education: EducationItem[]; experience: ExperienceItem[]
  marketplace_rating: number | null; marketplace_review_count: number
  marketplace_satisfaction: number | null
  marketplace_completed_contracts: number
  marketplace_reviews: { rating: number; comment: string | null; reviewer_name: string; created_at: string }[]
  user_id: number
}

interface Post { id: number; text: string; image_url: string | null; created_at: string; like_count: number; comment_count: number }

export default function PublicProfilePage() {
  const params = useParams()
  const username = params?.username as string
  const isMobile = useIsMobile()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedProject, setSelectedProject] = useState<PortfolioItem | null>(null)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const [messaging, setMessaging] = useState(false)
  const [msgError, setMsgError] = useState('')
  const [tab, setTab] = useState<'portfolio' | 'posts'>('portfolio')
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoaded, setPostsLoaded] = useState(false)

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

  useEffect(() => {
    if (tab !== 'posts' || postsLoaded || !username) return
    axios.get(`${API}/auth/profile/public/${username}/posts`)
      .then(res => setPosts(res.data.items || []))
      .catch(() => {})
      .finally(() => setPostsLoaded(true))
  }, [tab, username, postsLoaded])

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const allSkills = profile ? [...(profile.skills || []), ...(profile.customSkills || [])] : []

  // ── LOADING ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0E15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '28px', height: '28px', border: '2px solid rgba(61,79,224,0.2)', borderTop: '2px solid #3D4FE0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
                <a href={selectedProject.url} target="_blank" style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: '13px', color: '#8FB3FF', padding: '10px', border: '1px solid rgba(61,79,224,0.2)', borderRadius: '10px', textDecoration: 'none', background: 'rgba(61,79,224,0.06)' }}>
                  🔗 View External Link
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1040px', margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '48px 24px 60px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>

          {/* ── LEFT COLUMN ── */}
          <aside style={{ width: isMobile ? '100%' : '280px', flexShrink: 0 }}>
            <div style={{ borderRadius: '20px', border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.02)', padding: '24px', textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ width: '84px', height: '84px', borderRadius: '20px', overflow: 'hidden', margin: '0 auto 14px', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(61,79,224,0.3)' }}>
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '28px', fontWeight: 800, color: 'white' }}>{initials(profile.name)}</span>
                )}
              </div>
              <h1 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {profile.name}{profile.is_verified && <VerifiedBadge size={16} />}
              </h1>
              {profile.headline && <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#8FB3FF', margin: '0 0 8px' }}>{profile.headline}</p>}

              {profile.marketplace_review_count > 0 && (
                <p style={{ fontSize: '12.5px', color: '#FBBF24', margin: '0 0 10px' }}>
                  ★ {profile.marketplace_rating} <span style={{ color: 'rgba(231,234,240,0.5)' }}>({profile.marketplace_review_count})</span>
                </p>
              )}

              <button onClick={messageThem} disabled={messaging}
                style={{ width: '100%', padding: '9px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: messaging ? 0.6 : 1, marginBottom: '12px' }}>
                {messaging ? 'Opening…' : '💬 Message'}
              </button>
              {msgError && <p style={{ fontSize: '11.5px', color: '#F87171', margin: '-6px 0 10px' }}>{msgError}</p>}

              {(profile.location || profile.company) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px' }}>
                  {profile.company && <span style={{ fontSize: '12px', color: 'rgba(231,234,240,0.55)' }}>🏢 {profile.company}</span>}
                  {profile.location && <span style={{ fontSize: '12px', color: 'rgba(231,234,240,0.55)' }}>📍 {profile.location}</span>}
                </div>
              )}

              {profile.bio && (
                <p style={{ fontSize: '12.5px', color: 'rgba(231,234,240,0.7)', lineHeight: 1.6, margin: '0 0 10px', textAlign: 'left' }}>{profile.bio}</p>
              )}

              {allSkills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                  {allSkills.map(skill => (
                    <span key={skill} style={{ fontSize: '10px', fontWeight: 600, color: '#8FB3FF', background: 'rgba(61,79,224,0.1)', border: '1px solid rgba(61,79,224,0.2)', padding: '3px 10px', borderRadius: '999px' }}>
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {(profile.education?.length > 0 || profile.experience?.length > 0 || profile.email || profile.website) && (
              <div style={{ borderRadius: '20px', border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.02)', padding: '20px' }}>
                {profile.education?.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(231,234,240,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Education</p>
                    {profile.education.map(e => (
                      <div key={e.id} style={{ marginBottom: '6px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>{e.degree || e.school}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(231,234,240,0.45)', margin: 0 }}>{e.degree ? e.school : ''}{e.end_year ? `${e.degree ? ' · ' : ''}${e.end_year}` : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
                {profile.experience?.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(231,234,240,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Experience</p>
                    {profile.experience.map(e => (
                      <div key={e.id} style={{ marginBottom: '6px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>{e.title}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(231,234,240,0.45)', margin: 0 }}>{e.company}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* CONTACT — email + website only; phone stays private */}
                <div style={{ borderTop: (profile.education?.length > 0 || profile.experience?.length > 0) ? '1px solid rgba(255,255,255,0.08)' : 'none', paddingTop: (profile.education?.length > 0 || profile.experience?.length > 0) ? '12px' : 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {profile.email && <span style={{ fontSize: '12px', color: 'rgba(231,234,240,0.55)' }}>✉ {profile.email}</span>}
                  {profile.website && (
                    <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank"
                      style={{ fontSize: '12px', color: '#8FB3FF', textDecoration: 'none' }}>
                      🌐 {profile.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>
            )}
          </aside>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '4px', marginBottom: '16px', width: 'fit-content' }}>
              {([['portfolio', 'Portfolio'], ['posts', 'Posts']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', background: tab === id ? 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' : 'transparent', color: tab === id ? 'white' : 'rgba(231,234,240,0.5)' }}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'portfolio' && (
              <PortfolioGrid items={profile.portfolio || []} variant="dark" onSelect={setSelectedProject}
                emptyTitle="No portfolio items yet" emptySubtitle="Nothing has been shared here yet." />
            )}

            {tab === 'posts' && (
              !postsLoaded ? (
                <p style={{ fontSize: '13px', color: 'rgba(231,234,240,0.4)' }}>Loading…</p>
              ) : posts.length === 0 ? (
                <div style={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', textAlign: 'center', padding: '40px 20px', color: 'rgba(231,234,240,0.4)', fontSize: '13px' }}>
                  No posts yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {posts.map(p => (
                    <div key={p.id} style={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '16px' }}>
                      <p style={{ fontSize: '11px', color: 'rgba(231,234,240,0.4)', margin: '0 0 8px' }}>{new Date(p.created_at).toLocaleDateString()}</p>
                      <p style={{ fontSize: '13.5px', color: 'rgba(231,234,240,0.85)', margin: '0 0 8px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{p.text}</p>
                      {p.image_url && <img src={p.image_url} alt="" style={{ maxWidth: '100%', borderRadius: '10px', marginBottom: '8px', display: 'block' }} />}
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'rgba(231,234,240,0.4)' }}>
                        <span>♡ {p.like_count}</span>
                        <span>💬 {p.comment_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
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
