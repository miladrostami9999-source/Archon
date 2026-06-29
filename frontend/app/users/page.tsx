'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'

const API = 'http://localhost:8000'
const getToken = () => localStorage.getItem('archon-token') || ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

const PLAN_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  basic:  { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)', icon: '◈' },
  pro:    { color: '#60A5FA', bg: 'rgba(79,123,247,0.1)',  border: 'rgba(79,123,247,0.2)',  icon: '⭐' },
  agency: { color: '#A78BFA', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)', icon: '🏆' },
}

interface User {
  id: number; name: string; email: string
  role: string; plan: string; is_active: boolean
  created_at: string; last_login: string | null
}

export default function UsersPage() {
  const isMobile = useIsMobile()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', plan: 'basic' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/auth/users`, { headers: headers() })
      setUsers(res.data)
    } catch (e: any) {
      if (e.response?.status === 403) window.location.href = '/'
    }
    setLoading(false)
  }
  useEffect(() => { fetchUsers() }, [])

  const createUser = async () => {
    if (!addForm.name || !addForm.email || !addForm.password) { setError('All fields required'); return }
    setSaving(true); setError('')
    try {
      await axios.post(`${API}/auth/users`, addForm, { headers: headers() })
      setAddForm({ name: '', email: '', password: '', plan: 'basic' })
      setShowAdd(false); fetchUsers()
    } catch (e: any) { setError(e.response?.data?.detail || 'Error') }
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

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  )

  const planCounts = { basic: 0, pro: 0, agency: 0 }
  users.forEach(u => { if (u.is_active && u.plan in planCounts) (planCounts as any)[u.plan]++ })

  const formatDate = (d: string | null) => {
    if (!d) return 'Never'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const inp: React.CSSProperties = {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '9px 12px', fontSize: '13px',
    color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />

      {/* DELETE MODAL */}
      {deleteConfirm !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '28px 24px', maxWidth: '320px', width: 'calc(100% - 32px)', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🗑</div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>Delete User?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '9px', borderRadius: '8px', fontSize: '13px', color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteUser(deleteConfirm)} style={{ flex: 1, padding: '9px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'white', background: '#EF4444', border: 'none', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', paddingTop: isMobile ? '52px' : 0, overflowX: 'hidden' }}>

        {/* HEADER */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>User Management</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>{users.length} users</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer' }}>
            + {isMobile ? 'Add' : 'Add User'}
          </button>
        </div>

        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '14px' : '24px 32px' }}>

          {/* PLAN STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '8px' : '14px', marginBottom: '20px' }}>
            {(['basic', 'pro', 'agency'] as const).map(plan => {
              const pm = PLAN_META[plan]
              const count = (planCounts as any)[plan]
              return (
                <div key={plan} style={{ borderRadius: '12px', border: `1px solid ${pm.border}`, background: pm.bg, padding: isMobile ? '12px' : '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: 800, color: pm.color, margin: 0, lineHeight: 1 }}>{count}</p>
                    <p style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-muted)', margin: '4px 0 0', textTransform: 'capitalize', fontWeight: 500 }}>{plan}</p>
                  </div>
                  <span style={{ fontSize: isMobile ? '22px' : '26px', opacity: 0.5 }}>{pm.icon}</span>
                </div>
              )
            })}
          </div>

          {/* ADD FORM */}
          {showAdd && (
            <div style={{ borderRadius: '14px', border: '1px solid rgba(79,123,247,0.2)', background: 'rgba(79,123,247,0.04)', padding: '18px', marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 14px' }}>➕ New User</p>
              {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', fontSize: '12px', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px' }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                {[
                  { label: 'Name', key: 'name', ph: 'Full name', type: 'text' },
                  { label: 'Email', key: 'email', ph: 'email@studio.com', type: 'email' },
                  { label: 'Password', key: 'password', ph: 'Min 8 chars', type: 'password' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</label>
                    <input value={(addForm as any)[f.key]} onChange={e => setAddForm({ ...addForm, [f.key]: e.target.value })} placeholder={f.ph} type={f.type} style={inp} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plan</label>
                  <select value={addForm.plan} onChange={e => setAddForm({ ...addForm, plan: e.target.value })} style={inp}>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="agency">Agency</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowAdd(false); setError('') }} style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-input)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={createUser} disabled={saving} style={{ padding: '7px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: 'white', background: '#4F7BF7', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* SEARCH */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '13px' }}>⌕</span>
              <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...inp, paddingLeft: '28px' }} />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: 'auto' }}>{filtered.length}/{users.length}</p>
          </div>

          {/* USER LIST */}
          <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', overflow: 'hidden' }}>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ width: '20px', height: '20px', border: '2px solid rgba(79,123,247,0.3)', borderTop: '2px solid #4F7BF7', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>Loading...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>No users found</p>
              </div>
            ) : filtered.map((u, i) => {
              const pm = PLAN_META[u.plan] || PLAN_META.basic
              const isEditing = editUser?.id === u.id
              const initials = u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
              return (
                <div key={u.id} style={{ padding: isMobile ? '12px 14px' : '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>

                  {/* ROW */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

                    {/* AVATAR */}
                    <div style={{ width: isMobile ? '32px' : '38px', height: isMobile ? '32px' : '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '11px' : '13px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {initials}
                    </div>

                    {/* INFO */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{u.name}</p>
                        {/* PLAN BADGE */}
                        {isEditing ? (
                          <select value={editUser.plan} onChange={e => setEditUser({ ...editUser, plan: e.target.value })}
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', color: 'var(--text)', outline: 'none' }}>
                            <option value="basic">Basic</option>
                            <option value="pro">Pro</option>
                            <option value="agency">Agency</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: pm.color, background: pm.bg, border: `1px solid ${pm.border}`, padding: '2px 7px', borderRadius: '999px', textTransform: 'capitalize' }}>
                            {pm.icon} {u.plan}
                          </span>
                        )}
                        {/* ROLE */}
                        {isEditing ? (
                          <select value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', color: 'var(--text)', outline: 'none' }}>
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : u.role === 'admin' ? (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '2px 7px', borderRadius: '999px' }}>👑 Admin</span>
                        ) : null}
                        {/* STATUS DOT */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.is_active ? '#34D399' : '#F87171', boxShadow: u.is_active ? '0 0 5px #34D39960' : 'none' }} />
                          <span style={{ fontSize: '10px', color: u.is_active ? '#34D399' : '#F87171', fontWeight: 500 }}>{u.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>
                        {u.email}{!isMobile && u.last_login ? ` · Last: ${formatDate(u.last_login)}` : ''}
                      </p>
                    </div>

                    {/* ACTIONS */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      {isEditing ? (
                        <>
                          <button onClick={() => updateUser(u.id, { plan: editUser.plan, role: editUser.role })}
                            style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                          <button onClick={() => setEditUser(null)}
                            style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>✕</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditUser(u)}
                            style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', color: '#60A5FA', background: 'rgba(79,123,247,0.1)', border: '1px solid rgba(79,123,247,0.2)', cursor: 'pointer' }}>Edit</button>
                          <button onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                            style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', color: u.is_active ? '#F87171' : '#34D399', background: u.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)', border: `1px solid ${u.is_active ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.15)'}`, cursor: 'pointer' }}>
                            {u.is_active ? (isMobile ? 'Off' : 'Disable') : (isMobile ? 'On' : 'Enable')}
                          </button>
                          {u.role !== 'admin' && (
                            <button onClick={() => setDeleteConfirm(u.id)}
                              style={{ fontSize: '13px', padding: '4px 6px', borderRadius: '6px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
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
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
