'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'

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
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', plan: 'basic' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [filterPlan, setFilterPlan] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
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

  const filtered = users.filter(u => {
    if (filterPlan && u.plan !== filterPlan) return false
    if (filterStatus === 'active' && !u.is_active) return false
    if (filterStatus === 'inactive' && u.is_active) return false
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const planCounts = { basic: 0, pro: 0, agency: 0 }
  users.forEach(u => { if (u.is_active && u.plan in planCounts) (planCounts as any)[u.plan]++ })

  const formatDate = (d: string | null) => {
    if (!d) return 'Never'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '9px 12px',
    fontSize: '13px', color: 'var(--text)', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      {/* DELETE MODAL */}
      {deleteConfirm !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '28px 24px', maxWidth: '340px', width: '100%', margin: '0 16px', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>🗑</div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>Delete User?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 24px' }}>This action cannot be undone. All user data will be permanently removed.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteUser(deleteConfirm)} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #EF4444, #DC2626)', border: 'none', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, marginLeft: '224px' }}>
        {/* STICKY HEADER */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', transition: 'background 0.25s' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>User Management</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>{users.length} registered users</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
            + Add User
          </button>
        </div>

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 32px' }}>

          {/* PLAN STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {(['basic', 'pro', 'agency'] as const).map(plan => {
              const pm = PLAN_META[plan]
              return (
                <div key={plan} style={{
                  borderRadius: '14px', border: `1px solid ${pm.border}`,
                  background: pm.bg, padding: '18px 20px',
                  cursor: 'pointer', transition: 'all 0.15s',
                  outline: filterPlan === plan ? `2px solid ${pm.color}` : 'none',
                }}
                  onClick={() => setFilterPlan(filterPlan === plan ? '' : plan)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '28px', fontWeight: 800, color: pm.color, margin: '0 0 4px' }}>{(planCounts as any)[plan]}</p>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', margin: 0, textTransform: 'capitalize' }}>{plan} Plan</p>
                    </div>
                    <div style={{ fontSize: '28px', opacity: 0.4 }}>{pm.icon}</div>
                  </div>
                  <div style={{ marginTop: '12px', height: '4px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: pm.color, borderRadius: '999px', width: `${users.length > 0 ? ((planCounts as any)[plan] / users.length) * 100 : 0}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* ADD FORM */}
          {showAdd && (
            <div style={{ borderRadius: '16px', border: '1px solid rgba(79,123,247,0.2)', background: 'rgba(79,123,247,0.04)', padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>➕</span> Create New User
              </h3>
              {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Full Name', key: 'name', placeholder: 'John Doe', type: 'text' },
                  { label: 'Email', key: 'email', placeholder: 'john@studio.com', type: 'email' },
                  { label: 'Password', key: 'password', placeholder: 'Min 8 chars', type: 'password' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</label>
                    <input value={(addForm as any)[f.key]} onChange={e => setAddForm({ ...addForm, [f.key]: e.target.value })}
                      placeholder={f.placeholder} type={f.type} style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plan</label>
                  <select value={addForm.plan} onChange={e => setAddForm({ ...addForm, plan: e.target.value })} style={inputStyle}>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="agency">Agency</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowAdd(false); setError('') }} style={{ padding: '9px 18px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-muted)', background: 'var(--bg-input)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={createUser} disabled={saving} style={{ padding: '9px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </div>
          )}

          {/* FILTERS */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '14px' }}>⌕</span>
              <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '32px' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.4)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ ...inputStyle, width: 'auto', paddingRight: '32px' }}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {(filterPlan || filterStatus || search) && (
              <button onClick={() => { setFilterPlan(''); setFilterStatus(''); setSearch('') }}
                style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-muted)', background: 'var(--bg-input)', cursor: 'pointer' }}>
                Clear ✕
              </button>
            )}
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: 'auto' }}>{filtered.length} of {users.length}</p>
          </div>

          {/* USERS TABLE */}
          <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', overflow: 'hidden' }}>
            {/* TABLE HEADER */}
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1.2fr 1fr 160px', gap: '0', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
              {['User', 'Plan', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                <p key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{h}</p>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ width: '24px', height: '24px', border: '2px solid rgba(79,123,247,0.3)', borderTop: '2px solid #4F7BF7', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>Loading users...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <p style={{ fontSize: '32px', opacity: 0.2, margin: '0 0 8px' }}>👥</p>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>No users found</p>
              </div>
            ) : filtered.map((u, i) => {
              const pm = PLAN_META[u.plan] || PLAN_META.basic
              const isEditing = editUser?.id === u.id
              const initials = u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
              return (
                <div key={u.id} style={{
                  display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1.2fr 1fr 160px',
                  gap: '0', padding: '14px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: 'center', transition: 'background 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>

                  {/* USER */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{u.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{u.email}</p>
                    </div>
                  </div>

                  {/* PLAN */}
                  {isEditing ? (
                    <select value={editUser.plan} onChange={e => setEditUser({ ...editUser, plan: e.target.value })}
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', color: 'var(--text)', outline: 'none', width: '90px' }}>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="agency">Agency</option>
                    </select>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: pm.color, background: pm.bg, border: `1px solid ${pm.border}`, padding: '3px 10px', borderRadius: '999px', textTransform: 'capitalize' }}>
                      {pm.icon} {u.plan}
                    </span>
                  )}

                  {/* ROLE */}
                  {isEditing ? (
                    <select value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', color: 'var(--text)', outline: 'none', width: '90px' }}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: '12px', fontWeight: 500, color: u.role === 'admin' ? '#FBBF24' : 'var(--text-muted)', background: u.role === 'admin' ? 'rgba(251,191,36,0.1)' : 'transparent', padding: u.role === 'admin' ? '2px 8px' : '0', borderRadius: '999px', textTransform: 'capitalize' }}>
                      {u.role === 'admin' ? '👑 Admin' : 'Member'}
                    </span>
                  )}

                  {/* STATUS */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: u.is_active ? '#34D399' : '#F87171', boxShadow: u.is_active ? '0 0 6px #34D39980' : 'none' }} />
                    <span style={{ fontSize: '12px', color: u.is_active ? '#34D399' : '#F87171', fontWeight: 500 }}>{u.is_active ? 'Active' : 'Inactive'}</span>
                  </div>

                  {/* LAST LOGIN */}
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>{formatDate(u.last_login)}</p>

                  {/* ACTIONS */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {isEditing ? (
                      <>
                        <button onClick={() => updateUser(u.id, { plan: editUser.plan, role: editUser.role })}
                          style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', cursor: 'pointer', fontWeight: 600 }}>
                          Save
                        </button>
                        <button onClick={() => setEditUser(null)}
                          style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditUser(u)}
                          style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', color: '#60A5FA', background: 'rgba(79,123,247,0.1)', border: '1px solid rgba(79,123,247,0.2)', cursor: 'pointer', fontWeight: 500 }}>
                          Edit
                        </button>
                        <button onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                          style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', color: u.is_active ? '#F87171' : '#34D399', background: u.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)', border: `1px solid ${u.is_active ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.15)'}`, cursor: 'pointer', fontWeight: 500 }}>
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        {u.role !== 'admin' && (
                          <button onClick={() => setDeleteConfirm(u.id)}
                            style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', color: '#F87171', background: 'none', border: 'none', cursor: 'pointer' }}
                            title="Delete user">
                            🗑
                          </button>
                        )}
                      </>
                    )}
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
