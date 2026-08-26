'use client'
import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import VerifiedBadge from '../components/VerifiedBadge'
import { useIsMobile } from '../hooks/useIsMobile'
import PortfolioGrid from '../components/PortfolioGrid'
import ProfileCompletion from '../components/ProfileCompletion'
import {
  Pencil, Plus, X, GraduationCap, Briefcase, ShieldCheck, Lock,
  Mail, Phone, Globe, User, FileText, Image as ImageIcon, Camera,
  Link2, Crown, MapPin, Building2, MessageCircle, Heart, Check,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => localStorage.getItem('archon-token') || ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

// Reads a file as a base64 data URL (used as a fallback when R2 isn't configured)
const readAsDataURL = (file: File) => new Promise<string>((resolve) => {
  const reader = new FileReader()
  reader.onload = ev => resolve(ev.target?.result as string)
  reader.readAsDataURL(file)
})

// Uploads an image to R2 via the backend and returns its public URL.
// Falls back to an inline base64 data URL if storage isn't configured yet,
// so the profile keeps working during the R2 rollout.
const uploadImage = async (file: File): Promise<string> => {
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await axios.post(`${API}/auth/upload`, form, { headers: headers() })
    return res.data.url as string
  } catch {
    return readAsDataURL(file)
  }
}

const SKILLS_OPTIONS = [
  '3D Visualization', 'Architectural Rendering', 'Interior Design',
  'Exterior Design', 'Blender', '3ds Max', 'V-Ray', 'Corona',
  'Unreal Engine', 'SketchUp', 'AutoCAD', 'Revit',
  'AI Rendering', 'Animation', 'Real Estate Viz', 'CGI',
  'Lumion', 'Twinmotion', 'Photoshop', 'After Effects',
]

const PLAN_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  trial:  { label: 'Trial',  color: '#34D399', bg: 'rgba(52,211,153,0.1)', desc: '7-day free trial · 10 companies · 10 emails' },
  basic:  { label: 'Basic',  color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', desc: '50 companies · 30 emails/month' },
  pro:    { label: 'Pro',    color: '#60A5FA', bg: 'rgba(61,79,224,0.1)',  desc: '500 companies · 300 emails/month · AI Search' },
  agency: { label: 'Agency', color: '#A78BFA', bg: 'rgba(139,92,246,0.1)', desc: 'Unlimited · All features' },
}

interface UserProfile {
  id: number; name: string; email: string
  role: string; plan: string; created_at: string; last_login: string | null
  google_email?: string | null
  google_connected?: boolean
  is_verified?: boolean
}

interface PortfolioImage { id: string; data: string; name: string; alt?: string }
interface PortfolioItem {
  id: string; title: string; desc: string; url: string
  images: PortfolioImage[]
}
interface EducationItem {
  id: string; school: string; degree: string; field: string; start_year: string; end_year: string
}
interface ExperienceItem {
  id: string; title: string; company: string; start_date: string; end_date: string; description: string
}

interface LocalProfile {
  headline: string; bio: string; location: string; website: string; company: string
  phone: string; skills: string[]; customSkills: string[]
  avatar: string  // base64 image
  portfolio: PortfolioItem[]
  education: EducationItem[]
  experience: ExperienceItem[]
}

const defaultProfile: LocalProfile = {
  headline: '', bio: '', location: '', website: '', company: '', phone: '',
  skills: [], customSkills: [], avatar: '', portfolio: [], education: [], experience: [],
}

// Section-card wrapper used across the merged Profile tab — module scope so
// its identity is stable across renders (a component defined inside the page
// function would remount its children, dropping input focus on every keystroke).
function SectionCard({ title, editing, onToggleEdit, children }: { title: string; editing: boolean; onToggleEdit: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{title}</h2>
        <button onClick={onToggleEdit}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: editing ? 'rgba(61,79,224,0.12)' : 'var(--bg-input)', color: editing ? '#60A5FA' : 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
          <Pencil size={13} strokeWidth={1.75} />
        </button>
      </div>
      {children}
    </div>
  )
}

export default function ProfilePage() {
  const isMobile = useIsMobile()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [profile, setProfile] = useState<LocalProfile>(defaultProfile)
  const [activeTab, setActiveTab] = useState<'profile' | 'posts'>('profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newSkill, setNewSkill] = useState('')
  const [newPortfolio, setNewPortfolio] = useState({ title: '', desc: '', url: '' })
  const [newPortfolioImages, setNewPortfolioImages] = useState<PortfolioImage[]>([])
  const [editingProject, setEditingProject] = useState<{ title: string; desc: string; url: string } | null>(null)
  const newProjectImgRef = useRef<HTMLInputElement>(null)
  const [selectedProject, setSelectedProject] = useState<PortfolioItem | null>(null)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const avatarRef = useRef<HTMLInputElement>(null)
  const portfolioImgRef = useRef<HTMLInputElement>(null)
  const [accountMode, setAccountMode] = useState<'freelancer' | 'client'>('freelancer')
  const [modeSaving, setModeSaving] = useState(false)
  const [reputation, setReputation] = useState<{ sent: number; replied: number; reply_rate: number; bounced_manual: number; score: number } | null>(null)
  const [myPosts, setMyPosts] = useState<{ id: number; text: string; image_url: string | null; created_at: string; like_count: number; comment_count: number }[]>([])
  const [postsLoaded, setPostsLoaded] = useState(false)
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [editPostText, setEditPostText] = useState('')
  const [completionExtra, setCompletionExtra] = useState({ isVerified: false, hasPost: false, hasSentEmail: false, isPublic: false, username: null as string | null })

  // Section edit toggles for the merged Profile tab (Upwork-style: view by
  // default, click the pencil to reveal the editor for just that section).
  const [editingBio, setEditingBio] = useState(false)
  const [editingSkills, setEditingSkills] = useState(false)
  const [editingPortfolio, setEditingPortfolio] = useState(false)
  const [editingEducation, setEditingEducation] = useState(false)
  const [editingExperience, setEditingExperience] = useState(false)
  const [newEducation, setNewEducation] = useState({ school: '', degree: '', field: '', start_year: '', end_year: '' })
  const [newExperience, setNewExperience] = useState({ title: '', company: '', start_date: '', end_date: '', description: '' })

  useEffect(() => {
    axios.get(`${API}/auth/me`, { headers: headers() })
      .then(res => { setUser(res.data); setAccountMode(res.data.account_mode === 'client' ? 'client' : 'freelancer') })
      .catch(() => { window.location.href = '/login' })

    axios.get(`${API}/companies/email/reputation`, { headers: headers() })
      .then(res => setReputation(res.data))
      .catch(() => {})

    // Show cached profile immediately, then reconcile with the server, which is
    // the source of truth (and what the public profile page reads from).
    const saved = localStorage.getItem('archon-profile')
    if (saved) { try { const p = JSON.parse(saved); setProfile({ ...defaultProfile, ...p }) } catch {} }

    axios.get(`${API}/auth/profile/me`, { headers: headers() })
      .then(res => {
        const d = res.data || {}
        const fromServer: LocalProfile = {
          headline: d.headline || '',
          bio: d.bio || '', location: d.location || '', website: d.website || '',
          company: d.company || '', phone: d.phone || '', avatar: d.avatar || '',
          skills: d.skills || [], customSkills: d.customSkills || [],
          portfolio: d.portfolio || [],
          education: d.education || [], experience: d.experience || [],
        }
        setProfile(fromServer)
        localStorage.setItem('archon-profile', JSON.stringify(fromServer))
        setCompletionExtra({
          isVerified: !!d.is_verified, hasPost: !!d.has_post, hasSentEmail: !!d.has_sent_email, isPublic: !!d.is_public,
          username: d.username || null,
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab !== 'posts' || postsLoaded || !user) return
    axios.get(`${API}/marketplace/feed/users/${user.id}/posts`, { headers: headers() })
      .then(res => { setMyPosts(res.data.items); setPostsLoaded(true) })
      .catch(() => setPostsLoaded(true))
  }, [activeTab, user, postsLoaded])

  const startEditPost = (p: { id: number; text: string }) => { setEditingPostId(p.id); setEditPostText(p.text) }

  const saveEditPost = async (id: number) => {
    if (!editPostText.trim()) return
    try {
      const res = await axios.patch(`${API}/marketplace/feed/posts/${id}`, { text: editPostText.trim() }, { headers: headers() })
      setMyPosts(prev => prev.map(p => p.id === id ? { ...p, ...res.data } : p))
      setEditingPostId(null)
    } catch {}
  }

  const deleteMyPost = async (id: number) => {
    if (!window.confirm('Delete this post?')) return
    try {
      await axios.delete(`${API}/marketplace/feed/posts/${id}`, { headers: headers() })
      setMyPosts(prev => prev.filter(p => p.id !== id))
    } catch {}
  }

  const saveProfile = async (p = profile) => {
    setSaving(true)
    const json = JSON.stringify(p)
    localStorage.setItem('archon-profile', json)
    // Dispatch storage event so Sidebar updates avatar
    window.dispatchEvent(new StorageEvent('storage', { key: 'archon-profile', newValue: json }))

    // Persist to the server too — without this, the public profile page (which
    // reads from the database) never sees bio/portfolio/avatar changes.
    // username and is_public are omitted so the backend keeps their values.
    try {
      await axios.put(`${API}/auth/profile/me`, {
        headline: p.headline || '',
        bio: p.bio || '', location: p.location || '', website: p.website || '',
        company: p.company || '', phone: p.phone || '', avatar: p.avatar || '',
        skills: p.skills || [], customSkills: p.customSkills || [],
        portfolio: p.portfolio || [],
        education: p.education || [], experience: p.experience || [],
      }, { headers: headers() })
    } catch {}

    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const switchAccountMode = async (mode: 'freelancer' | 'client') => {
    if (mode === accountMode) return
    setModeSaving(true)
    const previous = accountMode
    setAccountMode(mode)
    try {
      await axios.patch(`${API}/auth/me/account-mode`, { account_mode: mode }, { headers: headers() })
      // Keep the cached user in step so the rest of the app doesn't show the
      // old mode until the next sign-in.
      try {
        const stored = localStorage.getItem('archon-user')
        if (stored) {
          const u = JSON.parse(stored)
          localStorage.setItem('archon-user', JSON.stringify({ ...u, account_mode: mode }))
        }
      } catch {}
    } catch {
      setAccountMode(previous)
    }
    setModeSaving(false)
  }

  // Avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { alert('Image must be under 8MB'); return }
    const url = await uploadImage(file)
    const updated = { ...profile, avatar: url }
    setProfile(updated)
    saveProfile(updated)
  }

  // Portfolio images upload
  const handlePortfolioImages = async (e: React.ChangeEvent<HTMLInputElement>, projectId: string) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const images = await Promise.all(files.map(async file => ({
      id: Date.now() + Math.random().toString(),
      data: await uploadImage(file),
      name: file.name, alt: '',
    })))
    const updated = {
      ...profile,
      portfolio: profile.portfolio.map(p =>
        p.id === projectId ? { ...p, images: [...p.images, ...images] } : p
      )
    }
    setProfile(updated)
    saveProfile(updated)
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

  const handleNewProjectImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const images = await Promise.all(files.map(async file => ({
      id: Date.now() + Math.random().toString(),
      data: await uploadImage(file),
      name: file.name, alt: '',
    })))
    setNewPortfolioImages(prev => [...prev, ...images])
    e.target.value = ''
  }

  // Save edits to an existing project's title / description / link
  const saveProjectEdits = () => {
    if (!selectedProject || !editingProject) return
    const updated = {
      ...profile,
      portfolio: profile.portfolio.map(p =>
        p.id === selectedProject.id
          ? { ...p, title: editingProject.title, desc: editingProject.desc, url: editingProject.url }
          : p
      ),
    }
    setProfile(updated)
    saveProfile(updated)
    setSelectedProject(prev => (prev ? { ...prev, ...editingProject } : null))
    setEditingProject(null)
  }

  // Per-image caption / alt text — committed on blur so we don't save each keystroke
  const updateImageAlt = (projectId: string, imageId: string, alt: string) => {
    const updated = {
      ...profile,
      portfolio: profile.portfolio.map(p =>
        p.id === projectId
          ? { ...p, images: p.images.map(i => (i.id === imageId ? { ...i, alt } : i)) }
          : p
      ),
    }
    setProfile(updated)
    saveProfile(updated)
  }

  const removePortfolio = (id: string) => {
    const updated = { ...profile, portfolio: profile.portfolio.filter(p => p.id !== id) }
    setProfile(updated)
    saveProfile(updated)
    if (selectedProject?.id === id) setSelectedProject(null)
  }

  const addEducation = () => {
    if (!newEducation.school.trim()) return
    const updated = { ...profile, education: [...profile.education, { ...newEducation, id: Date.now().toString() }] }
    setProfile(updated)
    saveProfile(updated)
    setNewEducation({ school: '', degree: '', field: '', start_year: '', end_year: '' })
  }

  const removeEducation = (id: string) => {
    const updated = { ...profile, education: profile.education.filter(e => e.id !== id) }
    setProfile(updated)
    saveProfile(updated)
  }

  const addExperience = () => {
    if (!newExperience.title.trim()) return
    const updated = { ...profile, experience: [...profile.experience, { ...newExperience, id: Date.now().toString() }] }
    setProfile(updated)
    saveProfile(updated)
    setNewExperience({ title: '', company: '', start_date: '', end_date: '', description: '' })
  }

  const removeExperience = (id: string) => {
    const updated = { ...profile, experience: profile.experience.filter(e => e.id !== id) }
    setProfile(updated)
    saveProfile(updated)
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
  const counterStyle: React.CSSProperties = { textAlign: 'right', fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }
  const saveBtnStyle: React.CSSProperties = { padding: '9px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: 'pointer' }
  const rowDeleteBtnStyle: React.CSSProperties = { width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: 'none', color: '#F87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'posts', label: 'Posts', icon: FileText },
  ] as const

  return (
    <div className="page-enter" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      {/* LIGHTBOX */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', backdropFilter: 'blur(8px)' }}>
          <img src={lightboxImg} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }} />
          <button onClick={() => setLightboxImg(null)} style={{ position: 'absolute', top: '20px', right: '24px', color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} strokeWidth={2} /></button>
        </div>
      )}

      {/* PROJECT DETAIL MODAL */}
      {selectedProject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border)', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            {/* MODAL HEADER */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
              {editingProject ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', marginRight: '12px' }}>
                  <input value={editingProject.title} onChange={e => setEditingProject(p => p && ({ ...p, title: e.target.value }))}
                    placeholder="Project title" style={{ ...inputStyle, fontSize: '15px', fontWeight: 600 }} />
                  <input value={editingProject.desc} onChange={e => setEditingProject(p => p && ({ ...p, desc: e.target.value }))}
                    placeholder="Short description" style={inputStyle} />
                  <input value={editingProject.url} onChange={e => setEditingProject(p => p && ({ ...p, url: e.target.value }))}
                    placeholder="External link (optional)" style={inputStyle} />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                    <button onClick={saveProjectEdits} disabled={!editingProject.title.trim()}
                      style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: editingProject.title.trim() ? 'pointer' : 'not-allowed', opacity: editingProject.title.trim() ? 1 : 0.5 }}>
                      Save changes
                    </button>
                    <button onClick={() => setEditingProject(null)}
                      style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{selectedProject.title}</h2>
                  {selectedProject.desc && <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{selectedProject.desc}</p>}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {!editingProject && (
                  <button onClick={() => setEditingProject({ title: selectedProject.title, desc: selectedProject.desc || '', url: selectedProject.url || '' })}
                    style={{ height: '36px', padding: '0 14px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA'; e.currentTarget.style.borderColor = 'rgba(61,79,224,0.4)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                    <Pencil size={13} strokeWidth={1.75} /> Edit
                  </button>
                )}
                <button onClick={() => { setSelectedProject(null); setEditingProject(null) }} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16} strokeWidth={2} /></button>
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              {/* IMAGE GRID */}
              {selectedProject.images.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim)' }}>
                  <ImageIcon size={40} strokeWidth={1.5} style={{ marginBottom: '8px', opacity: 0.2 }} />
                  <p style={{ fontSize: '14px' }}>No images yet</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  {selectedProject.images.map(img => (
                    <div key={img.id}>
                      <div style={{ borderRadius: '10px', overflow: 'hidden', position: 'relative', aspectRatio: '4/3', cursor: 'zoom-in', background: 'var(--bg-input)' }}
                        onClick={() => setLightboxImg(img.data)}>
                        <img src={img.data} alt={img.alt || img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)' }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }} />
                        <button onClick={e => { e.stopPropagation(); removePortfolioImage(selectedProject.id, img.id); setSelectedProject(prev => prev ? { ...prev, images: prev.images.filter(i => i.id !== img.id) } : null) }}
                          style={{ position: 'absolute', top: '6px', right: '6px', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(239,68,68,0.85)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} strokeWidth={2.5} /></button>
                      </div>
                      <input
                        value={img.alt || ''}
                        placeholder="Add a caption…"
                        onChange={e => setSelectedProject(prev => prev ? { ...prev, images: prev.images.map(i => i.id === img.id ? { ...i, alt: e.target.value } : i) } : null)}
                        onBlur={e => updateImageAlt(selectedProject.id, img.id, e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', marginTop: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', color: 'var(--text)', outline: 'none' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(61,79,224,0.5)' }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* ADD MORE IMAGES */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input ref={portfolioImgRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => { handlePortfolioImages(e, selectedProject.id); setSelectedProject(prev => prev ? { ...profile.portfolio.find(p => p.id === selectedProject.id)! } : null) }} />
                <button onClick={() => portfolioImgRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(61,79,224,0.4)'; e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <Camera size={14} strokeWidth={1.75} /> Add Images
                </button>
                {selectedProject.url && (
                  <a href={selectedProject.url} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: '1px solid rgba(61,79,224,0.2)', background: 'rgba(61,79,224,0.08)', color: '#60A5FA', fontSize: '13px', textDecoration: 'none' }}>
                    <Link2 size={14} strokeWidth={1.75} /> View External Link
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', marginTop: isMobile ? '52px' : 0, height: isMobile ? 'calc(100vh - 52px)' : '100vh', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: isMobile ? '16px' : '32px 40px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>

          {/* ── IDENTITY SIDEBAR ── */}
          <aside style={{ width: isMobile ? '100%' : '280px', flexShrink: 0, position: isMobile ? 'static' : 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

            {/* CARD 1 — Identity */}
            <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px', textAlign: 'center' }}>
              {/* AVATAR */}
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '14px' }}>
                <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                <div onClick={() => avatarRef.current?.click()}
                  style={{ width: '88px', height: '88px', borderRadius: 'var(--radius-xl)', overflow: 'hidden', cursor: 'pointer', border: '3px solid var(--bg-main)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', position: 'relative', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                  title="Click to upload photo">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '30px', fontWeight: 800, color: 'white' }}>{initials}</span>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}>
                    <Camera size={22} strokeWidth={1.75} color="white" />
                  </div>
                </div>
                <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '22px', height: '22px', borderRadius: '50%', background: '#3D4FE0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-main)', pointerEvents: 'none' }}><Pencil size={11} strokeWidth={2} color="white" /></div>
              </div>

              <h1 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {user?.name || '—'}{user?.is_verified && <VerifiedBadge size={16} />}
              </h1>
              {profile.headline && <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#60A5FA', margin: '0 0 8px' }}>{profile.headline}</p>}

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '10px' }}>
                {plan && <span style={{ fontSize: '10.5px', fontWeight: 700, color: plan.color, background: plan.bg, padding: '3px 10px', borderRadius: '999px', textTransform: 'uppercase' }}>{plan.label}</span>}
                {user?.role === 'admin' && <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '3px 10px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Crown size={11} strokeWidth={2} /> Admin</span>}
              </div>

              {(profile.location || profile.company) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', marginBottom: '10px' }}>
                  {profile.location && <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} strokeWidth={1.75} /> {profile.location}</span>}
                  {profile.company && <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Building2 size={12} strokeWidth={1.75} /> {profile.company}</span>}
                </div>
              )}

            </div>

            <ProfileCompletion
              signals={{
                isVerified: completionExtra.isVerified,
                hasPost: completionExtra.hasPost,
                hasSentEmail: completionExtra.hasSentEmail,
                isPublic: completionExtra.isPublic,
                hasPortfolio: profile.portfolio.length > 0,
                hasAvatar: !!profile.avatar,
              }}
              onNavigateTab={() => setActiveTab('profile')}
            />

            {/* CARD 3 — Education / Experience summary + contact + links */}
            <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
              {profile.education.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Education</p>
                  {profile.education.slice(0, 2).map(e => (
                    <div key={e.id} style={{ marginBottom: '6px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{e.degree || e.school}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>{e.degree ? e.school : ''}{e.end_year ? `${e.degree ? ' · ' : ''}${e.end_year}` : ''}</p>
                    </div>
                  ))}
                  {profile.education.length > 2 && <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>+{profile.education.length - 2} more</p>}
                </div>
              )}

              {profile.experience.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Experience</p>
                  {profile.experience.slice(0, 2).map(e => (
                    <div key={e.id} style={{ marginBottom: '6px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{e.title}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>{e.company}</p>
                    </div>
                  ))}
                  {profile.experience.length > 2 && <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>+{profile.experience.length - 2} more</p>}
                </div>
              )}

              {/* CONTACT — deliberately last in the card, per Milad's request */}
              <div style={{ borderTop: (profile.education.length > 0 || profile.experience.length > 0) ? '1px solid var(--border)' : 'none', paddingTop: (profile.education.length > 0 || profile.experience.length > 0) ? '12px' : 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {user?.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <Mail size={13} strokeWidth={1.5} style={{ color: 'var(--text-dim)', flexShrink: 0 }} /> {user.email}
                  </div>
                )}
                {profile.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <Phone size={13} strokeWidth={1.5} style={{ color: 'var(--text-dim)', flexShrink: 0 }} /> {profile.phone}
                  </div>
                )}
                {profile.website && (
                  <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#60A5FA', textDecoration: 'none' }}>
                    <Globe size={13} strokeWidth={1.5} style={{ flexShrink: 0 }} /> {profile.website}
                  </a>
                )}
              </div>

              {user?.created_at && (
                <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '12px 0 0', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  Member since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              )}

              {completionExtra.isPublic && completionExtra.username && (
                <a href={`/u/${completionExtra.username}`} target="_blank" rel="noreferrer"
                  style={{ display: 'block', marginTop: '8px', fontSize: '12px', fontWeight: 600, color: '#60A5FA', textDecoration: 'none' }}>
                  View public profile ↗
                </a>
              )}

              {/* SETTINGS — Verification + Security, visually separated from the identity/content sections above */}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: '12px', paddingTop: '12px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Settings</p>
                <a href="/verification"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '8px' }}>
                  <ShieldCheck size={13} strokeWidth={2} style={{ flexShrink: 0 }} /> Identity Verification
                </a>
                <a href="/profile/security"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none' }}>
                  <Lock size={13} strokeWidth={2} style={{ flexShrink: 0 }} /> Security settings
                </a>
              </div>
            </div>

            {/* MARKETPLACE MODE — a view preference, not a permission; both
                modes can post work and take work (see switchAccountMode). */}
            <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '18px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Marketplace mode</p>
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
                {([['freelancer', 'Freelancer'], ['client', 'Client']] as const).map(([key, label]) => {
                  const on = accountMode === key
                  return (
                    <button key={key} type="button" onClick={() => switchAccountMode(key)} disabled={modeSaving}
                      style={{ flex: 1, padding: '7px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: '12px', fontWeight: 600, cursor: modeSaving ? 'wait' : 'pointer', transition: 'all 0.15s', background: on ? 'linear-gradient(135deg, #3D4FE0, #2E3BB0)' : 'transparent', color: on ? 'white' : 'var(--text-muted)' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
              <p style={{ fontSize: '10.5px', color: 'var(--text-dim)', margin: '8px 0 0', lineHeight: 1.5 }}>
                View preference only — both modes can post and take work.
              </p>
            </div>
          </aside>

          {/* ── MAIN COLUMN ── */}
          <main style={{ flex: 1, minWidth: 0 }}>

          {/* TABS */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ flex: 1, padding: '9px', fontSize: isMobile ? '11px' : '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '4px' : '6px', transition: 'all 0.15s', background: activeTab === tab.id ? 'linear-gradient(135deg, #3D4FE0, #2E3BB0)' : 'transparent', color: activeTab === tab.id ? 'white' : 'var(--text-muted)' }}>
                <tab.icon size={14} strokeWidth={1.75} /> {tab.label}
              </button>
            ))}
          </div>

          {/* ── TAB: PROFILE (merged Info + Skills + Portfolio + Education + Experience + Verification) ── */}
          {activeTab === 'profile' && (
            <>
            {reputation && reputation.sent > 0 && (
              <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px', marginBottom: 'var(--space-4)' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>Email Reputation</h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '0 0 16px', lineHeight: 1.6 }}>
                  A rough health signal for your outreach, based on how often people reply.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', fontWeight: 800,
                    color: reputation.score >= 60 ? '#34D399' : reputation.score >= 30 ? '#FBBF24' : '#F87171',
                    border: `2px solid ${reputation.score >= 60 ? 'rgba(52,211,153,0.4)' : reputation.score >= 30 ? 'rgba(251,191,36,0.4)' : 'rgba(248,113,113,0.4)'}`,
                  }}>
                    {reputation.score}
                  </div>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Sent</div><div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>{reputation.sent}</div></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Replied</div><div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>{reputation.replied}</div></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Reply rate</div><div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>{Math.round(reputation.reply_rate * 100)}%</div></div>
                  </div>
                </div>
              </div>
            )}

            {/* HEADLINE & BIO */}
            <SectionCard title="Headline & Description" editing={editingBio} onToggleEdit={() => setEditingBio(v => !v)}>
              {editingBio ? (
                <>
                  <label style={labelStyle}>Professional headline</label>
                  <input value={profile.headline} maxLength={80} onChange={e => setProfile(p => ({ ...p, headline: e.target.value }))}
                    placeholder="e.g. Senior Architectural Visualization Artist" style={inputStyle} />
                  <p style={counterStyle}>{profile.headline.length}/80</p>
                  <label style={{ ...labelStyle, marginTop: '14px' }}>Description</label>
                  <textarea value={profile.bio} maxLength={800} rows={5} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Tell clients about your studio and expertise..." style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
                  <p style={counterStyle}>{profile.bio.length}/800</p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                    <button onClick={() => { saveProfile(); setEditingBio(false) }} style={saveBtnStyle}>{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                </>
              ) : (
                <>
                  {profile.headline
                    ? <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>{profile.headline}</p>
                    : <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: '0 0 8px' }}>No headline yet</p>}
                  {profile.bio
                    ? <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{profile.bio}</p>
                    : <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>No description yet — introduce your studio and expertise.</p>}
                </>
              )}
            </SectionCard>

            {/* SKILLS */}
            <SectionCard title="Skills & Expertise" editing={editingSkills} onToggleEdit={() => setEditingSkills(v => !v)}>
              {editingSkills ? (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    {SKILLS_OPTIONS.map(skill => {
                      const selected = profile.skills.includes(skill)
                      return (
                        <button key={skill} onClick={() => toggleSkill(skill)}
                          style={{ padding: '7px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', background: selected ? 'linear-gradient(135deg, #3D4FE0, #2E3BB0)' : 'var(--bg-input)', color: selected ? 'white' : 'var(--text-muted)', boxShadow: selected ? '0 2px 8px rgba(61,79,224,0.3)' : 'none' }}>
                          {selected && <Check size={12} strokeWidth={2.5} />}{skill}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <input value={newSkill} onChange={e => setNewSkill(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCustomSkill()}
                      placeholder="e.g. Rhino, Grasshopper, Midjourney..."
                      style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={addCustomSkill} disabled={!newSkill.trim()}
                      style={{ padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: 'pointer', opacity: !newSkill.trim() ? 0.4 : 1 }}>
                      + Add
                    </button>
                  </div>
                  {profile.customSkills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                      {profile.customSkills.map(skill => (
                        <span key={skill} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#A78BFA', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', padding: '5px 12px', borderRadius: '999px' }}>
                          {skill}
                          <button onClick={() => removeCustomSkill(skill)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(167,139,250,0.5)', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}><X size={12} strokeWidth={2} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => { saveProfile(); setEditingSkills(false) }} style={saveBtnStyle}>{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                </>
              ) : allSkills.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {allSkills.map(s => (
                    <span key={s} style={{ fontSize: '12px', fontWeight: 600, color: '#60A5FA', background: 'rgba(61,79,224,0.1)', border: '1px solid rgba(61,79,224,0.15)', padding: '5px 12px', borderRadius: '999px' }}>{s}</span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>No skills added yet</p>
              )}
            </SectionCard>

            {/* PORTFOLIO */}
            <SectionCard title="Portfolio" editing={editingPortfolio} onToggleEdit={() => setEditingPortfolio(v => !v)}>
              {editingPortfolio && (
                <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid rgba(61,79,224,0.2)', background: 'rgba(61,79,224,0.03)', padding: '20px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '0 0 14px' }}>Add New Project</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={labelStyle}>Project Title *</label>
                      <input value={newPortfolio.title} onChange={e => setNewPortfolio(p => ({ ...p, title: e.target.value }))}
                        placeholder="Modern Villa, Dubai" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>External Link (optional)</label>
                      <input value={newPortfolio.url} onChange={e => setNewPortfolio(p => ({ ...p, url: e.target.value }))}
                        placeholder="https://behance.net/..." style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Description</label>
                      <input value={newPortfolio.desc} onChange={e => setNewPortfolio(p => ({ ...p, desc: e.target.value }))}
                        placeholder="3D visualization for a luxury residential project..." style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>Photos (optional)</label>
                    <input ref={newProjectImgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleNewProjectImages} />
                    <button onClick={() => newProjectImgRef.current?.click()}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', borderRadius: '10px', border: '1px dashed rgba(61,79,224,0.4)', background: 'rgba(61,79,224,0.04)', color: '#60A5FA', cursor: 'pointer', fontSize: '13px', width: '100%', justifyContent: 'center' }}>
                      <Camera size={14} strokeWidth={1.75} /> Add Photos {newPortfolioImages.length > 0 && <span style={{ background: '#3D4FE0', color: 'white', borderRadius: '999px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{newPortfolioImages.length}</span>}
                    </button>
                    {newPortfolioImages.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                        {newPortfolioImages.map(img => (
                          <div key={img.id} style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <img src={img.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button onClick={() => setNewPortfolioImages(prev => prev.filter(i => i.id !== img.id))}
                              style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(239,68,68,0.85)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={9} strokeWidth={2.5} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={addPortfolio} disabled={!newPortfolio.title} style={{ ...saveBtnStyle, opacity: !newPortfolio.title ? 0.4 : 1 }}>
                    + Create Project
                  </button>
                </div>
              )}
              <PortfolioGrid
                items={profile.portfolio}
                isMobile={isMobile}
                editable={editingPortfolio}
                onSelect={setSelectedProject}
                onAddImages={handlePortfolioImages}
                onDeleteItem={removePortfolio}
                emptyTitle="No projects yet"
                emptySubtitle="Create a project and upload your architectural visualizations"
              />
            </SectionCard>

            {/* EDUCATION */}
            <SectionCard title="Education" editing={editingEducation} onToggleEdit={() => setEditingEducation(v => !v)}>
              {profile.education.length === 0 && !editingEducation && (
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>No education added yet</p>
              )}
              {profile.education.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <GraduationCap size={16} strokeWidth={1.5} style={{ color: 'var(--text-dim)', marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{e.degree || 'Education'}{e.field ? ` · ${e.field}` : ''}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      {e.school}{(e.start_year || e.end_year) ? ` · ${e.start_year || ''}${e.start_year && e.end_year ? '–' : ''}${e.end_year || ''}` : ''}
                    </p>
                  </div>
                  {editingEducation && <button onClick={() => removeEducation(e.id)} style={rowDeleteBtnStyle}><X size={12} strokeWidth={2} /></button>}
                </div>
              ))}
              {editingEducation && (
                <div style={{ marginTop: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(61,79,224,0.2)', background: 'rgba(61,79,224,0.03)', padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>School *</label>
                      <input value={newEducation.school} onChange={e => setNewEducation(p => ({ ...p, school: e.target.value }))} placeholder="Politecnico di Milano" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Degree</label>
                      <input value={newEducation.degree} onChange={e => setNewEducation(p => ({ ...p, degree: e.target.value }))} placeholder="Bachelor of Architecture" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Field of Study</label>
                      <input value={newEducation.field} onChange={e => setNewEducation(p => ({ ...p, field: e.target.value }))} placeholder="Architecture" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Start Year</label>
                      <input value={newEducation.start_year} onChange={e => setNewEducation(p => ({ ...p, start_year: e.target.value }))} placeholder="2016" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>End Year</label>
                      <input value={newEducation.end_year} onChange={e => setNewEducation(p => ({ ...p, end_year: e.target.value }))} placeholder="2020" style={inputStyle} />
                    </div>
                  </div>
                  <button onClick={addEducation} disabled={!newEducation.school.trim()} style={{ ...saveBtnStyle, opacity: !newEducation.school.trim() ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={13} strokeWidth={2.5} /> Add Education
                  </button>
                </div>
              )}
            </SectionCard>

            {/* EXPERIENCE */}
            <SectionCard title="Work Experience" editing={editingExperience} onToggleEdit={() => setEditingExperience(v => !v)}>
              {profile.experience.length === 0 && !editingExperience && (
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>No work experience added yet</p>
              )}
              {profile.experience.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <Briefcase size={16} strokeWidth={1.5} style={{ color: 'var(--text-dim)', marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{e.title}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      {e.company}{(e.start_date || e.end_date) ? ` · ${e.start_date || ''}${e.start_date && e.end_date ? '–' : ''}${e.end_date || ''}` : ''}
                    </p>
                    {e.description && <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '4px 0 0', lineHeight: 1.5 }}>{e.description}</p>}
                  </div>
                  {editingExperience && <button onClick={() => removeExperience(e.id)} style={rowDeleteBtnStyle}><X size={12} strokeWidth={2} /></button>}
                </div>
              ))}
              {editingExperience && (
                <div style={{ marginTop: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(61,79,224,0.2)', background: 'rgba(61,79,224,0.03)', padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={labelStyle}>Job Title *</label>
                      <input value={newExperience.title} onChange={e => setNewExperience(p => ({ ...p, title: e.target.value }))} placeholder="Senior 3D Artist" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Company</label>
                      <input value={newExperience.company} onChange={e => setNewExperience(p => ({ ...p, company: e.target.value }))} placeholder="Studio Name" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Start Date</label>
                      <input value={newExperience.start_date} onChange={e => setNewExperience(p => ({ ...p, start_date: e.target.value }))} placeholder="Jan 2021" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>End Date</label>
                      <input value={newExperience.end_date} onChange={e => setNewExperience(p => ({ ...p, end_date: e.target.value }))} placeholder="Present" style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Description</label>
                      <input value={newExperience.description} onChange={e => setNewExperience(p => ({ ...p, description: e.target.value }))} placeholder="What did you work on?" style={inputStyle} />
                    </div>
                  </div>
                  <button onClick={addExperience} disabled={!newExperience.title.trim()} style={{ ...saveBtnStyle, opacity: !newExperience.title.trim() ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={13} strokeWidth={2.5} /> Add Experience
                  </button>
                </div>
              )}
            </SectionCard>
            </>
          )}

          {/* ── TAB: POSTS ── */}
          {activeTab === 'posts' && (
            <div>
              {!postsLoaded ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
              ) : myPosts.length === 0 ? (
                <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
                  You haven't posted anything yet. <a href="/feed" style={{ color: '#60A5FA' }}>Share something on the Feed →</a>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myPosts.map(p => (
                    <div key={p.id} style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                        {editingPostId !== p.id && (
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => startEditPost(p)} style={{ fontSize: '11px', color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                            <button onClick={() => deleteMyPost(p.id)} style={{ fontSize: '11px', color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
                          </div>
                        )}
                      </div>
                      {editingPostId === p.id ? (
                        <div>
                          <textarea rows={3} value={editPostText} onChange={e => setEditPostText(e.target.value)}
                            style={{ ...inputStyle, resize: 'vertical', marginBottom: '8px' }} />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => saveEditPost(p.id)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer' }}>Save</button>
                            <button onClick={() => setEditingPostId(null)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: '13.5px', color: 'var(--text)', margin: '0 0 8px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{p.text}</p>
                      )}
                      {p.image_url && <img src={p.image_url} alt="" style={{ maxWidth: '100%', borderRadius: '10px', marginBottom: '8px', display: 'block' }} />}
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-dim)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Heart size={12} strokeWidth={1.75} /> {p.like_count}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={12} strokeWidth={1.75} /> {p.comment_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </main>
        </div>
      </div>
    </div>
  )
}
