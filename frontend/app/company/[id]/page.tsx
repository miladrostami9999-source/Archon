'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'

const API = 'http://localhost:8000'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new:      { bg: 'rgba(79,123,247,0.15)',  text: '#60A5FA' },
  reviewed: { bg: 'rgba(139,92,246,0.15)',  text: '#A78BFA' },
  ready:    { bg: 'rgba(245,158,11,0.15)',  text: '#FCD34D' },
  sent:     { bg: 'rgba(249,115,22,0.15)',  text: '#FB923C' },
  waiting:  { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF' },
  replied:  { bg: 'rgba(52,211,153,0.15)',  text: '#34D399' },
  meeting:  { bg: 'rgba(20,184,166,0.15)',  text: '#2DD4BF' },
  client:   { bg: 'rgba(34,197,94,0.15)',   text: '#4ADE80' },
  archive:  { bg: 'rgba(239,68,68,0.15)',   text: '#F87171' },
}

const CAMPAIGN_STATUS: Record<string, { bg: string; text: string }> = {
  draft:   { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF' },
  sent:    { bg: 'rgba(249,115,22,0.15)',  text: '#FB923C' },
  replied: { bg: 'rgba(52,211,153,0.15)',  text: '#34D399' },
}

const HEAT: Record<string, string> = { hot: '🔥 Hot', warm: '🌤 Warm', cold: '❄️ Cold' }

interface Company {
  id: number; name: string; domain: string; website: string; email: string
  country: string; city: string; industry: string; company_size: string
  instagram: string; linkedin: string; ai_summary: string
  opportunity_score: number; heat_level: string; status: string
  is_favorite: boolean; tags: string
}
interface Contact { id: number; full_name: string; role: string; email: string; linkedin: string; is_primary: boolean }
interface Note { id: number; content: string; language: string; pinned: boolean; created_at: string }
interface HistoryItem { id: number; event_type: string; description: string; created_at: string }
interface EmailDraft { subject: string; body: string }
interface Campaign { id: number; subject: string; body: string; tone: string; status: string; sent_at: string | null; replied_at: string | null; created_at: string }

const card: React.CSSProperties = {
  borderRadius: '12px', border: '1px solid var(--border)',
  background: 'var(--bg-card)', padding: '20px',
  transition: 'background 0.25s, border-color 0.25s',
}

export default function CompanyDetail() {
  const { id } = useParams()
  const [company, setCompany] = useState<Company | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'history' | 'email' | 'emails'>('overview')
  const [newNote, setNewNote] = useState('')
  const [noteLang, setNoteLang] = useState('en')
  const [savingNote, setSavingNote] = useState(false)
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null)
  const [emailTone, setEmailTone] = useState('friendly')
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expandedCampaign, setExpandedCampaign] = useState<number | null>(null)
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({ full_name: '', role: '', email: '', linkedin: '', is_primary: false })
  const [savingContact, setSavingContact] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchCompany = async () => {
    try { const res = await axios.get(`${API}/companies/${id}`); setCompany(res.data) }
    catch { window.location.href = '/' }
    setLoading(false)
  }
  const fetchContacts = async () => { try { const res = await axios.get(`${API}/companies/${id}/contacts`); setContacts(res.data) } catch {} }
  const fetchNotes = async () => { try { const res = await axios.get(`${API}/companies/${id}/notes`); setNotes(res.data) } catch {} }
  const fetchHistory = async () => { try { const res = await axios.get(`${API}/companies/${id}/history`); setHistory(res.data) } catch {} }
  const fetchCampaigns = async () => { try { const res = await axios.get(`${API}/companies/${id}/campaigns`); setCampaigns(res.data) } catch {} }

  useEffect(() => { fetchCompany(); fetchContacts(); fetchNotes(); fetchHistory(); fetchCampaigns() }, [id])

  const updateStatus = async (status: string) => { await axios.patch(`${API}/companies/${id}/status?status=${status}`); fetchCompany() }
  const toggleFavorite = async () => { await axios.patch(`${API}/companies/${id}/favorite`); fetchCompany() }
  const deleteCompany = async () => {
    setDeleting(true)
    try { await axios.delete(`${API}/companies/${id}`); window.location.href = '/' }
    catch { setDeleting(false); setShowDeleteModal(false) }
  }
  const saveNote = async () => {
    if (!newNote.trim()) return
    setSavingNote(true)
    try { await axios.post(`${API}/companies/${id}/notes`, { content: newNote, language: noteLang, pinned: false }); setNewNote(''); fetchNotes() }
    catch {}
    setSavingNote(false)
  }
  const togglePin = async (noteId: number, pinned: boolean) => { await axios.patch(`${API}/companies/${id}/notes/${noteId}`, { pinned: !pinned }); fetchNotes() }
  const saveContact = async () => {
    if (!newContact.full_name.trim()) return
    setSavingContact(true)
    try { await axios.post(`${API}/companies/${id}/contacts`, newContact); setNewContact({ full_name: '', role: '', email: '', linkedin: '', is_primary: false }); setShowAddContact(false); fetchContacts() }
    catch {}
    setSavingContact(false)
  }
  const deleteContact = async (contactId: number) => { await axios.delete(`${API}/companies/${id}/contacts/${contactId}`); fetchContacts() }
  const generateEmail = async () => {
    setGeneratingEmail(true); setEmailDraft(null)
    try { const res = await axios.post(`${API}/companies/${id}/generate-email`, { tone: emailTone }); setEmailDraft(res.data); fetchCampaigns() }
    catch { alert('Error generating email. Check API key.') }
    setGeneratingEmail(false)
  }
  const generateSummary = async () => {
    setGeneratingSummary(true)
    try { const res = await axios.post(`${API}/companies/${id}/generate-summary`); setCompany(prev => prev ? { ...prev, ai_summary: res.data.summary } : prev) }
    catch { alert('Error generating summary.') }
    setGeneratingSummary(false)
  }
  const copyAndOpenGmail = () => {
    if (!emailDraft) return
    navigator.clipboard.writeText(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    window.open('https://mail.google.com/mail/u/0/#compose', '_blank')
  }
  const updateCampaignStatus = async (campaignId: number, status: string) => {
    await axios.patch(`${API}/companies/${id}/campaigns/${campaignId}?status=${status}`)
    fetchCampaigns(); fetchHistory()
  }
  const getScoreColor = (s: number) => s >= 80 ? '#34D399' : s >= 60 ? '#FBBF24' : '#64748B'
  const getInitials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '224px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid rgba(79,123,247,0.3)', borderTop: '2px solid #4F7BF7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    </div>
  )
  if (!company) return null

  const sc = STATUS_COLORS[company.status] || STATUS_COLORS.new

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ ...card, maxWidth: '360px', width: '100%', margin: '0 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <span style={{ fontSize: '24px' }}>🗑</span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Delete Company?</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                <strong>{company.name}</strong> و همه اطلاعات آن برای همیشه حذف می‌شود.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowDeleteModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={deleteCompany} disabled={deleting}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 500, color: 'white', background: '#EF4444', border: 'none', cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div style={{ flex: 1, marginLeft: '224px', display: 'flex', flexDirection: 'column' }}>

        {/* TOP BAR */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '0 24px', height: '56px',
          background: 'var(--bg-main)', borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)', transition: 'background 0.25s, border-color 0.25s',
        }}>
          <button onClick={() => window.location.href = '/'}
            style={{ fontSize: '14px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s', padding: '4px 8px', borderRadius: '6px' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
            ← Back
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowDeleteModal(true)}
            style={{ fontSize: '12px', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', cursor: 'pointer', transition: 'all 0.15s' }}>
            🗑 Delete
          </button>
          <button onClick={toggleFavorite}
            style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: company.is_favorite ? '#FBBF24' : 'var(--text-dim)', transition: 'color 0.15s' }}>
            ★
          </button>
          <select value={company.status} onChange={e => updateStatus(e.target.value)}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '999px', fontWeight: 500, cursor: 'pointer', border: 'none', outline: 'none', background: sc.bg, color: sc.text }}>
            {Object.keys(STATUS_COLORS).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <button onClick={() => setActiveTab('email')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer' }}>
            ✉ Generate Email
          </button>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, padding: '24px', maxWidth: '800px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>

          {/* COMPANY CARD */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              {/* AVATAR */}
              <div style={{
                width: '56px', height: '56px', borderRadius: '12px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 700, color: '#7BAEF7',
                background: 'linear-gradient(135deg, rgba(79,123,247,0.2), rgba(124,58,237,0.2))',
                border: '1px solid rgba(79,123,247,0.15)',
              }}>
                {getInitials(company.name)}
              </div>

              {/* INFO */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>{company.name}</h1>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: '0 0 8px' }}>
                  {[company.country, company.city, company.industry, company.company_size].filter(Boolean).join(' · ')}
                </p>
                {company.ai_summary ? (
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 4px' }}>{company.ai_summary}</p>
                    <button onClick={generateSummary} disabled={generatingSummary}
                      style={{ fontSize: '12px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.15s', opacity: generatingSummary ? 0.4 : 1 }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}>
                      {generatingSummary ? '⏳ Regenerating...' : '↻ Regenerate Summary'}
                    </button>
                  </div>
                ) : (
                  <button onClick={generateSummary} disabled={generatingSummary}
                    style={{ fontSize: '12px', color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: generatingSummary ? 0.4 : 1 }}>
                    {generatingSummary ? '⏳ Generating...' : '✨ Generate AI Summary'}
                  </button>
                )}
              </div>

              {/* SCORE + EDIT */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                  <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="28" cy="28" r="22" fill="none" stroke="var(--border)" strokeWidth="4"/>
                    <circle cx="28" cy="28" r="22" fill="none" stroke={getScoreColor(company.opportunity_score)} strokeWidth="4"
                      strokeDasharray={`${company.opportunity_score} 100`} strokeLinecap="round"
                      style={{ filter: `drop-shadow(0 0 6px ${getScoreColor(company.opportunity_score)}60)` }}/>
                  </svg>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: getScoreColor(company.opportunity_score) }}>
                    {Math.round(company.opportunity_score)}
                  </span>
                </div>
                <button onClick={() => window.location.href = `/edit?id=${id}`}
                  style={{ fontSize: '12px', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '8px', background: 'var(--bg-input)', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA'; e.currentTarget.style.borderColor = 'rgba(79,123,247,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                  ✏️ Edit
                </button>
              </div>
            </div>

            {/* CONTACT INFO */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              {company.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span>✉</span>
                  <a href={`mailto:${company.email}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                    {company.email}
                  </a>
                </div>
              )}
              {company.website && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span>🌐</span>
                  <a href={company.website} target="_blank" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                    {company.domain || company.website}
                  </a>
                </div>
              )}
              {company.linkedin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span>💼</span>
                  <a href={company.linkedin} target="_blank" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                    LinkedIn
                  </a>
                </div>
              )}
              {company.instagram && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span>📸</span>
                  <a href={company.instagram} target="_blank" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                    Instagram
                  </a>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span>🌡</span>
                <span>{HEAT[company.heat_level] || '❄️ Cold'}</span>
              </div>
              {company.tags && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span>🏷</span>
                  {company.tags.split(',').map(tag => (
                    <span key={tag} style={{ fontSize: '11px', background: 'var(--bg-tag)', color: 'var(--text-dim)', padding: '2px 8px', borderRadius: '999px' }}>{tag.trim()}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TABS */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', overflowX: 'auto' }}>
            {(['overview', 'notes', 'history', 'email', 'emails'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '8px', fontSize: '12px', fontWeight: 500,
                  borderRadius: '8px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  background: activeTab === tab ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'transparent',
                  color: activeTab === tab ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (activeTab !== tab) e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { if (activeTab !== tab) e.currentTarget.style.color = 'var(--text-muted)' }}>
                {tab === 'overview' ? '📋 Overview'
                  : tab === 'notes' ? `📝 Notes${notes.length > 0 ? ` (${notes.length})` : ''}`
                  : tab === 'history' ? '📅 History'
                  : tab === 'email' ? '✉ Generate'
                  : `📧 Emails (${campaigns.length})`}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', margin: 0 }}>Key Contacts</h2>
                <button onClick={() => setShowAddContact(!showAddContact)}
                  style={{ fontSize: '12px', color: '#60A5FA', border: '1px solid rgba(79,123,247,0.25)', padding: '6px 12px', borderRadius: '8px', background: 'rgba(79,123,247,0.08)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  + Add Contact
                </button>
              </div>

              {showAddContact && (
                <div style={{ background: 'var(--bg-input)', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <input placeholder="Full Name *" value={newContact.full_name}
                      onChange={e => setNewContact({ ...newContact, full_name: e.target.value })}
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text)', outline: 'none' }} />
                    <input placeholder="Role (CEO, Founder...)" value={newContact.role}
                      onChange={e => setNewContact({ ...newContact, role: e.target.value })}
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text)', outline: 'none' }} />
                    <input placeholder="Email" value={newContact.email}
                      onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text)', outline: 'none' }} />
                    <input placeholder="LinkedIn URL" value={newContact.linkedin}
                      onChange={e => setNewContact({ ...newContact, linkedin: e.target.value })}
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text)', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={newContact.is_primary}
                        onChange={e => setNewContact({ ...newContact, is_primary: e.target.checked })} />
                      Primary contact
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setShowAddContact(false)}
                        style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)', background: 'var(--bg-card)', cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button onClick={saveContact} disabled={savingContact || !newContact.full_name.trim()}
                        style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', color: 'white', background: '#4F7BF7', border: 'none', cursor: 'pointer', opacity: (savingContact || !newContact.full_name.trim()) ? 0.4 : 1 }}>
                        {savingContact ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {contacts.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--text-dim)', textAlign: 'center', padding: '24px 0', margin: 0 }}>No contacts yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {contacts.map(contact => (
                    <div key={contact.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px', borderRadius: '10px',
                      border: `1px solid ${contact.is_primary ? 'rgba(79,123,247,0.25)' : 'var(--border)'}`,
                      background: contact.is_primary ? 'rgba(79,123,247,0.06)' : 'var(--bg-input)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tag)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {contact.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', margin: 0 }}>{contact.full_name}</p>
                            {contact.is_primary && <span style={{ fontSize: '10px', background: 'rgba(79,123,247,0.15)', color: '#60A5FA', padding: '2px 6px', borderRadius: '4px' }}>Primary</span>}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{contact.role}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {contact.email && <a href={`mailto:${contact.email}`} style={{ fontSize: '12px', color: 'var(--text-dim)', textDecoration: 'none', transition: 'color 0.15s' }} onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}>✉</a>}
                        {contact.linkedin && <a href={contact.linkedin} target="_blank" style={{ fontSize: '12px', color: 'var(--text-dim)', textDecoration: 'none', transition: 'color 0.15s' }} onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}>💼</a>}
                        <button onClick={() => deleteContact(contact.id)}
                          style={{ fontSize: '12px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#F87171' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NOTES */}
          {activeTab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={card}>
                <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                  placeholder="Add a note... (English or فارسی)" rows={3}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', color: 'var(--text)', resize: 'none', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <select value={noteLang} onChange={e => setNoteLang(e.target.value)}
                    style={{ fontSize: '12px', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 8px', background: 'var(--bg-input)', color: 'var(--text)', outline: 'none' }}>
                    <option value="en">English</option>
                    <option value="fa">فارسی</option>
                  </select>
                  <button onClick={saveNote} disabled={savingNote || !newNote.trim()}
                    style={{ fontSize: '12px', padding: '6px 16px', borderRadius: '8px', color: 'white', background: '#4F7BF7', border: 'none', cursor: 'pointer', opacity: (savingNote || !newNote.trim()) ? 0.4 : 1 }}>
                    {savingNote ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
              </div>
              {notes.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--text-dim)', textAlign: 'center', padding: '32px 0' }}>No notes yet</p>
              ) : (
                notes.map(note => (
                  <div key={note.id} style={{ ...card, borderColor: note.pinned ? 'rgba(251,191,36,0.3)' : 'var(--border)', background: note.pinned ? 'rgba(251,191,36,0.04)' : 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <p style={{ fontSize: '14px', color: 'var(--text)', flex: 1, margin: 0, lineHeight: 1.6 }}>{note.content}</p>
                      <button onClick={() => togglePin(note.id, note.pinned)}
                        style={{ fontSize: '14px', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', opacity: note.pinned ? 1 : 0.3, transition: 'opacity 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = note.pinned ? '1' : '0.3' }}>
                        📌
                      </button>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '8px 0 0' }}>{new Date(note.created_at).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* HISTORY */}
          {activeTab === 'history' && (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              {history.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--text-dim)', textAlign: 'center', padding: '32px 0', margin: 0 }}>No history yet</p>
              ) : (
                history.map((item, i) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 20px', borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4F7BF7', flexShrink: 0, marginTop: '6px' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', color: 'var(--text)', margin: '0 0 4px' }}>{item.description}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* EMAIL GENERATOR */}
          {activeTab === 'email' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={card}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', margin: '0 0 12px' }}>Email Tone</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['friendly', 'formal', 'brief', 'storytelling'].map(tone => (
                    <button key={tone} onClick={() => setEmailTone(tone)}
                      style={{
                        fontSize: '12px', padding: '8px 16px', borderRadius: '8px', fontWeight: 500,
                        border: emailTone === tone ? 'none' : '1px solid var(--border)',
                        background: emailTone === tone ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'var(--bg-input)',
                        color: emailTone === tone ? 'white' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {tone === 'friendly' ? '😊 Friendly' : tone === 'formal' ? '💼 Formal' : tone === 'brief' ? '⚡ Brief' : '📖 Storytelling'}
                    </button>
                  ))}
                </div>
                <button onClick={generateEmail} disabled={generatingEmail}
                  style={{ width: '100%', marginTop: '16px', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: 'pointer', opacity: generatingEmail ? 0.5 : 1 }}>
                  {generatingEmail ? '⏳ Generating...' : '✨ Generate Email'}
                </button>
              </div>

              {emailDraft && (
                <div style={card}>
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subject</p>
                    <input value={emailDraft.subject} onChange={e => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                      style={{ width: '100%', fontSize: '14px', fontWeight: 500, color: 'var(--text)', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Body</p>
                    <textarea value={emailDraft.body} onChange={e => setEmailDraft({ ...emailDraft, body: e.target.value })}
                      rows={10} style={{ width: '100%', fontSize: '14px', color: 'var(--text)', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.6 }} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button onClick={generateEmail} disabled={generatingEmail}
                      style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '14px', borderRadius: '8px', background: 'var(--bg-input)', cursor: 'pointer', transition: 'all 0.15s' }}>
                      🔄 Regenerate
                    </button>
                    <button onClick={copyAndOpenGmail}
                      style={{ flex: 1, padding: '8px', fontSize: '14px', fontWeight: 500, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                      {copied ? '✅ Copied!' : '📋 Copy + Open Gmail'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EMAILS HISTORY */}
          {activeTab === 'emails' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {campaigns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim)' }}>
                  <p style={{ fontSize: '14px', marginBottom: '8px' }}>No emails generated yet.</p>
                  <button onClick={() => setActiveTab('email')}
                    style={{ fontSize: '12px', color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Generate your first email →
                  </button>
                </div>
              ) : (
                campaigns.map(campaign => {
                  const cs = CAMPAIGN_STATUS[campaign.status] || CAMPAIGN_STATUS.draft
                  return (
                    <div key={campaign.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.15s' }}
                        onClick={() => setExpandedCampaign(expandedCampaign === campaign.id ? null : campaign.id)}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.subject}</p>
                          <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>{campaign.tone} · {new Date(campaign.created_at).toLocaleDateString()}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                          <select value={campaign.status}
                            onChange={e => { e.stopPropagation(); updateCampaignStatus(campaign.id, e.target.value) }}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '999px', border: 'none', fontWeight: 500, cursor: 'pointer', background: cs.bg, color: cs.text, outline: 'none' }}>
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="replied">Replied</option>
                          </select>
                          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{expandedCampaign === campaign.id ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {expandedCampaign === campaign.id && (
                        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
                          <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Body</p>
                          <p style={{ fontSize: '14px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: '0 0 12px' }}>{campaign.body}</p>
                          <button onClick={() => { navigator.clipboard.writeText(`Subject: ${campaign.subject}\n\n${campaign.body}`); window.open('https://mail.google.com/mail/u/0/#compose', '_blank') }}
                            style={{ fontSize: '12px', padding: '6px 16px', borderRadius: '8px', color: 'white', background: '#4F7BF7', border: 'none', cursor: 'pointer' }}>
                            📋 Copy + Open Gmail
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
