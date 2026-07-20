'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => localStorage.getItem('archon-token') || ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

// ─────────────────────────────────────────────────────────
// PublishSection — drop this into your Profile page
//
// USAGE:
//   1. Copy this file to: frontend/app/profile/PublishSection.tsx
//   2. In frontend/app/profile/page.tsx, add near the top:
//        import PublishSection from './PublishSection'
//   3. Render it inside your Security tab (or wherever you like):
//        {activeTab === 'security' && (
//          <>
//            <PublishSection profile={profile} />
//            {/* ...your existing security tab content... */}
//          </>
//        )}
//
//   "profile" is your existing LocalProfile state object —
//   the same one you already save to localStorage
//     { bio, location, website, company, phone, skills, customSkills, avatar, portfolio }
// ─────────────────────────────────────────────────────────

interface Props {
  profile: {
    bio?: string
    location?: string
    website?: string
    company?: string
    phone?: string
    skills?: string[]
    customSkills?: string[]
    avatar?: string
    portfolio?: any[]
  }
}

export default function PublishSection({ profile }: Props) {
  const [isPublic, setIsPublic] = useState(false)
  const [username, setUsername] = useState('')
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Load existing publish state on mount
  useEffect(() => {
    axios.get(`${API}/auth/profile/me`, { headers: headers() })
      .then(res => {
        setIsPublic(!!res.data.is_public)
        setUsername(res.data.username || '')
        if (res.data.is_public && res.data.username) {
          setPublicUrl(`${window.location.origin}/u/${res.data.username}`)
        }
      })
      .catch(() => {})
  }, [])

  const publish = async (makePublic: boolean) => {
    setSaving(true); setError('')
    try {
      const res = await axios.put(`${API}/auth/profile/me`, {
        bio: profile.bio || '',
        location: profile.location || '',
        website: profile.website || '',
        company: profile.company || '',
        phone: profile.phone || '',
        avatar: profile.avatar || '',
        skills: profile.skills || [],
        customSkills: profile.customSkills || [],
        portfolio: profile.portfolio || [],
        is_public: makePublic,
        username: username || undefined,
      }, { headers: headers() })

      setIsPublic(res.data.is_public)
      setUsername(res.data.username)
      setPublicUrl(res.data.public_url ? `${window.location.origin}${res.data.public_url}` : null)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to save. Please try again.')
    }
    setSaving(false)
  }

  const copyLink = () => {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🌐 Public Profile
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '4px 0 0' }}>
            Share your portfolio with a public link — anyone can view it without logging in.
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <span style={{ fontSize: '12px', color: isPublic ? '#34D399' : 'var(--text-dim)', fontWeight: 600 }}>
            {isPublic ? 'Public' : 'Private'}
          </span>
          <div
            onClick={() => publish(!isPublic)}
            style={{ width: '40px', height: '22px', borderRadius: '999px', position: 'relative', cursor: 'pointer', background: isPublic ? '#34D399' : 'var(--bg-input)', border: '1px solid var(--border)', transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: '2px', left: isPublic ? '20px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
          </div>
        </label>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Custom URL
          </label>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <span style={{ padding: '9px 10px', fontSize: '13px', color: 'var(--text-dim)', borderRight: '1px solid var(--border)' }}>/u/</span>
            <input value={username} onChange={e => setUsername(e.target.value)}
              placeholder="your-name"
              style={{ flex: 1, background: 'none', border: 'none', padding: '9px 10px', fontSize: '13px', color: 'var(--text)', outline: 'none' }} />
          </div>
        </div>
        <button onClick={() => publish(true)} disabled={saving}
          style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1, alignSelf: 'flex-end' }}>
          {saving ? 'Saving...' : 'Save & Publish'}
        </button>
      </div>

      {publicUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <span style={{ fontSize: '16px' }}>✅</span>
          <a href={publicUrl} target="_blank" style={{ flex: 1, fontSize: '13px', color: '#34D399', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {publicUrl}
          </a>
          <button onClick={copyLink}
            style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', color: '#34D399', cursor: 'pointer' }}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      )}
    </div>
  )
}
