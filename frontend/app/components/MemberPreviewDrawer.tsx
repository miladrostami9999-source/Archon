'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { X, ArrowRight, MapPin } from 'lucide-react'
import VerifiedBadge from './VerifiedBadge'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface MemberPreview {
  id: number; name: string; username: string | null
  is_verified: boolean; account_mode: string
  avatar: string; bio: string; location: string
  skills: string[]; customSkills: string[]
  portfolio: { id: string }[]
  rating: number | null; review_count: number
  completed_contracts: number
}

/** Same drawer pattern as the company quick-preview on Dashboard, but as a
 * standalone component — this one gets reused across Feed, Projects,
 * Contracts, Messages, Users and Marketplace Admin, so it can't live inside
 * a single page like the company one does. Always fetches on open since,
 * unlike a company row, callers here typically only have an id + a name,
 * not the full profile. */
export default function MemberPreviewDrawer({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const [member, setMember] = useState<MemberPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!userId) { setMember(null); setNotFound(false); return }
    setLoading(true); setNotFound(false); setMember(null)
    axios.get(`${API}/marketplace/members/${userId}`)
      .then(r => setMember(r.data))
      .catch(e => { if (e.response?.status === 404) setNotFound(true) })
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [userId, onClose])

  if (!userId) return null

  const initials = (member?.name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const skills = [...(member?.skills || []), ...(member?.customSkills || [])].slice(0, 6)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: '420px', maxWidth: '100%',
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 61,
        display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        animation: 'memberDrawerSlideIn 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick preview</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', borderRadius: 'var(--radius-sm)' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading && (
            <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Loading…</p>
          )}
          {notFound && (
            <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Profile not found.</p>
          )}
          {member && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' }}>
                  {member.avatar
                    ? <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>{initials}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {member.name}{member.is_verified && <VerifiedBadge size={14} />}
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>
                    {member.account_mode === 'client' ? '💼 Hires' : '🎨 Takes work'}
                  </p>
                </div>
              </div>

              {member.location && (
                <p style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                  <MapPin size={13} strokeWidth={1.5} /> {member.location}
                </p>
              )}

              {member.bio && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 16px' }}>{member.bio}</p>
              )}

              {skills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                  {skills.map(s => (
                    <span key={s} style={{ fontSize: '11px', background: 'var(--bg-tag)', color: 'var(--text-muted)', padding: '3px 9px', borderRadius: '999px' }}>{s}</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border)', paddingTop: '14px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                <span>{member.rating ? `★ ${member.rating.toFixed(1)}` : 'No ratings yet'}{member.review_count > 0 ? ` (${member.review_count})` : ''}</span>
                <span>{member.completed_contracts} completed</span>
                <span>{member.portfolio.length} portfolio</span>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => { window.location.href = `/members/${userId}` }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: 'pointer' }}>
            View full profile <ArrowRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <style>{`@keyframes memberDrawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  )
}
