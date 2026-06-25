'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'

const API = 'http://localhost:8000'

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-purple-100 text-purple-700',
  ready: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-orange-100 text-orange-700',
  waiting: 'bg-gray-100 text-gray-600',
  replied: 'bg-green-100 text-green-700',
  meeting: 'bg-teal-100 text-teal-700',
  client: 'bg-emerald-100 text-emerald-700',
  archive: 'bg-red-100 text-red-400',
}

const HEAT: Record<string, string> = {
  hot: '🔥 Hot',
  warm: '🌤 Warm',
  cold: '❄️ Cold',
}

interface Company {
  id: number
  name: string
  domain: string
  website: string
  email: string
  country: string
  city: string
  industry: string
  company_size: string
  instagram: string
  linkedin: string
  ai_summary: string
  opportunity_score: number
  heat_level: string
  status: string
  is_favorite: boolean
  tags: string
}

interface Note {
  id: number
  content: string
  language: string
  pinned: boolean
  created_at: string
}

interface HistoryItem {
  id: number
  event_type: string
  description: string
  created_at: string
}

interface EmailDraft {
  subject: string
  body: string
}

export default function CompanyDetail() {
  const { id } = useParams()
  const [company, setCompany] = useState<Company | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'history' | 'email'>('overview')
  const [newNote, setNewNote] = useState('')
  const [noteLang, setNoteLang] = useState('en')
  const [savingNote, setSavingNote] = useState(false)
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null)
  const [emailTone, setEmailTone] = useState('friendly')
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchCompany = async () => {
    try {
      const res = await axios.get(`${API}/companies/${id}`)
      setCompany(res.data)
    } catch {
      window.location.href = '/'
    }
    setLoading(false)
  }

  const fetchNotes = async () => {
    try {
      const res = await axios.get(`${API}/companies/${id}/notes`)
      setNotes(res.data)
    } catch {}
  }

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/companies/${id}/history`)
      setHistory(res.data)
    } catch {}
  }

  useEffect(() => {
    fetchCompany()
    fetchNotes()
    fetchHistory()
  }, [id])

  const updateStatus = async (status: string) => {
    await axios.patch(`${API}/companies/${id}/status?status=${status}`)
    fetchCompany()
  }

  const toggleFavorite = async () => {
    await axios.patch(`${API}/companies/${id}/favorite`)
    fetchCompany()
  }

  const saveNote = async () => {
    if (!newNote.trim()) return
    setSavingNote(true)
    try {
      await axios.post(`${API}/companies/${id}/notes`, {
        content: newNote,
        language: noteLang,
        pinned: false
      })
      setNewNote('')
      fetchNotes()
    } catch {}
    setSavingNote(false)
  }

  const togglePin = async (noteId: number, pinned: boolean) => {
    await axios.patch(`${API}/companies/${id}/notes/${noteId}`, { pinned: !pinned })
    fetchNotes()
  }

  const generateEmail = async () => {
    setGeneratingEmail(true)
    setEmailDraft(null)
    try {
      const res = await axios.post(`${API}/companies/${id}/generate-email`, { tone: emailTone })
      setEmailDraft(res.data)
    } catch (e) {
      alert('Error generating email. Check API key.')
    }
    setGeneratingEmail(false)
  }

  const generateSummary = async () => {
    setGeneratingSummary(true)
    try {
      const res = await axios.post(`${API}/companies/${id}/generate-summary`)
      setCompany(prev => prev ? { ...prev, ai_summary: res.data.summary } : prev)
    } catch {
      alert('Error generating summary.')
    }
    setGeneratingSummary(false)
  }

  const copyAndOpenGmail = () => {
    if (!emailDraft) return
    const full = `Subject: ${emailDraft.subject}\n\n${emailDraft.body}`
    navigator.clipboard.writeText(full)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    window.open('https://mail.google.com/mail/u/0/#compose', '_blank')
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#f59e0b'
    return '#94a3b8'
  }

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
      Loading...
    </div>
  )
  if (!company) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => window.location.href = '/'}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          ← Back
        </button>
        <div className="flex-1" />
        <button
          onClick={toggleFavorite}
          className={`text-xl transition ${company.is_favorite ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
        >
          ★
        </button>
        <select
          value={company.status}
          onChange={e => updateStatus(e.target.value)}
          className={`text-xs px-3 py-1.5 rounded-full border-0 font-medium cursor-pointer ${STATUS_COLORS[company.status]}`}
        >
          {Object.keys(STATUS_COLORS).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <button
          onClick={() => setActiveTab('email')}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          ✉ Generate Email
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">

        {/* COMPANY CARD */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 font-bold text-base flex-shrink-0">
              {getInitials(company.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900">{company.name}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {[company.country, company.city, company.industry, company.company_size].filter(Boolean).join(' · ')}
              </p>
              {company.ai_summary ? (
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{company.ai_summary}</p>
              ) : (
                <button
                  onClick={generateSummary}
                  disabled={generatingSummary}
                  className="mt-2 text-xs text-blue-500 hover:text-blue-700 transition disabled:opacity-40"
                >
                  {generatingSummary ? '⏳ Generating...' : '✨ Generate AI Summary'}
                </button>
              )}
            </div>
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
                <circle cx="28" cy="28" r="22" fill="none" stroke="#f1f5f9" strokeWidth="4"/>
                <circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke={getScoreColor(company.opportunity_score)}
                  strokeWidth="4"
                  strokeDasharray={`${company.opportunity_score} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-700">
                {Math.round(company.opportunity_score)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
            {company.email && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>✉</span>
                <a href={`mailto:${company.email}`} className="hover:text-blue-600">{company.email}</a>
              </div>
            )}
            {company.website && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>🌐</span>
                <a href={company.website} target="_blank" className="hover:text-blue-600">{company.domain || company.website}</a>
              </div>
            )}
            {company.linkedin && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>💼</span>
                <a href={company.linkedin} target="_blank" className="hover:text-blue-600">LinkedIn</a>
              </div>
            )}
            {company.instagram && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>📸</span>
                <a href={company.instagram} target="_blank" className="hover:text-blue-600">Instagram</a>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>🌡</span>
              <span>{HEAT[company.heat_level] || '❄️ Cold'}</span>
            </div>
            {company.tags && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>🏷</span>
                <span>{company.tags}</span>
              </div>
            )}
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-1 mb-4 bg-white rounded-xl border border-gray-200 p-1">
          {(['overview', 'notes', 'history', 'email'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' ? '📋 Overview'
                : tab === 'notes' ? '📝 Notes'
                : tab === 'history' ? '📅 History'
                : '✉ Email'}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-400 text-center py-8">
              Contacts and more details coming soon.
            </p>
          </div>
        )}

        {/* NOTES */}
        {activeTab === 'notes' && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note... (English or فارسی)"
                rows={3}
                className="w-full text-sm text-gray-700 placeholder-gray-300 resize-none focus:outline-none"
              />
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <select
                  value={noteLang}
                  onChange={e => setNoteLang(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value="en">English</option>
                  <option value="fa">فارسی</option>
                </select>
                <button
                  onClick={saveNote}
                  disabled={savingNote || !newNote.trim()}
                  className="bg-blue-600 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-40"
                >
                  {savingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </div>
            {notes.length === 0 ? (
              <div className="text-center py-8 text-gray-300 text-sm">No notes yet</div>
            ) : (
              notes.map(note => (
                <div key={note.id} className={`bg-white rounded-xl border p-4 ${note.pinned ? 'border-yellow-200' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-gray-700 flex-1">{note.content}</p>
                    <button
                      onClick={() => togglePin(note.id, note.pinned)}
                      className={`text-sm flex-shrink-0 ${note.pinned ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`}
                    >
                      📌
                    </button>
                  </div>
                  <p className="text-xs text-gray-300 mt-2">
                    {new Date(note.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-300 text-sm">No history yet</div>
            ) : (
              history.map(item => (
                <div key={item.id} className="flex items-start gap-3 p-4">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{item.description}</p>
                    <p className="text-xs text-gray-300 mt-1">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* EMAIL GENERATOR */}
        {activeTab === 'email' && (
          <div className="space-y-4">
            {/* Tone selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Email Tone</p>
              <div className="flex gap-2 flex-wrap">
                {['friendly', 'formal', 'brief', 'storytelling'].map(tone => (
                  <button
                    key={tone}
                    onClick={() => setEmailTone(tone)}
                    className={`text-xs px-4 py-2 rounded-lg border transition font-medium ${
                      emailTone === tone
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {tone === 'friendly' ? '😊 Friendly'
                      : tone === 'formal' ? '💼 Formal'
                      : tone === 'brief' ? '⚡ Brief'
                      : '📖 Storytelling'}
                  </button>
                ))}
              </div>
              <button
                onClick={generateEmail}
                disabled={generatingEmail}
                className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {generatingEmail ? '⏳ Generating...' : '✨ Generate Email'}
              </button>
            </div>

            {/* Email Draft */}
            {emailDraft && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1">Subject</p>
                  <input
                    value={emailDraft.subject}
                    onChange={e => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                    className="w-full text-sm font-medium text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Body</p>
                  <textarea
                    value={emailDraft.body}
                    onChange={e => setEmailDraft({ ...emailDraft, body: e.target.value })}
                    rows={10}
                    className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={generateEmail}
                    disabled={generatingEmail}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    🔄 Regenerate
                  </button>
                  <button
                    onClick={copyAndOpenGmail}
                    className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    {copied ? '✅ Copied!' : '📋 Copy + Open Gmail'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}