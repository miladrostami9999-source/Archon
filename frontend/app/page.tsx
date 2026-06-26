'use client'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import Sidebar from './components/Sidebar'

const API = 'http://localhost:8000'

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  new:      { bg: 'bg-blue-500/10',    text: 'text-blue-400',   dot: 'bg-blue-400' },
  reviewed: { bg: 'bg-violet-500/10',  text: 'text-violet-400', dot: 'bg-violet-400' },
  ready:    { bg: 'bg-amber-500/10',   text: 'text-amber-400',  dot: 'bg-amber-400' },
  sent:     { bg: 'bg-orange-500/10',  text: 'text-orange-400', dot: 'bg-orange-400' },
  waiting:  { bg: 'bg-gray-500/10',    text: 'text-gray-400',   dot: 'bg-gray-400' },
  replied:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400',dot: 'bg-emerald-400' },
  meeting:  { bg: 'bg-teal-500/10',    text: 'text-teal-400',   dot: 'bg-teal-400' },
  client:   { bg: 'bg-green-500/10',   text: 'text-green-400',  dot: 'bg-green-400' },
  archive:  { bg: 'bg-red-500/10',     text: 'text-red-400',    dot: 'bg-red-400' },
}

const HEAT_ICON: Record<string, string> = { hot: '🔥', warm: '🌤', cold: '❄️' }

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

interface ContextMenu { x: number; y: number; company: Company }

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
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [smartQuery, setSmartQuery] = useState('')
  const [smartSearching, setSmartSearching] = useState(false)
  const [isSmartMode, setIsSmartMode] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [todayTasks, setTodayTasks] = useState<{ total: number; done: number }>({ total: 0, done: 0 })
  const sortRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

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
        return sortDir === 'desc' ? (valA > valB ? -1 : 1) : (valA < valB ? -1 : 1)
      })
      setCompanies(data)
      setTotal(res.data.total)
    } catch { setError('Cannot connect to server.') }
    setLoading(false)
  }

  const fetchTodayTasks = async () => {
    try {
      const res = await axios.get(`${API}/companies/tasks/today`)
      const tasks = Array.isArray(res.data) ? res.data : []
      setTodayTasks({ total: tasks.length, done: tasks.filter((t: any) => t.is_done).length })
    } catch {}
  }

  useEffect(() => { fetchCompanies(); fetchTodayTasks() }, [search, filterStatus, filterIndustry, filterHeat, filterFavorite, sortBy, sortDir])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      setContextMenu(null)
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortMenuOpen(false)
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

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

  const goToCompany = (id: number) => { window.location.href = `/company/${id}` }

  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  const getScoreColor = (s: number) => s >= 80 ? '#34D399' : s >= 60 ? '#FBBF24' : '#64748B'

  const runSmartSearch = async () => {
    if (!smartQuery.trim()) return
    setSmartSearching(true)
    try {
      const res = await axios.post(`${API}/companies/search/smart`, { query: smartQuery })
      setCompanies(res.data.companies); setTotal(res.data.total); setIsSmartMode(true)
    } catch { setError('Smart search failed.') }
    setSmartSearching(false)
  }

  const clearSmartSearch = () => { setSmartQuery(''); setIsSmartMode(false); setShowAdvanced(false); fetchCompanies() }
  const clearFilters = () => { setFilterStatus(''); setFilterIndustry(''); setFilterHeat(''); setFilterFavorite(false) }
  const hasFilters = filterStatus || filterIndustry || filterHeat || filterFavorite
  const toggleSort = (f: string) => { if (sortBy === f) setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortBy(f); setSortDir('desc') }; setSortMenuOpen(false) }

  const followUps = companies.filter(c => {
    if (c.status !== 'sent') return false
    return Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000) >= 14
  })

  const hasNotif = (todayTasks.total > 0 && todayTasks.done < todayTasks.total) || followUps.length > 0
  const sortLabel = { score: 'Score', name: 'Name', date: 'Date', country: 'Country' }[sortBy] || 'Score'

  return (
    <div className="flex min-h-screen bg-[#0F1117]">
      <Sidebar />

      {/* MAIN */}
      <div className="flex-1 ml-56 flex flex-col min-h-screen">

        {/* TOP BAR */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-3.5"
          style={{ background: 'rgba(15,17,23,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

          <div className="flex items-center gap-2">
            {/* SEARCH */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 text-sm">⌕</span>
              <input
                type="text" placeholder="Search companies..."
                value={search} onChange={e => { setSearch(e.target.value); setIsSmartMode(false) }}
                className="bg-white/5 border border-white/8 rounded-lg pl-8 pr-3 py-2 text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 w-52 transition-all"
              />
            </div>

            {/* FILTERS DROPDOWN */}
            <div className="relative" ref={filterRef}>
              <button onClick={e => { e.stopPropagation(); setFilterMenuOpen(p => !p) }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-all ${
                  hasFilters
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : 'bg-white/5 border-white/8 text-white/50 hover:text-white/70 hover:bg-white/8'
                }`}>
                <span>⊟</span> Filters {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
              </button>
              {filterMenuOpen && (
                <div className="absolute left-0 top-11 w-64 rounded-xl border border-white/10 p-4 z-30 space-y-3"
                  style={{ background: '#1A2030' }} onClick={e => e.stopPropagation()}>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Status</p>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                      className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-blue-500/40">
                      <option value="">All Status</option>
                      {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Industry</p>
                    <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}
                      className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-blue-500/40">
                      <option value="">All Industries</option>
                      <option>Architecture</option><option>CGI</option>
                      <option>Interior Design</option><option>Real Estate</option><option>Visualization</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Heat</p>
                    <div className="flex gap-2">
                      {['hot', 'warm', 'cold'].map(h => (
                        <button key={h} onClick={() => setFilterHeat(filterHeat === h ? '' : h)}
                          className={`flex-1 py-1.5 rounded-lg text-xs border transition-all ${
                            filterHeat === h ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/8 text-white/40 hover:text-white/60'
                          }`}>
                          {HEAT_ICON[h]} {h}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={() => setFilterFavorite(!filterFavorite)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        filterFavorite ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/8 text-white/40'
                      }`}>
                      ★ Favorites only
                    </button>
                    {hasFilters && (
                      <button onClick={clearFilters} className="text-xs text-white/30 hover:text-white/50">Clear all</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* AI SEARCH */}
            <button onClick={e => { e.stopPropagation(); setShowAdvanced(!showAdvanced) }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-all ${
                showAdvanced ? 'bg-violet-500/15 border-violet-500/30 text-violet-400' : 'bg-white/5 border-white/8 text-white/50 hover:text-white/70 hover:bg-white/8'
              }`}>
              ✦ AI Search
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* SORT */}
            <div className="relative" ref={sortRef}>
              <button onClick={e => { e.stopPropagation(); setSortMenuOpen(p => !p) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/8 text-white/50 hover:text-white/70 hover:bg-white/8 transition-all">
                ↕ Sort: {sortLabel} {sortDir === 'desc' ? '↓' : '↑'}
              </button>
              {sortMenuOpen && (
                <div className="absolute right-0 top-11 w-44 rounded-xl border border-white/10 py-1 z-30"
                  style={{ background: '#1A2030' }}>
                  {[['score','🏆 Score'],['name','🔤 Name'],['date','📅 Date'],['country','🌍 Country']].map(([k, l]) => (
                    <button key={k} onClick={e => { e.stopPropagation(); toggleSort(k) }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-white/5 transition ${
                        sortBy === k ? 'text-blue-400' : 'text-white/50'
                      }`}>
                      {l} {sortBy === k && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* NOTIF */}
            <div className="relative" ref={notifRef}>
              <button onClick={e => { e.stopPropagation(); setNotifOpen(p => !p) }}
                className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/8 text-white/50 hover:text-white/70 hover:bg-white/8 transition-all text-base">
                🔔
                {hasNotif && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-400 rounded-full" />}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-72 rounded-xl border border-white/10 overflow-hidden z-40"
                  style={{ background: '#1A2030' }} onClick={e => e.stopPropagation()}>
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-sm font-medium text-white/80">Notifications</p>
                  </div>
                  <div>
                    <button className="w-full text-left px-4 py-3 hover:bg-white/5 transition"
                      onClick={() => { window.location.href = '/tasks'; setNotifOpen(false) }}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg">✅</span>
                        <div className="flex-1">
                          <p className="text-sm text-white/70 font-medium">Daily Tasks</p>
                          <p className="text-xs text-white/30 mt-0.5">
                            {todayTasks.total === 0 ? 'No tasks yet' : `${todayTasks.done}/${todayTasks.total} done`}
                          </p>
                          {todayTasks.total > 0 && (
                            <div className="w-full bg-white/10 rounded-full h-1 mt-1.5">
                              <div className="h-1 rounded-full bg-blue-400"
                                style={{ width: `${Math.round((todayTasks.done/todayTasks.total)*100)}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="border-t border-white/5">
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🏢</span>
                          <div>
                            <p className="text-sm text-white/70 font-medium">CRM</p>
                            <p className="text-xs text-white/30">{total} companies · {companies.filter(c=>c.status==='new').length} new</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {followUps.length > 0 && (
                      <div className="border-t border-white/5 bg-amber-500/5">
                        <div className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">⏰</span>
                            <div>
                              <p className="text-sm text-amber-400 font-medium">Follow-up Needed</p>
                              <p className="text-xs text-amber-400/60">{followUps.map(c=>c.name).join(', ')}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ADD */}
            <button onClick={() => window.location.href = '/add'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)' }}>
              + Add
            </button>
          </div>
        </div>

        {/* AI SEARCH BAR */}
        {showAdvanced && (
          <div className="px-6 py-3 border-b border-white/5" style={{ background: 'rgba(124,58,237,0.05)' }}>
            <div className="flex gap-2">
              <input type="text"
                placeholder="e.g. 'hot architecture firms not contacted yet'"
                value={smartQuery} onChange={e => setSmartQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSmartSearch()}
                className="flex-1 bg-white/5 border border-violet-500/20 rounded-lg px-4 py-2 text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-violet-500/40" />
              <button onClick={runSmartSearch} disabled={smartSearching || !smartQuery.trim()}
                className="bg-violet-500/20 border border-violet-500/30 text-violet-400 text-sm px-4 py-2 rounded-lg hover:bg-violet-500/30 transition disabled:opacity-40">
                {smartSearching ? '⏳' : '✦ Search'}
              </button>
              {isSmartMode && (
                <button onClick={clearSmartSearch}
                  className="text-sm px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-white/40 hover:text-white/60">
                  ✕
                </button>
              )}
            </div>
            {isSmartMode && <p className="text-xs text-violet-400/60 mt-1.5">AI results for: "{smartQuery}" — {total} found</p>}
          </div>
        )}

        {/* FOLLOW-UP */}
        {followUps.length > 0 && !isSmartMode && (
          <div className="px-6 py-2.5 border-b border-amber-500/10" style={{ background: 'rgba(245,158,11,0.04)' }}>
            <div className="flex items-center gap-3">
              <p className="text-xs text-amber-400/70 font-medium">⏰ Follow-up:</p>
              <div className="flex gap-2 flex-wrap">
                {followUps.map(c => (
                  <button key={c.id} onClick={() => goToCompany(c.id)}
                    className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-1 rounded-lg hover:bg-amber-500/15 transition">
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="px-6 py-2.5 border-b border-red-500/10 bg-red-500/5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-400">⚠ {error}</p>
              <button onClick={fetchCompanies} className="text-xs text-red-400/60 border border-red-400/20 px-3 py-1 rounded-lg hover:bg-red-400/10">Retry</button>
            </div>
          </div>
        )}

        {/* STATS BAR */}
        <div className="px-6 py-2 border-b border-white/5 flex items-center gap-4">
          <p className="text-xs text-white/30">{total} companies</p>
          {isSmartMode && <span className="text-xs bg-violet-500/15 text-violet-400 px-2 py-0.5 rounded-full">AI filtered</span>}
          {hasFilters && <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full">Filtered</span>}
        </div>

        {/* COMPANY LIST */}
        <div className="flex-1 px-6 py-4 space-y-2">
          {loading || smartSearching ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-white/30">{smartSearching ? 'AI searching...' : 'Loading...'}</p>
              </div>
            </div>
          ) : companies.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <p className="text-3xl mb-3 opacity-30">⬡</p>
                <p className="text-sm text-white/30">No companies found</p>
              </div>
            </div>
          ) : (
            companies.map(c => {
              const sc = STATUS_COLORS[c.status] || STATUS_COLORS.new
              return (
                <div key={c.id} onClick={() => goToCompany(c.id)}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, company: c }) }}
                  className="group rounded-xl border border-white/6 p-4 cursor-pointer transition-all duration-150 hover:border-blue-500/25"
                  style={{ background: 'rgba(30,36,54,0.6)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,36,54,0.9)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(30,36,54,0.6)')}
                >
                  <div className="flex items-center gap-3">
                    {/* AVATAR */}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, rgba(79,123,247,0.2), rgba(124,58,237,0.2))', border: '1px solid rgba(79,123,247,0.15)', color: '#7BAEF7' }}>
                      {getInitials(c.name)}
                    </div>

                    {/* INFO */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white/85 truncate">{c.name}</h3>
                        <span className="text-xs opacity-60">{HEAT_ICON[c.heat_level]}</span>
                        {c.tags && c.tags.split(',').slice(0,2).map(tag => (
                          <span key={tag} className="text-[10px] bg-white/5 text-white/35 px-1.5 py-0.5 rounded-md">{tag.trim()}</span>
                        ))}
                      </div>
                      <p className="text-xs text-white/30 mt-0.5 truncate">
                        {[c.country, c.city, c.industry].filter(Boolean).join(' · ')}
                      </p>
                    </div>

                    {/* RIGHT */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* SCORE */}
                      <div className="relative w-8 h-8">
                        <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
                          <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"/>
                          <circle cx="16" cy="16" r="13" fill="none"
                            stroke={getScoreColor(c.opportunity_score)} strokeWidth="2.5"
                            strokeDasharray={`${c.opportunity_score * 0.816} 100`}
                            strokeLinecap="round"
                            style={{ filter: `drop-shadow(0 0 4px ${getScoreColor(c.opportunity_score)}60)` }}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                          style={{ color: getScoreColor(c.opportunity_score) }}>
                          {Math.round(c.opportunity_score)}
                        </span>
                      </div>

                      {/* STATUS */}
                      <select value={c.status}
                        onChange={e => updateStatus(e, c.id)}
                        onClick={e => e.stopPropagation()}
                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium cursor-pointer border-0 ${sc.bg} ${sc.text}`}
                        style={{ colorScheme: 'dark' }}>
                        {Object.keys(STATUS_COLORS).map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>

                      {/* FAVORITE */}
                      <button onClick={e => toggleFavorite(e, c.id)}
                        className={`text-xl transition-all ${c.is_favorite ? 'text-amber-400' : 'text-white/15 hover:text-white/40'}`}>
                        ★
                      </button>
                    </div>
                  </div>

                  {/* SUMMARY */}
                  {c.ai_summary && (
                    <p className="text-xs text-white/25 mt-2 line-clamp-1 pl-12">{c.ai_summary}</p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div className="fixed z-50 rounded-xl border border-white/10 py-1 w-48 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y, background: '#1E2436' }}
          onClick={e => e.stopPropagation()}>
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-xs text-white/50 truncate">{contextMenu.company.name}</p>
          </div>
          {[
            { label: '👁 View', action: () => { goToCompany(contextMenu.company.id); setContextMenu(null) } },
            { label: '✏️ Edit', action: () => { window.location.href = `/edit?id=${contextMenu.company.id}`; setContextMenu(null) } },
            { label: '✉ Generate Email', action: () => { window.location.href = `/company/${contextMenu.company.id}`; setContextMenu(null) } },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className="w-full text-left px-3 py-2 text-sm text-white/60 hover:text-white/80 hover:bg-white/5 transition">
              {item.label}
            </button>
          ))}
          <div className="border-t border-white/5 my-1" />
          <p className="px-3 py-1 text-[10px] text-white/25 uppercase tracking-wider">Status</p>
          {['reviewed','ready','sent','replied','archive'].map(s => (
            <button key={s} onClick={() => quickUpdateStatus(contextMenu.company.id, s)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition ${
                contextMenu.company.status === s ? 'text-blue-400' : 'text-white/40'
              }`}>
              {contextMenu.company.status === s ? '✓ ' : '○ '}{s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}