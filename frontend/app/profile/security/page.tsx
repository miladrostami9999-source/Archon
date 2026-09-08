'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import { useIsMobile } from '../../hooks/useIsMobile'
import PublishSection from '../PublishSection'
import { ArrowLeft, Lock, Mail, Check, Crown, User, KeyRound, Copy, Trash2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => localStorage.getItem('archon-token') || ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

const PLAN_META: Record<string, { label: string; desc: string }> = {
  trial:  { label: 'Trial',  desc: '7-day free trial · 10 companies · 10 emails' },
  basic:  { label: 'Basic',  desc: '50 companies · 30 emails/month' },
  pro:    { label: 'Pro',    desc: '500 companies · 300 emails/month · AI Search' },
  agency: { label: 'Agency', desc: 'Unlimited · All features' },
  enterprise: { label: 'Enterprise', desc: 'Unlimited · All features · Data API' },
}

interface UserAccount {
  id: number; name: string; email: string
  role: string; plan: string; created_at: string; last_login: string | null
  google_email?: string | null
  google_connected?: boolean
  account_mode?: string
}

interface FullProfile {
  headline: string; bio: string; location: string; website: string; company: string
  phone: string; skills: string[]; customSkills: string[]; avatar: string
  portfolio: any[]; education: any[]; experience: any[]
}

const defaultProfile: FullProfile = {
  headline: '', bio: '', location: '', website: '', company: '', phone: '',
  skills: [], customSkills: [], avatar: '', portfolio: [], education: [], experience: [],
}

export default function ProfileSecurityPage() {
  const isMobile = useIsMobile()

  const [user, setUser] = useState<UserAccount | null>(null)
  const [profile, setProfile] = useState<FullProfile>(defaultProfile)
  const [contact, setContact] = useState({ company: '', location: '', website: '', phone: '' })
  const [savingContact, setSavingContact] = useState(false)
  const [savedContact, setSavedContact] = useState(false)

  const [pwdForm, setPwdForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [gmailConnecting, setGmailConnecting] = useState(false)
  const [gmailMsg, setGmailMsg] = useState('')
  const [apiKeys, setApiKeys] = useState<{ id: number; key_prefix: string; label: string; created_at: string; last_used_at: string | null; revoked: boolean }[]>([])
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newRawKey, setNewRawKey] = useState('')
  const [apiKeyBusy, setApiKeyBusy] = useState(false)
  const [apiKeyMsg, setApiKeyMsg] = useState('')
  const [dangerMode, setDangerMode] = useState<'' | 'deactivate' | 'delete'>('')
  const [deletePwd, setDeletePwd] = useState('')
  const [dangerErr, setDangerErr] = useState('')
  const [dangerBusy, setDangerBusy] = useState(false)

  useEffect(() => {
    axios.get(`${API}/auth/me`, { headers: headers() })
      .then(res => setUser(res.data))
      .catch(() => { window.location.href = '/login' })

    const params = new URLSearchParams(window.location.search)
    const gmailError = params.get('gmail_error')
    if (gmailError) {
      setGmailMsg(`✗ ${gmailError}`)
      window.history.replaceState({}, '', window.location.pathname)
    }

    axios.get(`${API}/auth/profile/me`, { headers: headers() })
      .then(res => {
        const d = res.data || {}
        const fromServer: FullProfile = {
          headline: d.headline || '', bio: d.bio || '', location: d.location || '', website: d.website || '',
          company: d.company || '', phone: d.phone || '', avatar: d.avatar || '',
          skills: d.skills || [], customSkills: d.customSkills || [],
          portfolio: d.portfolio || [], education: d.education || [], experience: d.experience || [],
        }
        setProfile(fromServer)
        setContact({ company: fromServer.company, location: fromServer.location, website: fromServer.website, phone: fromServer.phone })
      })
      .catch(() => {})
  }, [])

  const loadApiKeys = () => {
    axios.get(`${API}/auth/api-keys`, { headers: headers() }).then(res => setApiKeys(res.data)).catch(() => {})
  }
  useEffect(() => { loadApiKeys() }, [])

  const createApiKey = async () => {
    setApiKeyBusy(true); setApiKeyMsg(''); setNewRawKey('')
    try {
      const res = await axios.post(`${API}/auth/api-keys`, { label: newKeyLabel }, { headers: headers() })
      setNewRawKey(res.data.key)
      setNewKeyLabel('')
      loadApiKeys()
    } catch (e: any) { setApiKeyMsg(e.response?.data?.detail || 'Could not create a key') }
    setApiKeyBusy(false)
  }

  const revokeApiKey = async (id: number) => {
    if (!window.confirm('Revoke this key? Any client using it will stop working immediately.')) return
    try {
      await axios.delete(`${API}/auth/api-keys/${id}`, { headers: headers() })
      loadApiKeys()
    } catch {}
  }

  const saveContact = async () => {
    setSavingContact(true)
    const updated = { ...profile, ...contact }
    try {
      await axios.put(`${API}/auth/profile/me`, {
        headline: updated.headline || '', bio: updated.bio || '',
        location: updated.location || '', website: updated.website || '',
        company: updated.company || '', phone: updated.phone || '',
        avatar: updated.avatar || '', skills: updated.skills || [], customSkills: updated.customSkills || [],
        portfolio: updated.portfolio || [], education: updated.education || [], experience: updated.experience || [],
      }, { headers: headers() })
      setProfile(updated)
      const json = JSON.stringify(updated)
      localStorage.setItem('archon-profile', json)
      window.dispatchEvent(new StorageEvent('storage', { key: 'archon-profile', newValue: json }))
    } catch {}
    setSavingContact(false); setSavedContact(true); setTimeout(() => setSavedContact(false), 2500)
  }

  const changePassword = async () => {
    setPwdError(''); setPwdSuccess(false)
    if (!pwdForm.old_password || !pwdForm.new_password) { setPwdError('All fields required'); return }
    if (pwdForm.new_password !== pwdForm.confirm) { setPwdError('Passwords do not match'); return }
    if (pwdForm.new_password.length < 8) { setPwdError('Min 8 characters'); return }
    try {
      const res = await axios.post(`${API}/auth/change-password`, { old_password: pwdForm.old_password, new_password: pwdForm.new_password }, { headers: headers() })
      // Changing the password invalidates every previously-issued token
      // (server-side), including this tab's. The endpoint returns a fresh one
      // carrying the new session version — store it so we stay signed in.
      if (res.data?.token) localStorage.setItem('archon-token', res.data.token)
      setPwdSuccess(true); setPwdForm({ old_password: '', new_password: '', confirm: '' })
    } catch (e: any) { setPwdError(e.response?.data?.detail || 'Error') }
  }

  const signOutAfter = (msg: string) => {
    alert(msg)
    localStorage.removeItem('archon-token')
    localStorage.removeItem('archon-user')
    localStorage.removeItem('archon-profile')
    window.location.href = '/login'
  }

  const deactivateAccount = async () => {
    setDangerBusy(true); setDangerErr('')
    try {
      await axios.post(`${API}/auth/me/deactivate`, {}, { headers: headers() })
      signOutAfter('Your account has been deactivated. Contact us when you want it back.')
    } catch (e: any) { setDangerErr(e.response?.data?.detail || 'Could not deactivate the account.') }
    setDangerBusy(false)
  }

  const deleteAccount = async () => {
    if (!deletePwd) { setDangerErr('Enter your password to confirm.'); return }
    setDangerBusy(true); setDangerErr('')
    try {
      await axios.post(`${API}/auth/me/delete`, { password: deletePwd }, { headers: headers() })
      signOutAfter('Your account and all of its data have been deleted.')
    } catch (e: any) { setDangerErr(e.response?.data?.detail || 'Could not delete the account.') }
    setDangerBusy(false)
  }

  const connectGmail = async () => {
    setGmailConnecting(true); setGmailMsg('')
    try {
      const res = await axios.get(`${API}/auth/google/authorize`, { headers: headers() })
      window.location.href = res.data.authorize_url
    } catch (e: any) {
      setGmailMsg(`✗ ${e.response?.data?.detail || 'Could not start Gmail connect'}`)
      setGmailConnecting(false)
    }
  }

  const disconnectGmail = async () => {
    setGmailConnecting(true); setGmailMsg('')
    try {
      await axios.post(`${API}/auth/google/disconnect`, {}, { headers: headers() })
      setUser(u => u ? { ...u, google_email: null } : u)
    } catch (e: any) {
      setGmailMsg(`✗ ${e.response?.data?.detail || 'Could not disconnect'}`)
    }
    setGmailConnecting(false)
  }

  const plan = user ? PLAN_META[user.plan] || PLAN_META.basic : null

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

  return (
    <div className="page-enter" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', marginTop: isMobile ? '52px' : 0, minHeight: '100vh' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: isMobile ? '16px' : '32px 40px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <a href="/profile" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ArrowLeft size={14} strokeWidth={1.75} /> Profile</a>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>Security & Account</h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* A public portfolio page is a freelancer concept — a client
                account has no work to showcase, so this doesn't apply. */}
            {user?.account_mode !== 'client' && <PublishSection profile={profile} />}

            {/* PERSONAL INFORMATION — moved here from the main Profile tab */}
            <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
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
                    <input value={(contact as any)[f.key]} onChange={e => setContact(c => ({ ...c, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button onClick={saveContact} disabled={savingContact}
                  style={{ padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', background: savedContact ? '#34D399' : 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {savedContact ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={14} strokeWidth={2} /> Saved!</span> : savingContact ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={15} strokeWidth={1.75} /> Change Password</h2>
              {pwdError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>{pwdError}</div>}
              {pwdSuccess && <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34D399', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} strokeWidth={2} /> Password changed!</div>}
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
                      placeholder={f.ph} style={inputStyle} />
                  </div>
                ))}
                <button onClick={changePassword}
                  style={{ padding: '11px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', cursor: 'pointer' }}>
                  Update Password
                </button>
              </div>
            </div>

            <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={15} strokeWidth={1.75} /> Send emails from Gmail</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
                Connect your own Gmail so outreach sends from your address instead of Archon's shared sender. Send-only access — Archon never reads your inbox.
              </p>
              {user?.google_connected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: '#34D399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={14} strokeWidth={2} /> Connected{user.google_email ? ` as ${user.google_email}` : ''}</span>
                  <button onClick={disconnectGmail} disabled={gmailConnecting}
                    style={{ padding: '8px 16px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, color: '#F87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', cursor: 'pointer', opacity: gmailConnecting ? 0.6 : 1 }}>
                    {gmailConnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <button onClick={connectGmail} disabled={gmailConnecting}
                  style={{ padding: '9px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: gmailConnecting ? 0.6 : 1 }}>
                  {gmailConnecting ? 'Redirecting…' : 'Connect Gmail'}
                </button>
              )}
              {gmailMsg && <p style={{ fontSize: '12.5px', color: '#F87171', margin: '10px 0 0' }}>{gmailMsg}</p>}
            </div>

            {/* Phase 10 item #9: not actively upsold to non-Enterprise
                accounts any more (this used to be a permanent "Upgrade to
                Enterprise →" teaser shown to everyone) — no real demand
                signal for either the Data API or the Enterprise tier yet,
                so we stop investing in promoting them further without
                removing what already exists for accounts that have it. */}
            {user?.plan === 'enterprise' && (
            <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}><KeyRound size={15} strokeWidth={1.75} /> Data API</h2>
                <>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
                    Query the company catalog programmatically. Send the key in an <code>X-API-Key</code> header — never as a URL parameter.
                  </p>

                  <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '16px', fontSize: '11.5px', color: 'var(--text-dim)', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre' }}>
{`curl ${API}/api/v1/companies \\
  -H "X-API-Key: ak_..."`}
                  </div>

                  {newRawKey && (
                    <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '16px' }}>
                      <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#34D399', margin: '0 0 8px' }}>Copy this key now — it won't be shown again.</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <code style={{ fontSize: '12px', color: 'var(--text)', background: 'var(--bg-input)', padding: '6px 10px', borderRadius: '6px', flex: 1, overflowX: 'auto', whiteSpace: 'nowrap' }}>{newRawKey}</code>
                        <button onClick={() => { navigator.clipboard.writeText(newRawKey) }}
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                          <Copy size={14} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <input value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)} placeholder="Label (optional, e.g. CRM sync)"
                      style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={createApiKey} disabled={apiKeyBusy}
                      style={{ padding: '9px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: apiKeyBusy ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                      {apiKeyBusy ? 'Creating…' : 'Generate new key'}
                    </button>
                  </div>
                  {apiKeyMsg && <p style={{ fontSize: '12.5px', color: '#F87171', margin: '0 0 12px' }}>{apiKeyMsg}</p>}

                  {apiKeys.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {apiKeys.map(k => (
                        <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', opacity: k.revoked ? 0.5 : 1 }}>
                          <div style={{ minWidth: 0 }}>
                            <span className="mono" style={{ fontSize: '12.5px', color: 'var(--text)' }}>{k.key_prefix}…</span>
                            {k.label && <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '8px' }}>{k.label}</span>}
                            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>
                              {k.revoked ? 'Revoked' : k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}
                            </p>
                          </div>
                          {!k.revoked && (
                            <button onClick={() => revokeApiKey(k.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', display: 'flex', flexShrink: 0 }}>
                              <Trash2 size={15} strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
            </div>
            )}

            <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>Account Information</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Member since', value: user ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
                  { label: 'Last login', value: user?.last_login ? new Date(user.last_login).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'First session' },
                  { label: 'Account ID', value: `#${user?.id || '—'}` },
                  { label: 'Role', value: user?.role === 'admin' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Crown size={13} strokeWidth={1.75} /> Administrator</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><User size={13} strokeWidth={1.75} /> Member</span> },
                  { label: 'Plan', value: user ? `${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} — ${plan?.desc}` : '—' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-input)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* DANGER ZONE — admins are excluded server-side too */}
            {user?.role !== 'admin' && (
              <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.04)', padding: '24px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#F87171', margin: '0 0 6px' }}>Danger zone</h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
                  Deactivating pauses your account and keeps your data — contact us to reopen it. Deleting removes your account and all of your pipeline data permanently.
                </p>

                {dangerErr && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '12.5px', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px' }}>
                    {dangerErr}
                  </div>
                )}

                {dangerMode === '' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={() => { setDangerMode('deactivate'); setDangerErr('') }}
                      style={{ padding: '10px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      Deactivate account
                    </button>
                    <button onClick={() => { setDangerMode('delete'); setDangerErr('') }}
                      style={{ padding: '10px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: '#F87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', cursor: 'pointer' }}>
                      Delete account
                    </button>
                  </div>
                )}

                {dangerMode === 'deactivate' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text)' }}>Deactivate your account and sign out?</span>
                    <button onClick={deactivateAccount} disabled={dangerBusy}
                      style={{ padding: '9px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: '#F59E0B', border: 'none', cursor: 'pointer', opacity: dangerBusy ? 0.6 : 1 }}>
                      {dangerBusy ? 'Working…' : 'Yes, deactivate'}
                    </button>
                    <button onClick={() => setDangerMode('')}
                      style={{ padding: '9px 16px', borderRadius: '9px', fontSize: '13px', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}

                {dangerMode === 'delete' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '360px' }}>
                    <label style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Enter your password to confirm permanent deletion</label>
                    <input type="password" value={deletePwd} onChange={e => setDeletePwd(e.target.value)} placeholder="Your password" style={inputStyle} />
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={deleteAccount} disabled={dangerBusy}
                        style={{ padding: '10px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: '#EF4444', border: 'none', cursor: 'pointer', opacity: dangerBusy ? 0.6 : 1 }}>
                        {dangerBusy ? 'Deleting…' : 'Permanently delete'}
                      </button>
                      <button onClick={() => { setDangerMode(''); setDeletePwd('') }}
                        style={{ padding: '10px 16px', borderRadius: '9px', fontSize: '13px', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
