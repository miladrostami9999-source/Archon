'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import VerifiedBadge from '../components/VerifiedBadge'
import { useIsMobile } from '../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => localStorage.getItem('archon-token') || ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

const PLAN_META = {
  trial:  { color: '#34D399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)', icon: '⏳', gradient: 'linear-gradient(135deg,rgba(52,211,153,0.15),rgba(52,211,153,0.05))' },
  basic:  { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.25)', icon: '◈', gradient: 'linear-gradient(135deg,rgba(156,163,175,0.15),rgba(156,163,175,0.05))' },
  pro:    { color: '#60A5FA', bg: 'rgba(61,79,224,0.12)',  border: 'rgba(61,79,224,0.25)',  icon: '⭐', gradient: 'linear-gradient(135deg,rgba(61,79,224,0.2),rgba(61,79,224,0.05))' },
  agency: { color: '#A78BFA', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', icon: '🏆', gradient: 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(139,92,246,0.05))' },
} as const

interface User {
  id: number; name: string; email: string
  role: string; plan: string; is_active: boolean
  created_at: string; last_login: string | null
  marketplace_beta_enabled?: boolean
  account_mode?: string
  is_verified?: boolean
}

export default function UsersPage() {
  const isMobile = useIsMobile()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', plan: 'basic' })
  const [messagingId, setMessagingId] = useState<number | null>(null)

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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [copiedEmail, setCopiedEmail] = useState(false)

  // mailto: silently does nothing if the OS has no default mail client set (common
  // for webmail-only users) — so open it AND copy the address as a fallback the
  // user can paste into Gmail/whatever they actually use.
  const emailUser = (email: string) => {
    navigator.clipboard?.writeText(email).then(() => { setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000) }).catch(() => {})
    window.location.href = `mailto:${email}`
  }

  const fetchUsers = async () => {
    try { const r = await axios.get(`${API}/auth/users`, { headers: headers() }); setUsers(r.data) }
    catch (e: any) { if (e.response?.status === 403) window.location.href = '/dashboard' }
    setLoading(false)
  }
  useEffect(() => { fetchUsers() }, [])

  // Export goes through axios so the auth header is sent
  const exportUsers = async () => {
    try {
      const res = await axios.get(`${API}/auth/users/export`, { headers: headers(), responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = `archon_users_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Export failed') }
  }

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
    catch {}
  }

  const deleteUser = async (id: number) => {
    try { await axios.delete(`${API}/auth/users/${id}`, { headers: headers() }); fetchUsers(); setDeleteConfirm(null) }
    catch (e: any) { alert(e.response?.data?.detail || 'Error') }
  }

  const planCounts = { basic: 0, pro: 0, agency: 0 }
  users.forEach(u => { if (u.is_active && u.plan in planCounts) (planCounts as any)[u.plan]++ })
  const activeCount = users.filter(u => u.is_active).length

  const filtered = users.filter(u => {
    if (filterPlan && u.plan !== filterPlan) return false
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never'

  const inp: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />

      {/* DELETE MODAL */}
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

                {(detail.profile?.bio || detail.profile?.location || detail.profile?.company) && (
                  <div style={{ borderRadius: '12px', border: '1px solid var(--border)', padding: '14px', marginBottom: '14px' }}>
                    {detail.profile.company && <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>{detail.profile.company}</p>}
                    {detail.profile.location && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 6px' }}>{detail.profile.location}</p>}
                    {detail.profile.bio && <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>{detail.profile.bio}</p>}
                    {detail.profile.skills?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
                        {detail.profile.skills.slice(0, 10).map((sk: string) => (
                          <span key={sk} style={{ fontSize: '10.5px', padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-tag)', color: 'var(--text-muted)' }}>{sk}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                  <span>Signed up: {detail.created_at ? new Date(detail.created_at).toLocaleDateString() : '-'}</span>
                  <span>Last login: {detail.last_login ? new Date(detail.last_login).toLocaleDateString() : 'never'}</span>
                  <span>Plan expires: {detail.plan_expires_at ? new Date(detail.plan_expires_at).toLocaleDateString() : '-'}</span>
                  <span>Portfolio projects: {detail.profile?.portfolio_count ?? 0}</span>
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
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>🗑</div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Delete User?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>This action is permanent and cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteUser(deleteConfirm)} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#EF4444,#DC2626)', border: 'none', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', paddingTop: isMobile ? '52px' : 0, overflowX: 'hidden' }}>

        {/* STICKY HEADER */}
        <div style={{ position: 'sticky', top: isMobile ? '52px' : 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>User Management</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>{activeCount} active · {users.length} total</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={exportUsers} title="Download all users as CSV"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', cursor: 'pointer' }}>
              ⬇ {isMobile ? '' : 'Export'}
            </button>
            <button onClick={() => setShowAdd(!showAdd)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '7px 14px' : '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(61,79,224,0.3)' }}>
              + {isMobile ? 'Add' : 'Add User'}
            </button>
          </div>
        </div>

        <div style={{ maxWidth: '960px', margin: '0 auto', padding: isMobile ? '16px' : '24px 32px' }}>

          {/* PLAN STATS — 3 cards always */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: isMobile ? '10px' : '16px', marginBottom: '24px' }}>
            {(['trial','basic','pro','agency'] as const).map(plan => {
              const pm = PLAN_META[plan]
              const count = (planCounts as any)[plan]
              const isActive = filterPlan === plan
              return (
                <div key={plan} onClick={() => setFilterPlan(isActive ? '' : plan)}
                  style={{ borderRadius: '14px', border: `1px solid ${isActive ? pm.color : pm.border}`, background: isActive ? pm.bg : 'var(--bg-card)', padding: isMobile ? '14px 12px' : '18px 20px', cursor: 'pointer', transition: 'all 0.2s', outline: isActive ? `2px solid ${pm.color}40` : 'none', outlineOffset: '2px', position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = pm.color; e.currentTarget.style.transform = 'translateY(-2px)' } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = pm.border; e.currentTarget.style.transform = 'none' } }}>
                  <div style={{ position: 'absolute', top: '-12px', right: '-12px', width: '60px', height: '60px', borderRadius: '50%', background: pm.color, opacity: 0.07, pointerEvents: 'none' }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: isMobile ? '26px' : '32px', fontWeight: 800, color: pm.color, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>{count}</p>
                      <p style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: 600, color: 'var(--text-muted)', margin: '5px 0 0', textTransform: 'capitalize' }}>{plan} Plan</p>
                    </div>
                    <span style={{ fontSize: isMobile ? '20px' : '24px', opacity: 0.5, marginTop: '2px' }}>{pm.icon}</span>
                  </div>
                  {!isMobile && (
                    <div style={{ marginTop: '14px', height: '3px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: pm.color, borderRadius: '999px', width: `${users.length > 0 ? (count / users.length) * 100 : 0}%`, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ADD FORM */}
          {showAdd && (
            <div style={{ borderRadius: '16px', border: '1px solid rgba(61,79,224,0.25)', background: 'rgba(61,79,224,0.04)', padding: isMobile ? '16px' : '22px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(61,79,224,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>➕</span>
                Create New User
              </h3>
              {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '12px', padding: '8px 12px', borderRadius: '8px', marginBottom: '14px' }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                {[
                  { label: 'Full Name', key: 'name', ph: 'John Doe', type: 'text' },
                  { label: 'Email', key: 'email', ph: 'john@studio.com', type: 'email' },
                  { label: 'Password', key: 'password', ph: 'Min 8 chars', type: 'password' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
                    <input value={(addForm as any)[f.key]} onChange={e => setAddForm({ ...addForm, [f.key]: e.target.value })} placeholder={f.ph} type={f.type} style={inp}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(61,79,224,0.5)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
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

          {/* SEARCH + COUNT */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '14px' }}>⌕</span>
              <input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...inp, paddingLeft: '30px' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(61,79,224,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
            </div>
            {(search || filterPlan) && (
              <button onClick={() => { setSearch(''); setFilterPlan('') }}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-input)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ✕ Clear
              </button>
            )}
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{filtered.length} / {users.length}</span>
          </div>

          {/* USER CARDS */}
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ width: '24px', height: '24px', border: '2px solid rgba(61,79,224,0.2)', borderTop: '2px solid #3D4FE0', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
              <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>Loading users...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <p style={{ fontSize: '36px', opacity: 0.15, margin: '0 0 10px' }}>👥</p>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>No users found</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtered.map(u => {
                const pm = PLAN_META[u.plan as keyof typeof PLAN_META] || PLAN_META.basic
                const isEditing = editUser?.id === u.id
                const initials = u.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
                return (
                  <div key={u.id}
                    style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: isMobile ? '14px' : '16px 20px', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(61,79,224,0.2)'; e.currentTarget.style.transform = 'translateX(2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {/* AVATAR */}
                      <div style={{ width: isMobile ? '36px' : '42px', height: isMobile ? '36px' : '42px', borderRadius: '50%', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '12px' : '14px', fontWeight: 800, color: 'white', flexShrink: 0, boxShadow: '0 2px 8px rgba(61,79,224,0.3)' }}>
                        {initials}
                      </div>

                      {/* INFO */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <a href={`/members/${u.id}`}
                            style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text)' }}>{u.name}</a>
                          {u.is_verified && <VerifiedBadge size={13} />}

                          {/* PLAN BADGE */}
                          {isEditing ? (
                            <select value={editUser.plan} onChange={e => setEditUser({ ...editUser, plan: e.target.value })}
                              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', color: 'var(--text)', outline: 'none' }}>
                              <option value="trial">Trial</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="agency">Agency</option>
                            </select>
                          ) : (
                            <span style={{ fontSize: '10px', fontWeight: 700, color: pm.color, background: pm.bg, border: `1px solid ${pm.border}`, padding: '2px 8px', borderRadius: '999px', textTransform: 'capitalize' }}>
                              {pm.icon} {u.plan}
                            </span>
                          )}

                          {/* Which marketplace view this account leads with */}
                          {!isEditing && u.role !== 'admin' && (
                            <span title="Marketplace mode" style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                              {u.account_mode === 'client' ? '💼 hires' : '🎨 takes work'}
                            </span>
                          )}

                          {/* ROLE */}
                          {isEditing ? (
                            <select value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}
                              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', color: 'var(--text)', outline: 'none' }}>
                              <option value="member">Member</option><option value="admin">Admin</option>
                            </select>
                          ) : u.role === 'admin' ? (
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', padding: '2px 8px', borderRadius: '999px' }}>👑 Admin</span>
                          ) : null}

                          {/* STATUS */}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600, color: u.is_active ? '#34D399' : '#F87171' }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: u.is_active ? '#34D399' : '#F87171', boxShadow: u.is_active ? '0 0 5px #34D39970' : 'none', display: 'inline-block' }} />
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>
                          {u.email}
                          {!isMobile && u.last_login && <span style={{ marginLeft: '8px', opacity: 0.6 }}>· Last login: {formatDate(u.last_login)}</span>}
                        </p>
                      </div>

                      {/* ACTIONS */}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {isEditing ? (
                          <>
                            <button onClick={() => updateUser(u.id, { plan: editUser.plan, role: editUser.role })}
                              style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                            <button onClick={() => setEditUser(null)}
                              style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '8px', color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>✕</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openDetail(u.id)}
                              style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', color: '#A78BFA', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', cursor: 'pointer', fontWeight: 600 }}>View</button>
                            <button onClick={() => setEditUser(u)}
                              style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', color: '#60A5FA', background: 'rgba(61,79,224,0.1)', border: '1px solid rgba(61,79,224,0.2)', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                            {/* Reach a member directly rather than only ever
                                seeing them as a row in a table. */}
                            <button onClick={() => messageUser(u.id)} disabled={messagingId === u.id}
                              style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', cursor: 'pointer', fontWeight: 600 }}>
                              {messagingId === u.id ? '…' : (isMobile ? '💬' : '💬 Message')}
                            </button>
                            <button onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                              style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', color: u.is_active ? '#F87171' : '#34D399', background: u.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)', border: `1px solid ${u.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}`, cursor: 'pointer', fontWeight: 600 }}>
                              {u.is_active ? (isMobile ? 'Off' : 'Disable') : (isMobile ? 'On' : 'Enable')}
                            </button>
                            {/* Marketplace is on for everyone by default; this is
                                the per-account kill switch for abuse. */}
                            {u.role !== 'admin' && (
                              <button
                                title={u.marketplace_beta_enabled === false ? 'Marketplace is off for this account' : 'Marketplace is on for this account'}
                                onClick={() => updateUser(u.id, { marketplace_beta_enabled: u.marketplace_beta_enabled === false })}
                                style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
                                  color: u.marketplace_beta_enabled === false ? 'var(--text-dim)' : '#A78BFA',
                                  background: u.marketplace_beta_enabled === false ? 'var(--bg-input)' : 'rgba(139,92,246,0.1)',
                                  border: `1px solid ${u.marketplace_beta_enabled === false ? 'var(--border)' : 'rgba(139,92,246,0.2)'}` }}>
                                {u.marketplace_beta_enabled === false ? '🛒 Off' : '🛒 On'}
                              </button>
                            )}
                            {u.role !== 'admin' && (
                              <button onClick={() => setDeleteConfirm(u.id)}
                                style={{ fontSize: '14px', padding: '5px 8px', borderRadius: '8px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#F87171' }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}>🗑</button>
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
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
