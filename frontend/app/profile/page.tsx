'use client'
import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'

const API = 'http://localhost:8000'
const getToken = () => localStorage.getItem('archon-token') || ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

const SKILLS_OPTIONS = [
  '3D Visualization', 'Architectural Rendering', 'Interior Design',
  'Exterior Design', 'Blender', '3ds Max', 'V-Ray', 'Corona',
  'Unreal Engine', 'SketchUp', 'AutoCAD', 'Revit',
  'AI Rendering', 'Animation', 'Real Estate Viz', 'CGI',
  'Lumion', 'Twinmotion', 'Photoshop', 'After Effects',
]

const PLAN_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  basic:  { label: 'Basic',  color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', desc: '50 companies · 30 emails/month' },
  pro:    { label: 'Pro',    color: '#60A5FA', bg: 'rgba(79,123,247,0.1)',  desc: '500 companies · 300 emails/month · AI Search' },
  agency: { label: 'Agency', color: '#A78BFA', bg: 'rgba(139,92,246,0.1)', desc: 'Unlimited · All features' },
}

interface UserProfile {
  id: number; name: string; email: string
  role: string; plan: string; created_at: string; last_login: string | null
}

interface PortfolioImage { id: string; data: string; name: string }
interface PortfolioItem {
  id: string; title: string; desc: string; url: string
  images: PortfolioImage[]
}

interface LocalProfile {
  bio: string; location: string; website: string; company: string
  phone: string; skills: string[]; customSkills: string[]
  avatar: string  // base64 image
  portfolio: PortfolioItem[]
}

const defaultProfile: LocalProfile = {
  bio: '', location: '', website: '', company: '', phone: '',
  skills: [], customSkills: [], avatar: '', portfolio: [],
}

export default function ProfilePage() {
  const isMobile = useIsMobile()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [profile, setProfile] = useState<LocalProfile>(defaultProfile)
  const [activeTab, setActiveTab] = useState<'info' | 'skills' | 'portfolio' | 'security'>('info')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pwdForm, setPwdForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [newSkill, setNewSkill] = useState('')
  const [newPortfolio, setNewPortfolio] = useState({ title: '', desc: '', url: '' })
  const [newPortfolioImages, setNewPortfolioImages] = useState<{id:string;data:string;name:string}[]>([])
  const newProjectImgRef = useRef<HTMLInputElement>(null)
  const [selectedProject, setSelectedProject] = useState<PortfolioItem | null>(null)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const avatarRef = useRef<HTMLInputElement>(null)
  const portfolioImgRef = useRef<HTMLInputElement>(null)
  const [addingImagesTo, setAddingImagesTo] = useState<string | null>(null)

  useEffect(() => {
    axios.get(`${API}/auth/me`, { headers: headers() })
      .then(res => setUser(res.data))
      .catch(() => { window.location.href = '/login' })
    const saved = localStorage.getItem('archon-profile')
    if (saved) { try { const p = JSON.parse(saved); setProfile({ ...defaultProfile, ...p }) } catch {} }
  }, [])

  const saveProfile = (p = profile) => {
    setSaving(true)
    const json = JSON.stringify(p)
    localStorage.setItem('archon-profile', json)
    // Dispatch storage event so Sidebar updates avatar
    window.dispatchEvent(new StorageEvent('storage', { key: 'archon-profile', newValue: json }))
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500) }, 300)
  }

  const changePassword = async () => {
    setPwdError(''); setPwdSuccess(false)
    if (!pwdForm.old_password || !pwdForm.new_password) { setPwdError('All fields required'); return }
    if (pwdForm.new_password !== pwdForm.confirm) { setPwdError('Passwords do not match'); return }
    if (pwdForm.new_password.length < 8) { setPwdError('Min 8 characters'); return }
    try {
      await axios.post(`${API}/auth/change-password`, { old_password: pwdForm.old_password, new_password: pwdForm.new_password }, { headers: headers() })
      setPwdSuccess(true); setPwdForm({ old_password: '', new_password: '', confirm: '' })
    } catch (e: any) { setPwdError(e.response?.data?.detail || 'Error') }
  }

  // Avatar upload
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const updated = { ...profile, avatar: ev.target?.result as string }
      setProfile(updated)
      saveProfile(updated)
    }
    reader.readAsDataURL(file)
  }

  // Portfolio images upload
  const handlePortfolioImages = (e: React.ChangeEvent<HTMLInputElement>, projectId: string) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const readers = files.map(file => new Promise<PortfolioImage>((resolve) => {
      const reader = new FileReader()
      reader.onload = (ev) => resolve({ id: Date.now() + Math.random().toString(), data: ev.target?.result as string, name: file.name })
      reader.readAsDataURL(file)
    }))
    Promise.all(readers).then(images => {
      const updated = {
        ...profile,
        portfolio: profile.portfolio.map(p =>
          p.id === projectId ? { ...p, images: [...p.images, ...images] } : p
        )
      }
      setProfile(updated)
      saveProfile(updated)
    })
    e.target.value = ''
  }

  const removePortfolioImage = (projectId: string, imageId: string) => {
    const updated = {
      ...profile,
      portfolio: profile.portfolio.map(p =>
        p.id === projectId ? { ...p, images: p.images.filter(img => img.id !== imageId) } : p
      )
    }
    setProfile(updated)
    saveProfile(updated)
  }

  const toggleSkill = (skill: string) => {
    const updated = { ...profile, skills: profile.skills.includes(skill) ? profile.skills.filter(s => s !== skill) : [...profile.skills, skill] }
    setProfile(updated)
  }

  const addCustomSkill = () => {
    if (!newSkill.trim()) return
    if (profile.skills.includes(newSkill.trim()) || profile.customSkills.includes(newSkill.trim())) return
    const updated = { ...profile, customSkills: [...profile.customSkills, newSkill.trim()] }
    setProfile(updated)
    setNewSkill('')
  }

  const removeCustomSkill = (skill: string) => {
    setProfile(p => ({ ...p, customSkills: p.customSkills.filter(s => s !== skill) }))
  }

  const addPortfolio = () => {
    if (!newPortfolio.title) return
    const updated = { ...profile, portfolio: [...profile.portfolio, { ...newPortfolio, id: Date.now().toString(), images: newPortfolioImages }] }
    setProfile(updated)
    saveProfile(updated)
    setNewPortfolio({ title: '', desc: '', url: '' })
    setNewPortfolioImages([])
  }

  const handleNewProjectImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const readers = files.map(file => new Promise<{id:string;data:string;name:string}>((resolve) => {
      const reader = new FileReader()
      reader.onload = (ev) => resolve({ id: Date.now() + Math.random().toString(), data: ev.target?.result as string, name: file.name })
      reader.readAsDataURL(file)
    }))
    Promise.all(readers).then(images => setNewPortfolioImages(prev => [...prev, ...images]))
    e.target.value = ''
  }

  const removePortfolio = (id: string) => {
    const updated = { ...profile, portfolio: profile.portfolio.filter(p => p.id !== id) }
    setProfile(updated)
    saveProfile(updated)
    if (selectedProject?.id === id) setSelectedProject(null)
  }

  const initials = user?.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U'
  const plan = user ? PLAN_META[user.plan] || PLAN_META.basic : null
  const allSkills = [...profile.skills, ...profile.customSkills]

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: '10px', padding: '10px 14px',
    fontSize: '14px', color: 'var(--text)', outline: 'none',
    transition: 'border-color 0.15s',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 700,
    color: 'var(--text-dim)', marginBottom: '6px',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  }

  const tabs = [
    { id: 'info', label: 'Profile Info', icon: '👤' },
    { id: 'skills', label: 'Skills', icon: '⚡' },
    { id: 'portfolio', label: 'Portfolio', icon: '🖼' },
    { id: 'security', label: 'Security', icon: '🔐' },
  ] as const

  return (
    <div className="page-enter" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      {/* LIGHTBOX */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', backdropFilter: 'blur(8px)' }}>
          <img src={lightboxImg} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }} />
          <button onClick={() => setLightboxImg(null)} style={{ position: 'absolute', top: '20px', right: '24px', color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* PROJECT DETAIL MODAL */}
      {selectedProject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border)', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            {/* MODAL HEADER */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{selectedProject.title}</h2>
                {selectedProject.desc && <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{selectedProject.desc}</p>}
              </div>
              <button onClick={() => setSelectedProject(null)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ padding: '24px' }}>
              {/* IMAGE GRID */}
              {selectedProject.images.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim)' }}>
                  <p style={{ fontSize: '40px', marginBottom: '8px', opacity: 0.2 }}>🖼</p>
                  <p style={{ fontSize: '14px' }}>No images yet</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  {selectedProject.images.map(img => (
                    <div key={img.id} style={{ borderRadius: '10px', overflow: 'hidden', position: 'relative', aspectRatio: '4/3', cursor: 'zoom-in', background: 'var(--bg-input)' }}
                      onClick={() => setLightboxImg(img.data)}>
                      <img src={img.data} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }} />
                      <button onClick={e => { e.stopPropagation(); removePortfolioImage(selectedProject.id, img.id); setSelectedProject(prev => prev ? { ...prev, images: prev.images.filter(i => i.id !== img.id) } : null) }}
                        style={{ position: 'absolute', top: '6px', right: '6px', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(239,68,68,0.85)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* ADD MORE IMAGES */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input ref={portfolioImgRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => { handlePortfolioImages(e, selectedProject.id); setSelectedProject(prev => prev ? { ...profile.portfolio.find(p => p.id === selectedProject.id)! } : null) }} />
                <button onClick={() => { setAddingImagesTo(selectedProject.id); portfolioImgRef.current?.click() }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.4)'; e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                  📷 Add Images
                </button>
                {selectedProject.url && (
                  <a href={selectedProject.url} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: '1px solid rgba(79,123,247,0.2)', background: 'rgba(79,123,247,0.08)', color: '#60A5FA', fontSize: '13px', textDecoration: 'none' }}>
                    🔗 View External Link
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', paddingTop: isMobile ? '52px' : 0 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '16px' : '32px 40px' }}>

          {/* PROFILE HERO */}
          <div style={{ borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '28px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(135deg, rgba(79,123,247,0.08), rgba(124,58,237,0.08))', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>

              {/* AVATAR */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                <div onClick={() => avatarRef.current?.click()}
                  style={{ width: '80px', height: '80px', borderRadius: '20px', overflow: 'hidden', cursor: 'pointer', border: '3px solid var(--bg-main)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', position: 'relative', flexShrink: 0, background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Click to upload photo">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '28px', fontWeight: 800, color: 'white' }}>{initials}</span>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}>
                    <span style={{ fontSize: '24px' }}>📷</span>
                  </div>
                </div>
                <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '22px', height: '22px', borderRadius: '50%', background: '#4F7BF7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', border: '2px solid var(--bg-main)', pointerEvents: 'none' }}>✏</div>
              </div>

              {/* INFO */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>{user?.name || '—'}</h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 8px' }}>{user?.email}</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {plan && <span style={{ fontSize: '11px', fontWeight: 700, color: plan.color, background: plan.bg, padding: '3px 10px', borderRadius: '999px', textTransform: 'uppercase' }}>{plan.label}</span>}
                  {user?.role === 'admin' && <span style={{ fontSize: '11px', fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '3px 10px', borderRadius: '999px' }}>👑 Admin</span>}
                  {profile.location && <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>📍 {profile.location}</span>}
                  {profile.company && <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>🏢 {profile.company}</span>}
                </div>
                {allSkills.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {allSkills.slice(0, 5).map(s => (
                      <span key={s} style={{ fontSize: '10px', fontWeight: 600, color: '#60A5FA', background: 'rgba(79,123,247,0.1)', border: '1px solid rgba(79,123,247,0.15)', padding: '2px 8px', borderRadius: '999px' }}>{s}</span>
                    ))}
                    {allSkills.length > 5 && <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>+{allSkills.length - 5}</span>}
                  </div>
                )}
                {profile.bio && <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.6 }}>{profile.bio}</p>}
              </div>

              {/* PLAN CARD */}
              {plan && (
                <div style={{ borderRadius: '12px', border: `1px solid ${plan.color}30`, background: plan.bg, padding: '12px 16px', textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plan</p>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: plan.color, margin: '0 0 2px' }}>{plan.label}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: 0 }}>{plan.desc}</p>
                </div>
              )}
            </div>
          </div>

          {/* TABS */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ flex: 1, padding: '9px', fontSize: isMobile ? '11px' : '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '4px' : '6px', transition: 'all 0.15s', background: activeTab === tab.id ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'transparent', color: activeTab === tab.id ? 'white' : 'var(--text-muted)' }}>
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {/* ── TAB: INFO ── */}
          {activeTab === 'info' && (
            <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}>Personal Information</h2>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input value={user?.name || ''} disabled style={{ ...inputStyle, opacity: 0.5 }} />
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }}>Contact admin to change</p>
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input value={user?.email || ''} disabled style={{ ...inputStyle, opacity: 0.5 }} />
                </div>
                {[
                  { label: 'Studio / Company', key: 'company', placeholder: 'Armila Design Studio' },
                  { label: 'Location', key: 'location', placeholder: 'Madrid, Spain' },
                  { label: 'Website', key: 'website', placeholder: 'https://armiladesign.com' },
                  { label: 'Phone', key: 'phone', placeholder: '+34 XXX XXX XXX' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={labelStyle}>{f.label}</label>
                    <input value={(profile as any)[f.key]} onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Bio</label>
                  <textarea value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Tell us about your studio and expertise..." rows={3}
                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button onClick={() => saveProfile()} disabled={saving}
                  style={{ padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', background: saved ? '#34D399' : 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ── TAB: SKILLS ── */}
          {activeTab === 'skills' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* PRESET SKILLS */}
              <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Skills & Expertise</h2>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{allSkills.length} selected</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  {SKILLS_OPTIONS.map(skill => {
                    const selected = profile.skills.includes(skill)
                    return (
                      <button key={skill} onClick={() => toggleSkill(skill)}
                        style={{ padding: '7px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', border: 'none', background: selected ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'var(--bg-input)', color: selected ? 'white' : 'var(--text-muted)', boxShadow: selected ? '0 2px 8px rgba(79,123,247,0.3)' : 'none' }}>
                        {selected ? '✓ ' : ''}{skill}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* CUSTOM SKILLS */}
              <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 14px' }}>Add Custom Skill</h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <input value={newSkill} onChange={e => setNewSkill(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomSkill()}
                    placeholder="e.g. Rhino, Grasshopper, Midjourney..."
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
                  <button onClick={addCustomSkill} disabled={!newSkill.trim()}
                    style={{ padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer', opacity: !newSkill.trim() ? 0.4 : 1 }}>
                    + Add
                  </button>
                </div>
                {profile.customSkills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {profile.customSkills.map(skill => (
                      <span key={skill} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#A78BFA', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', padding: '5px 12px', borderRadius: '999px' }}>
                        {skill}
                        <button onClick={() => removeCustomSkill(skill)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(167,139,250,0.5)', fontSize: '12px', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => saveProfile()}
                  style={{ padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', background: saved ? '#34D399' : 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {saved ? '✓ Saved!' : 'Save Skills'}
                </button>
              </div>
            </div>
          )}

          {/* ── TAB: PORTFOLIO ── */}
          {activeTab === 'portfolio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ADD PROJECT */}
              <div style={{ borderRadius: '16px', border: '1px solid rgba(79,123,247,0.2)', background: 'rgba(79,123,247,0.03)', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🖼 Add New Project
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={labelStyle}>Project Title *</label>
                    <input value={newPortfolio.title} onChange={e => setNewPortfolio(p => ({ ...p, title: e.target.value }))}
                      placeholder="Modern Villa, Dubai" style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>External Link (optional)</label>
                    <input value={newPortfolio.url} onChange={e => setNewPortfolio(p => ({ ...p, url: e.target.value }))}
                      placeholder="https://behance.net/..." style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Description</label>
                    <input value={newPortfolio.desc} onChange={e => setNewPortfolio(p => ({ ...p, desc: e.target.value }))}
                      placeholder="3D visualization for a luxury residential project..." style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
                  </div>
                </div>
                {/* PHOTO UPLOAD for new project */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Photos (optional)</label>
                  <input ref={newProjectImgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleNewProjectImages} />
                  <button onClick={() => newProjectImgRef.current?.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', borderRadius: '10px', border: '1px dashed rgba(79,123,247,0.4)', background: 'rgba(79,123,247,0.04)', color: '#60A5FA', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s', width: '100%', justifyContent: 'center' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,123,247,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(79,123,247,0.04)' }}>
                    📷 Add Photos {newPortfolioImages.length > 0 && <span style={{ background: '#4F7BF7', color: 'white', borderRadius: '999px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{newPortfolioImages.length}</span>}
                  </button>
                  {newPortfolioImages.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {newPortfolioImages.map(img => (
                        <div key={img.id} style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <img src={img.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button onClick={() => setNewPortfolioImages(prev => prev.filter(i => i.id !== img.id))}
                            style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(239,68,68,0.85)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={addPortfolio} disabled={!newPortfolio.title}
                  style={{ padding: '9px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer', opacity: !newPortfolio.title ? 0.4 : 1 }}>
                  + Create Project
                </button>
              </div>

              {/* PORTFOLIO GRID */}
              {profile.portfolio.length === 0 ? (
                <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '64px', textAlign: 'center' }}>
                  <p style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.15 }}>🏛</p>
                  <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-muted)', margin: '0 0 4px' }}>No projects yet</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>Create a project and upload your architectural visualizations</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '14px' }}>
                  {profile.portfolio.map(item => {
                    const cover = item.images[0]
                    return (
                      <div key={item.id} style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', overflow: 'hidden', transition: 'all 0.2s', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.35)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                        onClick={() => setSelectedProject(item)}>

                        {/* COVER */}
                        <div style={{ height: '160px', background: 'linear-gradient(135deg, rgba(79,123,247,0.08), rgba(124,58,237,0.08))', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {cover ? (
                            <img src={cover.data} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '48px', opacity: 0.15 }}>🏛</span>
                          )}
                          {/* IMAGE COUNT */}
                          {item.images.length > 0 && (
                            <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', color: 'white', fontWeight: 600 }}>
                              📷 {item.images.length} photo{item.images.length > 1 ? 's' : ''}
                            </div>
                          )}
                          {/* ADD PHOTOS QUICK BUTTON */}
                          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                            <button onClick={e => { e.stopPropagation(); setAddingImagesTo(item.id); const input = document.getElementById(`upload-${item.id}`) as HTMLInputElement; input?.click() }}
                              style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '11px', backdropFilter: 'blur(4px)' }}>
                              + Add Photos
                            </button>
                            <button onClick={e => { e.stopPropagation(); removePortfolio(item.id) }}
                              style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(239,68,68,0.8)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                          </div>
                          <input id={`upload-${item.id}`} type="file" accept="image/*" multiple style={{ display: 'none' }}
                            onChange={e => handlePortfolioImages(e, item.id)} />
                        </div>

                        {/* INFO */}
                        <div style={{ padding: '14px 16px' }}>
                          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{item.title}</h4>
                          {item.desc && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.desc}</p>}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', color: '#60A5FA', fontWeight: 500 }}>Click to view →</span>
                            {item.url && <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>🔗 External</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {profile.portfolio.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => saveProfile()}
                    style={{ padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', background: saved ? '#34D399' : 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer' }}>
                    {saved ? '✓ Saved!' : 'Save Portfolio'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: SECURITY ── */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>🔐 Change Password</h2>
                {pwdError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>{pwdError}</div>}
                {pwdSuccess && <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34D399', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>✓ Password changed!</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '400px' }}>
                  {[
                    { label: 'Current Password', key: 'old_password', ph: 'Enter current password' },
                    { label: 'New Password', key: 'new_password', ph: 'Min 8 characters' },
                    { label: 'Confirm New Password', key: 'confirm', ph: 'Repeat new password' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={labelStyle}>{f.label}</label>
                      <input type="password" value={(pwdForm as any)[f.key]}
                        onChange={e => setPwdForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.ph} style={inputStyle}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
                    </div>
                  ))}
                  <button onClick={changePassword}
                    style={{ padding: '11px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer' }}>
                    Update Password
                  </button>
                </div>
              </div>
              <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>Account Information</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Member since', value: user ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
                    { label: 'Last login', value: user?.last_login ? new Date(user.last_login).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'First session' },
                    { label: 'Account ID', value: `#${user?.id || '—'}` },
                    { label: 'Role', value: user?.role === 'admin' ? '👑 Administrator' : '👤 Member' },
                    { label: 'Plan', value: user ? `${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} — ${plan?.desc}` : '—' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-input)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
