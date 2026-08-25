'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import {
  Sun, Moon, Search, ArrowLeft, X, Link2, MessageCircle,
  Building2, MapPin, Mail, Globe, Star, Heart,
} from 'lucide-react'
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

// Public share page — no Sidebar to inherit the theme toggle from, so it
// reads/writes the same 'archon-theme' key and 'light-theme' class itself,
// matching the platform-wide mechanism (see Sidebar.tsx).
function ThemeToggle() {
  const [dark, setDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('archon-theme')
    setDark(saved !== 'light')
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (dark) { document.documentElement.classList.remove('light-theme'); localStorage.setItem('archon-theme', 'dark') }
    else { document.documentElement.classList.add('light-theme'); localStorage.setItem('archon-theme', 'light') }
  }, [dark, mounted])

  return (
    <button onClick={() => setDark(v => !v)} aria-label="Toggle theme"
      style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 50, width: '36px', height: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {dark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
    </button>
  )
}

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
  const [tab, setTab] = useState<'profile' | 'posts'>('profile')
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
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ThemeToggle />
        <div style={{ width: '28px', height: '28px', border: '2px solid rgba(61,79,224,0.2)', borderTop: '2px solid #3D4FE0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── NOT FOUND ──
  if (notFound || !profile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', fontFamily: 'Inter, sans-serif', padding: '20px', textAlign: 'center' }}>
        <ThemeToggle />
        <Search size={48} strokeWidth={1.5} style={{ opacity: 0.15 }} />
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Profile not found</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>This profile doesn't exist or hasn't been made public yet.</p>
        <a href="/" style={{ marginTop: '12px', fontSize: '13px', color: '#60A5FA', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ArrowLeft size={13} strokeWidth={1.75} /> Back to Archon</a>
      </div>
    )
  }

  // ── PROFILE ──
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <ThemeToggle />

      {/* LIGHTBOX */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', backdropFilter: 'blur(8px)' }}>
          <img src={lightboxImg} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
        </div>
      )}

      {/* PROJECT MODAL */}
      {selectedProject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border)', width: '100%', maxWidth: '800px', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>{selectedProject.title}</h2>
                {selectedProject.desc && <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{selectedProject.desc}</p>}
              </div>
              <button onClick={() => setSelectedProject(null)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-input)', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} strokeWidth={2} /></button>
            </div>
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {selectedProject.images.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>No images for this project.</p>
              ) : selectedProject.images.map(img => (
                <div key={img.id}>
                  <div onClick={() => setLightboxImg(img.data)} style={{ borderRadius: '10px', overflow: 'hidden', cursor: 'zoom-in', aspectRatio: '4/3', background: 'var(--bg-input)' }}>
                    <img src={img.data} alt={img.alt || img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  {img.alt && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 2px 0', lineHeight: 1.5 }}>{img.alt}</p>
                  )}
                </div>
              ))}
              {selectedProject.url && (
                <a href={selectedProject.url} target="_blank" style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: '13px', color: '#60A5FA', padding: '10px', border: '1px solid rgba(61,79,224,0.2)', borderRadius: '10px', textDecoration: 'none', background: 'rgba(61,79,224,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Link2 size={14} strokeWidth={1.75} /> View External Link
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1040px', margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '48px 24px 60px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{ width: isMobile ? '100%' : '280px', flexShrink: 0 }}>
            <div style={{ borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px', textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ width: '84px', height: '84px', borderRadius: '20px', overflow: 'hidden', margin: '0 auto 14px', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(61,79,224,0.3)' }}>
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '28px', fontWeight: 800, color: 'white' }}>{initials(profile.name)}</span>
                )}
              </div>
              <h1 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text)' }}>
                {profile.name}{profile.is_verified && <VerifiedBadge size={16} />}
              </h1>
              {profile.headline && <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#60A5FA', margin: '0 0 8px' }}>{profile.headline}</p>}

              {profile.marketplace_review_count > 0 && (
                <p style={{ fontSize: '12.5px', color: '#FBBF24', margin: '0 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Star size={12} strokeWidth={1.75} fill="#FBBF24" /> {profile.marketplace_rating} <span style={{ color: 'var(--text-muted)' }}>({profile.marketplace_review_count})</span>
                </p>
              )}

              <button onClick={messageThem} disabled={messaging}
                style={{ width: '100%', padding: '9px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: messaging ? 0.6 : 1, marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {messaging ? 'Opening…' : <><MessageCircle size={14} strokeWidth={1.75} /> Message</>}
              </button>
              {msgError && <p style={{ fontSize: '11.5px', color: '#F87171', margin: '-6px 0 10px' }}>{msgError}</p>}

              {(profile.location || profile.company) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px' }}>
                  {profile.company && <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Building2 size={12} strokeWidth={1.75} /> {profile.company}</span>}
                  {profile.location && <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} strokeWidth={1.75} /> {profile.location}</span>}
                </div>
              )}

              {allSkills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                  {allSkills.map(skill => (
                    <span key={skill} style={{ fontSize: '10px', fontWeight: 600, color: '#60A5FA', background: 'rgba(61,79,224,0.1)', border: '1px solid rgba(61,79,224,0.2)', padding: '3px 10px', borderRadius: '999px' }}>
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {(profile.email || profile.website) && (
              <div style={{ borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {profile.email && <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Mail size={12} strokeWidth={1.75} /> {profile.email}</span>}
                {profile.website && (
                  <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank"
                    style={{ fontSize: '12px', color: '#60A5FA', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Globe size={12} strokeWidth={1.75} /> {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', marginBottom: '16px', width: isMobile ? '100%' : 'fit-content' }}>
              {([['profile', 'Profile'], ['posts', 'Posts']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  style={{ flex: isMobile ? 1 : 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', background: tab === id ? 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' : 'transparent', color: tab === id ? 'white' : 'var(--text-muted)' }}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {profile.bio && (
                  <div style={{ borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Description</p>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{profile.bio}</p>
                  </div>
                )}

                {allSkills.length > 0 && (
                  <div style={{ borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Skills & Expertise</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {allSkills.map(skill => (
                        <span key={skill} style={{ fontSize: '12px', fontWeight: 600, color: '#60A5FA', background: 'rgba(61,79,224,0.1)', border: '1px solid rgba(61,79,224,0.2)', padding: '5px 12px', borderRadius: '999px' }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Portfolio</p>
                  <PortfolioGrid items={profile.portfolio || []} variant="themed" onSelect={setSelectedProject}
                    emptyTitle="No portfolio items yet" emptySubtitle="Nothing has been shared here yet." />
                </div>

                {profile.education?.length > 0 && (
                  <div style={{ borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Education</p>
                    {profile.education.map(e => (
                      <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--text)' }}>{e.degree || 'Education'}{e.field ? ` · ${e.field}` : ''}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{e.school}{(e.start_year || e.end_year) ? ` · ${e.start_year || ''}${e.start_year && e.end_year ? '–' : ''}${e.end_year || ''}` : ''}</p>
                      </div>
                    ))}
                  </div>
                )}

                {profile.experience?.length > 0 && (
                  <div style={{ borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Work Experience</p>
                    {profile.experience.map(e => (
                      <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--text)' }}>{e.title}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{e.company}{(e.start_date || e.end_date) ? ` · ${e.start_date || ''}${e.start_date && e.end_date ? '–' : ''}${e.end_date || ''}` : ''}</p>
                        {e.description && <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '4px 0 0', lineHeight: 1.5 }}>{e.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'posts' && (
              !postsLoaded ? (
                <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Loading…</p>
              ) : posts.length === 0 ? (
                <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)', fontSize: '13px' }}>
                  No posts yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {posts.map(p => (
                    <div key={p.id} style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '0 0 8px' }}>{new Date(p.created_at).toLocaleDateString()}</p>
                      <p style={{ fontSize: '13.5px', color: 'var(--text)', margin: '0 0 8px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{p.text}</p>
                      {p.image_url && <img src={p.image_url} alt="" style={{ maxWidth: '100%', borderRadius: '10px', marginBottom: '8px', display: 'block' }} />}
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-dim)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Heart size={12} strokeWidth={1.75} /> {p.like_count}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={12} strokeWidth={1.75} /> {p.comment_count}</span>
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
      <div style={{ borderTop: '1px solid var(--border)', padding: '24px', textAlign: 'center' }}>
        <a href="/" style={{ fontSize: '12px', color: 'var(--text-dim)', textDecoration: 'none' }}>
          Powered by <strong style={{ color: 'var(--text-muted)' }}>Archon</strong>
        </a>
      </div>
    </div>
  )
}
