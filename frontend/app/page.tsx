'use client'
import { useEffect, useState, useRef } from 'react'
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
  hot: '🔥',
  warm: '🌤',
  cold: '❄️',
}

interface Company {
  id: number
  name: string
  domain: string
  country: string
  city: string
  industry: string
  company_size: string
  email: string
  status: string
  heat_level: string
  opportunity_score: number
  is_favorite: boolean
  ai_summary: string
  tags: string
  updated_at: string
}

interface ContextMenu {
  x: number
  y: number
  company: Company
}

export default function Dashboard() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterIndustry, setFilterIndustry] = useState('')
  const [filterHeat, setFilterHeat] = useState('')
  const [filterFavorite, setFilterFavorite] = useState(false)
  const [sortBy, setSortBy] = useState('score')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [smartQuery, setSmartQuery] = useState('')
  const [smartSearching, setSmartSearching] = useState(false)
  const [isSmartMode, setIsSmartMode] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const sortRef = useRef<HTMLDivElement>(null)

  const fetchCompanies = async () => {
    setLoading(true)
    setError('')
    setIsSmartMode(false)
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (filterStatus) params.status = filterStatus
      if (filterIndustry) params.industry = filterIndustry
      if (filterHeat) params.heat_level = filterHeat
      if (filterFavorite) params.is_favorite = 'true'
      const res = await axios.get(`${API}/companies/`, { params })
      let data = res.data.companies as Company[]
      data = [...data].sort((a, b) => {
        let valA: any, valB: any
        if (sortBy === 'score') { valA = a.opportunity_score; valB = b.opportunity_score }
        else if (sortBy === 'name') { valA = a.name?.toLowerCase(); valB = b.name?.toLowerCase() }
        else if (sortBy === 'date') { valA = new Date(a.updated_at).getTime(); valB = new Date(b.updated_at).getTime() }
        else if (sortBy === 'country') { valA = a.country?.toLowerCase(); valB = b.country?.toLowerCase() }
        if (sortDir === 'desc') return valA > valB ? -1 : 1
        return valA < valB ? -1 : 1
      })
      setCompanies(data)
      setTotal(res.data.total)
    } catch {
      setError('Cannot connect to server. Make sure the backend is running.')
    }
    setLoading(false)
  }

  const runSmartSearch = async () => {
    if (!smartQuery.trim()) return
    setSmartSearching(true)
    try {
      const res = await axios.post(`${API}/companies/search/smart`, { query: smartQuery })
      setCompanies(res.data.companies)
      setTotal(res.data.total)
      setIsSmartMode(true)
    } catch {
      setError('Smart search failed.')
    }
    setSmartSearching(false)
  }

  const clearSmartSearch = () => {
    setSmartQuery('')
    setIsSmartMode(false)
    setShowAdvanced(false)
    fetchCompanies()
  }

  const clearAllFilters = () => {
    setSearch('')
    setFilterStatus('')
    setFilterIndustry('')
    setFilterHeat('')
    setFilterFavorite(false)
    setSortBy('score')
    setSortDir('desc')
  }

  const hasActiveFilters = search || filterStatus || filterIndustry || filterHeat || filterFavorite

  useEffect(() => { fetchCompanies() }, [search, filterStatus, filterIndustry, filterHeat, filterFavorite, sortBy, sortDir])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      setContextMenu(null)
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const handleRightClick = (e: React.MouseEvent, company: Company) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, company })
  }

  const toggleFavorite = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    await axios.patch(`${API}/companies/${id}/favorite`)
    fetchCompanies()
  }

  const updateStatus = async (e: React.ChangeEvent<HTMLSelectElement>, id: number) => {
    e.stopPropagation()
    await axios.patch(`${API}/companies/${id}/status?status=${e.target.value}`)
    fetchCompanies()
  }

  const quickUpdateStatus = async (id: number, status: string) => {
    await axios.patch(`${API}/companies/${id}/status?status=${status}`)
    setContextMenu(null)
    fetchCompanies()
  }

  const quickToggleFavorite = async (id: number) => {
    await axios.patch(`${API}/companies/${id}/favorite`)
    setContextMenu(null)
    fetchCompanies()
  }

  const goToCompany = (id: number) => { window.location.href = `/company/${id}` }

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3)

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#f59e0b'
    return '#94a3b8'
  }

  const toggleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(field); setSortDir('desc') }
    setSortMenuOpen(false)
  }

  const followUpReminders = companies.filter(c => {
    if (c.status !== 'sent') return false
    const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    return days >= 14
  })

  const sortLabel = sortBy === 'score' ? '🏆 Score' : sortBy === 'name' ? '🔤 Name' : sortBy === 'date' ? '📅 Date' : '🌍 Country'

  return (
    <div className="min-h-screen bg-gray-50">

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-52"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-800 truncate">{contextMenu.company.name}</p>
          </div>
          <button onClick={() => { goToCompany(contextMenu.company.id); setContextMenu(null) }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            👁 View Profile
          </button>
          <button onClick={() => { window.location.href = `/edit?id=${contextMenu.company.id}`; setContextMenu(null) }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            ✏️ Edit Company
          </button>
          <button onClick={() => { window.location.href = `/company/${contextMenu.company.id}`; setContextMenu(null) }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            ✉ Generate Email
          </button>
          <div className="border-t border-gray-100 my-1" />
          <p className="px-3 py-1 text-xs text-gray-400">Change Status</p>
          {['reviewed', 'ready', 'sent', 'replied', 'archive'].map(s => (
            <button key={s} onClick={() => quickUpdateStatus(contextMenu.company.id, s)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                contextMenu.company.status === s ? 'font-medium text-blue-600' : 'text-gray-600'
              }`}>
              {contextMenu.company.status === s ? '✓' : '○'} {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <div className="border-t border-gray-100 my-1" />
          <button onClick={() => quickToggleFavorite(contextMenu.company.id)}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            {contextMenu.company.is_favorite ? '★ Remove Favorite' : '☆ Add to Favorites'}
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Archon</h1>
          <p className="text-xs text-gray-400">by Armila Design</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{total} companies</span>
          <button onClick={() => window.location.href = '/tasks'}
            className="text-sm text-gray-500 hover:text-gray-700 transition px-3 py-2 rounded-lg hover:bg-gray-100">
            ✅ Tasks
          </button>
          <button onClick={() => window.location.href = '/analytics'}
            className="text-sm text-gray-500 hover:text-gray-700 transition px-3 py-2 rounded-lg hover:bg-gray-100">
            📊 Analytics
          </button>
          <button onClick={() => window.location.href = '/import'}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition">
            📥 Import
          </button>
          <button onClick={() => window.location.href = '/add'}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            + Add Company
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <p className="text-sm text-red-600">⚠️ {error}</p>
            <button onClick={fetchCompanies} className="text-xs text-red-500 border border-red-200 px-3 py-1 rounded-lg">Retry</button>
          </div>
        </div>
      )}

      {/* FOLLOW-UP */}
      {followUpReminders.length > 0 && !isSmartMode && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-medium text-amber-700 mb-2">⏰ Follow-up Needed ({followUpReminders.length})</p>
            <div className="flex gap-2 flex-wrap">
              {followUpReminders.map(c => (
                <button key={c.id} onClick={() => goToCompany(c.id)}
                  className="text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition">
                  {c.name} →
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="px-6 py-3 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto flex gap-3 flex-wrap items-center">
          <input type="text" placeholder="Search by name, country, city..."
            value={search} onChange={e => { setSearch(e.target.value); setIsSmartMode(false) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            {Object.keys(STATUS_COLORS).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Industries</option>
            <option value="Architecture">Architecture</option>
            <option value="CGI">CGI</option>
            <option value="Interior Design">Interior Design</option>
            <option value="Real Estate">Real Estate</option>
            <option value="Visualization">Visualization</option>
          </select>
          <select value={filterHeat} onChange={e => setFilterHeat(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Heat</option>
            <option value="hot">🔥 Hot</option>
            <option value="warm">🌤 Warm</option>
            <option value="cold">❄️ Cold</option>
          </select>
          <button
            onClick={() => setFilterFavorite(!filterFavorite)}
            className={`text-sm px-3 py-2 rounded-lg border transition ${
              filterFavorite ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            ★ {filterFavorite ? 'Favorites' : 'All'}
          </button>
          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="text-xs text-gray-400 hover:text-gray-600 transition">
              ✕ Clear
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); setShowAdvanced(!showAdvanced) }}
              className={`text-xs px-3 py-2 rounded-lg border transition font-medium ${
                showAdvanced ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600'
              }`}>
              ✨ AI Search
            </button>

            {/* SORT DROPDOWN */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={e => { e.stopPropagation(); setSortMenuOpen(prev => !prev) }}
                className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5 font-medium"
              >
                ↕ {sortLabel} {sortDir === 'desc' ? '↓' : '↑'}
              </button>
              {sortMenuOpen && (
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-48 z-30">
                  <p className="px-3 py-1.5 text-xs text-gray-400 font-medium uppercase tracking-wide">Sort by</p>
                  {[
                    { key: 'score', label: '🏆 Score' },
                    { key: 'name', label: '🔤 Name' },
                    { key: 'date', label: '📅 Last Updated' },
                    { key: 'country', label: '🌍 Country' },
                  ].map(s => (
                    <button key={s.key}
                      onClick={e => { e.stopPropagation(); toggleSort(s.key) }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition ${
                        sortBy === s.key ? 'text-blue-600 font-medium' : 'text-gray-600'
                      }`}>
                      {s.label}
                      {sortBy === s.key && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mx-2 my-1" />
                  <button
                    onClick={e => { e.stopPropagation(); setSortDir(d => d === 'desc' ? 'asc' : 'desc'); setSortMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    {sortDir === 'desc' ? '↑ Ascending' : '↓ Descending'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI SEARCH */}
      {showAdvanced && (
        <div className="px-6 py-3 bg-purple-50 border-b border-purple-100">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs text-purple-500 mb-2 font-medium">✨ AI Search — ~$0.002 per search</p>
            <div className="flex gap-2">
              <input type="text"
                placeholder="e.g. 'hot companies not contacted' or 'architecture firms with high score'"
                value={smartQuery} onChange={e => setSmartQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSmartSearch()}
                className="flex-1 border border-purple-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white" />
              <button onClick={runSmartSearch} disabled={smartSearching || !smartQuery.trim()}
                className="bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50">
                {smartSearching ? '⏳...' : '🔍 Search'}
              </button>
              {isSmartMode && (
                <button onClick={clearSmartSearch}
                  className="text-sm px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100">
                  ✕ Clear
                </button>
              )}
            </div>
            {isSmartMode && <p className="text-xs text-purple-500 mt-1">Results for: "{smartQuery}" — {total} found</p>}
          </div>
        </div>
      )}

      {/* COMPANY LIST */}
      <div className="px-6 py-4 space-y-3 max-w-5xl mx-auto">
        {loading || smartSearching ? (
          <div className="text-center py-20 text-gray-400">
            {smartSearching ? '✨ AI is searching...' : 'Loading...'}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-3">Could not load companies</p>
            <button onClick={fetchCompanies} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg">Try Again</button>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No companies found</div>
        ) : (
          companies.map(c => (
            <div key={c.id} onClick={() => goToCompany(c.id)}
              onContextMenu={e => handleRightClick(e, c)}
              className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition overflow-hidden cursor-pointer">
              <div className="p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {getInitials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900 text-sm">{c.name}</h3>
                    <span className="text-sm">{HEAT[c.heat_level] || '❄️'}</span>
                    {c.status === 'sent' && (() => {
                      const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24))
                      return days >= 14 ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⏰ {days}d</span> : null
                    })()}
                    {c.tags && c.tags.split(',').map((tag: string) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag.trim()}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    {[c.country, c.city, c.industry, c.company_size].filter(Boolean).join(' · ')}
                  </p>
                  {c.ai_summary && (
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{c.ai_summary}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="relative w-10 h-10">
                    <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
                      <circle cx="20" cy="20" r="16" fill="none" stroke="#f1f5f9" strokeWidth="3"/>
                      <circle cx="20" cy="20" r="16" fill="none"
                        stroke={getScoreColor(c.opportunity_score)} strokeWidth="3"
                        strokeDasharray={`${c.opportunity_score} 100`} strokeLinecap="round"/>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                      {Math.round(c.opportunity_score)}
                    </span>
                  </div>
                  <select value={c.status} onChange={e => updateStatus(e, c.id)} onClick={e => e.stopPropagation()}
                    className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                    {Object.keys(STATUS_COLORS).map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <div className="flex gap-3 text-xs text-gray-400">
                  {c.email && <span>✉ {c.email}</span>}
                  {c.domain && <span>🌐 {c.domain}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={e => toggleFavorite(e, c.id)}
                    className={`text-sm px-2 py-1 rounded-lg transition ${c.is_favorite ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}>
                    ★
                  </button>
                  <button onClick={e => { e.stopPropagation(); goToCompany(c.id) }}
                    className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition">
                    Notes
                  </button>
                  <button onClick={e => { e.stopPropagation(); goToCompany(c.id) }}
                    className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                    ✉ Email
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}