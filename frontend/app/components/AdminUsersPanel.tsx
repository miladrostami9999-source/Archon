'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import VerifiedBadge from './VerifiedBadge'
import { useIsMobile } from '../hooks/useIsMobile'
import { Download, Plus, Hourglass, Gem, Star, Trophy, Trash2, X, Briefcase, Palette, ShieldCheck, Crown, Lock, ShoppingCart } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => localStorage.getItem('archon-token') || ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

const PLAN_META = {
  trial:  { color: '#34D399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)', Icon: Hourglass },
  basic:  { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.25)', Icon: Gem },
  pro:    { color: '#60A5FA', bg: 'rgba(61,79,224,0.12)',  border: 'rgba(61,79,224,0.25)',  Icon: Star },
  agency: { color: '#A78BFA', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', Icon: Trophy },
} as const

interface User {
  id: number; name: string; email: string
  role: string; plan: string; is_active: boolean
  created_at: string; last_login: string | null
  marketplace_beta_enabled?: boolean
  account_mode?: string
  is_verified?: boolean
  is_founder?: boolean
}

const PLAN_RANK: Record<string, number> = { agency: 0, pro: 1, basic: 2, trial: 3 }
// Founder first, then admins, then everyone else by plan tier — this pin
// always wins regardless of the chosen sort mode.
const roleRank = (u: User) => u.is_founder ? 0 : u.role === 'admin' ? 1 : 2

export default function AdminUsersPanel() {
  const isMobile = useIsMobile()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', plan: 'basic' })
  const [messagingId, setMessagingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [sortBy, setSortBy] = useState<'recent' | 'plan'>('recent')
  const [deleteError, setDeleteError] = useState('')

  const messageUser = async (userId: number) => {
    setMessagingId(userId)
    try {
      await axios.post(`${API}/marketplace/conversations/start`, { user_id: userId }, { headers: headers() })
      window.location.href = '/messages'
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Could not open a conversation.')
      setMessagingId(null)
    }
  }

  const emailUser = (email: string) => {
    navigator.clipboard?.writeText(email).then(() => { setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000) }).catch(() => {})
    window.location.href = `mailto:${email}`
  }

  const fetchUsers = async () => {
    try { const r = await axios.get(`${API}/auth/users`, { headers: headers() }); setUsers(r.data) }
    catch {}
    setLoading(false)
  }
  useEffect(() => { fetchUsers() }, [])

  const openDetail = async (id: number) => {
    setLoadingDetail(true); setDetail(null)
    try {
      const r = await axios.get(`${API}/auth/users/${id}/detail`, { headers: headers() })
      setDetail(r.data)
    } catch { alert('Could not load this user') }
    setLoadingDetail(false)
  }

  const createUser = async () => {
    if (!addForm.name || !addForm.email || !addForm.password) { setError('All fields required'); return }
    setSaving(true); setError('')
    try { await axios.post(`${API}/auth/users`, addForm, { headers: headers() }); setAddForm({ name: '', email: '', password: '', plan: 'basic' }); setShowAdd(false); fetchUsers() }
    catch (e: any) { setError(e.response?.data?.detail || 'Error') }
    setSaving(false)
  }

  const updateUser = async (id: number, data: Partial<User>) => {
    try { await axios.patch(`${API}/auth/users/${id}`, data, { headers: headers() }); fetchUsers(); setEditUser(null) }
    catch (e: any) { alert(e.response?.data?.detail || 'Could not update this user') }
  }

  const deleteUser = async (id: number) => {
    setDeleteError('')
    try { await axios.delete(`${API}/auth/users/${id}`, { headers: headers() }); fetchUsers(); setDeleteConfirm(null) }
    catch (e: any) { setDeleteError(e.response?.data?.detail || 'Could not delete this user.') }
  }

  const planCounts = { basic: 0, pro: 0, agency: 0 }
  users.forEach(u => { if (u.is_active && u.plan in planCounts) (planCounts as any)[u.plan]++ })
  const activeCount = users.filter(u => u.is_active).length

  const filtered = users
    .filter(u => {
      if (filterPlan && u.plan !== filterPlan) return false
      if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      // Founder/admins are always pinned to the top, whatever the sort mode.
      const pin = roleRank(a) - roleRank(b)
      if (pin !== 0) return pin
      if (sortBy === 'plan') {
        const rank = (PLAN_RANK[a.plan] ?? 9) - (PLAN_RANK[b.plan] ?? 9)
        if (rank !== 0) return rank
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never'

  const inp: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' as const }

  return (
    <>
      {(detail || loadingDetail) && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '540px', maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '18px', padding: '24px' }}>
            {loadingDetail || !detail ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>Loading...</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(61,79,224,0.3)' }}>
                    {detail.profile?.avatar ? (
                      <img src={detail.profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' }}>
                        {detail.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>{detail.name}{detail.is_verified && <VerifiedBadge size={15} />}</h2>
                    <a href={`mailto:${detail.email}`} style={{ fontSize: '12.5px', color: '#60A5FA', textDecoration: 'none' }}>{detail.email}</a>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: '#A78BFA', background: 'rgba(139,92,246,0.12)', textTransform: 'uppercase' }}>{detail.plan}</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: detail.plan_status === 'active' ? '#34D399' : '#FBBF24', background: detail.plan_status === 'active' ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)' }}>{detail.plan_status}</span>
                      {!detail.is_active && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: '#F87171', background: 'rgba(248,113,113,0.12)' }}>disabled</span>}
                    </div>
                  </div>
                  <button onClick={() => setDetail(null)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>X</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px', marginBottom: '18px' }}>
                  {[
                    ['Companies', detail.activity.companies],
                    ['Generated', detail.activity.emails_generated],
                    ['Sent', detail.activity.emails_sent],
                    ['Replies', detail.activity.replies],
                    ['Reply rate', `${detail.activity.reply_rate}%`],
                    ['Notes', detail.activity.notes],
                  ].map(([label, value]) => (
                    <div key={String(label)} style={{ borderRadius: '10px', background: 'var(--bg-input)', padding: '10px' }}>
                      <p style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{value as any}</p>
                      <p style={{ fontSize: '10.5px', color: 'var(--text-dim)', margin: 0 }}>{label as any}</p>
                    </div>
                  ))}
                </div>

                {(detail.profile?.location || detail.profile?.company) && (
                  <div style={{ borderRadius: '12px', border: '1px solid var(--border)', padding: '14px', marginBottom: '14px' }}>
                    {detail.profile.company && <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>{detail.profile.company}</p>}
                    {detail.profile.location && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{detail.profile.location}</p>}
                  </div>
                )}

                {(['freelancer', 'client'] as const).map(hat => {
                  const h = detail.profile?.[hat]
                  if (!h || (!h.bio && !h.skills?.length && !h.portfolio_count)) return null
                  return (
                    <div key={hat} style={{ borderRadius: '12px', border: '1px solid var(--border)', padding: '14px', marginBottom: '14px' }}>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>{hat} profile</p>
                      {h.bio && <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>{h.bio}</p>}
                      {h.skills?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
                          {h.skills.slice(0, 10).map((sk: string) => (
                            <span key={sk} style={{ fontSize: '10.5px', padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-tag)', color: 'var(--text-muted)' }}>{sk}</span>
                          ))}
                        </div>
                      )}
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '8px 0 0' }}>Portfolio projects: {h.portfolio_count}</p>
                    </div>
                  )
                })}

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                  <span>Signed up: {detail.created_at ? new Date(detail.created_at).toLocaleDateString() : '-'}</span>
                  <span>Last login: {detail.last_login ? new Date(detail.last_login).toLocaleDateString() : 'never'}</span>
                  <span>Plan expires: {detail.plan_expires_at ? new Date(detail.plan_expires_at).toLocaleDateString() : '-'}</span>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={() => emailUser(detail.email)}
                    style={{ flex: 1, minWidth: '130px', textAlign: 'center', padding: '10px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer' }}>
                    {copiedEmail ? '✓ Email copied' : 'Email this user'}
                  </button>
                  {detail.public_url && (
                    <a href={detail.public_url} target="_blank" rel="noreferrer"
                      style={{ flex: 1, minWidth: '130px', textAlign: 'center', padding: '10px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', textDecoration: 'none' }}>
                      View public profile
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deleteConfirm !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '32px 28px', maxWidth: '320px', width: 'calc(100% - 32px)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Trash2 size={22} strokeWidth={1.75} color="#F87171" /></div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Delete User?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>This action is permanent and cannot be undone.</p>
            {deleteError && <p style={{ fontSize: '12px', color: '#F87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '8px 10px', margin: '0 0 16px', lineHeight: 1.5 }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setDeleteConfirm(null); setDeleteError('') }} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteUser(deleteConfirm)} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#EF4444,#DC2626)', border: 'none', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Users</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>{activeCount} active · {users.length} total</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer' }}>
          <Plus size={14} strokeWidth={2} /> Add User
        </button>
      </div>

      {/* PLAN STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? '10px' : '14px', marginBottom: '20px' }}>
        {(['trial', 'basic', 'pro', 'agency'] as const).map(plan => {
          const pm = PLAN_META[plan]
          const count = (planCounts as any)[plan] ?? users.filter(u => u.plan === plan && u.is_active).length
          const isActive = filterPlan === plan
          return (
            <div key={plan} onClick={() => setFilterPlan(isActive ? '' : plan)}
              style={{ borderRadius: 'var(--radius-lg)', border: `1px solid ${isActive ? pm.color : 'var(--border)'}`, background: isActive ? pm.bg : 'var(--bg-card)', padding: isMobile ? '12px' : '14px 16px', cursor: 'pointer' }}>
              <p style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 800, color: pm.color, margin: 0 }}>{count}</p>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', margin: '4px 0 0', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '4px' }}><pm.Icon size={12} strokeWidth={1.75} /> {plan}</p>
            </div>
          )
        })}
      </div>

      {/* ADD FORM */}
      {showAdd && (
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent)', background: 'var(--accent-dim)', padding: isMobile ? '16px' : '20px', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }}>Create New User</h3>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '12px', padding: '8px 12px', borderRadius: '8px', marginBottom: '14px' }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            {[
              { label: 'Full Name', key: 'name', ph: 'John Doe', type: 'text' },
              { label: 'Email', key: 'email', ph: 'john@studio.com', type: 'email' },
              { label: 'Password', key: 'password', ph: 'Min 8 chars', type: 'password' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
                <input value={(addForm as any)[f.key]} onChange={e => setAddForm({ ...addForm, [f.key]: e.target.value })} placeholder={f.ph} type={f.type} style={inp} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Plan</label>
              <select value={addForm.plan} onChange={e => setAddForm({ ...addForm, plan: e.target.value })} style={inp}>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="agency">Agency</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowAdd(false); setError('') }} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-input)', cursor: 'pointer' }}>Cancel</button>
            <button onClick={createUser} disabled={saving} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      )}

      {/* SEARCH + SORT */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1, maxWidth: '320px' }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'recent' | 'plan')}
          style={{ ...inp, width: 'auto', flex: 'none' }}>
          <option value="recent">Sort: Most recent</option>
          <option value="plan">Sort: By plan (Agency → Basic)</option>
        </select>
        {(search || filterPlan) && (
          <button onClick={() => { setSearch(''); setFilterPlan('') }}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-input)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Clear
          </button>
        )}
        <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{filtered.length} / {users.length}</span>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '0 0 14px' }}>Founder and admins are always pinned to the top.</p>

      {/* USER LIST */}
      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '40px' }}>Loading users…</p>
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '40px' }}>No users found</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '20px' }}>
          {filtered.map(u => {
            const pm = PLAN_META[u.plan as keyof typeof PLAN_META] || PLAN_META.basic
            const isEditing = editUser?.id === u.id
            const initials = u.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
            return (
              <div key={u.id} style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: isMobile ? '14px' : '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                    {initials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <a href={`/members/${u.id}`} style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>{u.name}</a>
                      {u.is_verified && <VerifiedBadge size={13} />}

                      {isEditing ? (
                        <select value={editUser.plan} onChange={e => setEditUser({ ...editUser, plan: e.target.value })}
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', color: 'var(--text)', outline: 'none' }}>
                          <option value="trial">Trial</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="agency">Agency</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: pm.color, background: pm.bg, border: `1px solid ${pm.border}`, padding: '2px 8px', borderRadius: '999px', textTransform: 'capitalize', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <pm.Icon size={10} strokeWidth={1.75} /> {u.plan}
                        </span>
                      )}

                      {!isEditing && u.role !== 'admin' && (
                        <span title="Marketplace mode" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-dim)' }}>
                          {u.account_mode === 'client' ? <Briefcase size={10} strokeWidth={1.75} /> : <Palette size={10} strokeWidth={1.75} />}
                          {u.account_mode === 'client' ? 'hires' : 'takes work'}
                        </span>
                      )}

                      {u.is_founder ? (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#A78BFA', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', padding: '2px 8px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={10} strokeWidth={1.75} /> Founder</span>
                      ) : isEditing ? (
                        <select value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', color: 'var(--text)', outline: 'none' }}>
                          <option value="member">Member</option><option value="admin">Admin</option>
                        </select>
                      ) : u.role === 'admin' ? (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', padding: '2px 8px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Crown size={10} strokeWidth={1.75} /> Admin</span>
                      ) : null}

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600, color: u.is_active ? '#34D399' : '#F87171' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: u.is_active ? '#34D399' : '#F87171', display: 'inline-block' }} />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>
                      {u.email}
                      {!isMobile && u.last_login && <span style={{ marginLeft: '8px', opacity: 0.6 }}>· Last login: {formatDate(u.last_login)}</span>}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                    {u.is_founder ? (
                      <>
                        <button onClick={() => openDetail(u.id)}
                          style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', color: '#A78BFA', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', cursor: 'pointer', fontWeight: 600 }}>View</button>
                        <span title="The founder account cannot be edited, disabled or deleted by anyone." style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '8px', color: 'var(--text-dim)', background: 'var(--bg-input)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Lock size={11} strokeWidth={1.75} /> Locked</span>
                      </>
                    ) : isEditing ? (
                      <>
                        <button onClick={() => updateUser(u.id, { plan: editUser.plan, role: editUser.role })}
                          style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                        <button onClick={() => setEditUser(null)}
                          style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '8px', color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex' }}><X size={13} strokeWidth={1.75} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openDetail(u.id)}
                          style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', color: '#A78BFA', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', cursor: 'pointer', fontWeight: 600 }}>View</button>
                        <button onClick={() => setEditUser(u)}
                          style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', color: '#60A5FA', background: 'rgba(61,79,224,0.1)', border: '1px solid rgba(61,79,224,0.2)', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                        <button onClick={() => messageUser(u.id)} disabled={messagingId === u.id}
                          style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', cursor: 'pointer', fontWeight: 600 }}>
                          {messagingId === u.id ? '…' : 'Message'}
                        </button>
                        <button onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                          style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', color: u.is_active ? '#F87171' : '#34D399', background: u.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)', border: `1px solid ${u.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}`, cursor: 'pointer', fontWeight: 600 }}>
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        {u.role !== 'admin' && (
                          <button
                            title={u.marketplace_beta_enabled === false ? 'Marketplace is off for this account' : 'Marketplace is on for this account'}
                            onClick={() => updateUser(u.id, { marketplace_beta_enabled: u.marketplace_beta_enabled === false })}
                            style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
                              color: u.marketplace_beta_enabled === false ? 'var(--text-dim)' : '#A78BFA',
                              background: u.marketplace_beta_enabled === false ? 'var(--bg-input)' : 'rgba(139,92,246,0.1)',
                              border: `1px solid ${u.marketplace_beta_enabled === false ? 'var(--border)' : 'rgba(139,92,246,0.2)'}` }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ShoppingCart size={11} strokeWidth={1.75} /> {u.marketplace_beta_enabled === false ? 'Off' : 'On'}</span>
                          </button>
                        )}
                        {u.role !== 'admin' && (
                          <button onClick={() => setDeleteConfirm(u.id)}
                            style={{ padding: '5px 8px', borderRadius: '8px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><Trash2 size={13} strokeWidth={1.75} /></button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
