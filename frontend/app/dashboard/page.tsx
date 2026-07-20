'use client'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { useIsMobile } from '../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const PAGE_SIZE = 20

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  new:      { bg: '#3B82F620', text: '#60A5FA', dot: '#60A5FA' },
  reviewed: { bg: '#8B5CF620', text: '#A78BFA', dot: '#A78BFA' },
  ready:    { bg: '#F59E0B20', text: '#FCD34D', dot: '#FCD34D' },
  sent:     { bg: '#F9731620', text: '#FB923C', dot: '#FB923C' },
  waiting:  { bg: '#6B728020', text: '#9CA3AF', dot: '#9CA3AF' },
  replied:  { bg: '#10B98120', text: '#34D399', dot: '#34D399' },
  meeting:  { bg: '#14B8A620', text: '#2DD4BF', dot: '#2DD4BF' },
  client:   { bg: '#22C55E20', text: '#4ADE80', dot: '#4ADE80' },
  archive:  { bg: '#EF444420', text: '#F87171', dot: '#F87171' },
}

const KANBAN_COLUMNS = ['new','reviewed','ready','sent','waiting','replied','meeting','client','archive']
const KANBAN_ROW1 = ['new','reviewed','ready','sent','waiting']
const KANBAN_ROW2 = ['replied','meeting','client','archive']

const HEAT_ICON: Record<string, string> = { hot: '🔥', warm: '🌤', cold: '❄️' }

interface Company {
  id: number; name: string; domain: string; country: string; city: string
  industry: string; company_size: string; email: string; status: string
  heat_level: string; opportunity_score: number; is_favorite: boolean
  ai_summary: string; tags: string; updated_at: string
}

interface ContextMenu { x: number; y: number; company: Company }

// ─── KANBAN CARD ───────────────────────────────────────────────────────────
function KanbanCard({ company, onFavorite, onClick }: {
  company: Company
  onFavorite: (e: React.MouseEvent, id: number) => void
  onClick: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(company.id),
    data: { company },
  })

  const getScoreColor = (s: number) => s >= 80 ? '#34D399' : s >= 60 ? '#FBBF24' : '#64748B'
  const getInitials = (name: string) => name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onClick(company.id)}
      style={{
        borderRadius: '10px',
        border: '1px solid var(--border)',
        background: 'var(--bg-main)',
        padding: '12px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 0.15s, box-shadow 0.15s',
        userSelect: 'none',
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 700, color: '#7BAEF7',
            background: 'linear-gradient(135deg, rgba(79,123,247,0.2), rgba(124,58,237,0.2))',
          }}>
            {getInitials(company.name)}
          </div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {company.name}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onFavorite(e, company.id) }}
          style={{ fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, color: company.is_favorite ? '#FBBF24' : 'var(--text-dim)', padding: '0', lineHeight: 1 }}>
          ★
        </button>
      </div>

      {/* META */}
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {[company.country, company.industry].filter(Boolean).join(' · ')} {HEAT_ICON[company.heat_level]}
      </p>

      {/* SCORE */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {company.tags && company.tags.split(',').slice(0,1).map(tag => (
            <span key={tag} style={{ fontSize: '9px', background: 'var(--bg-tag)', color: 'var(--text-dim)', padding: '2px 6px', borderRadius: '4px' }}>{tag.trim()}</span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '24px', height: '24px', position: 'relative' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="12" cy="12" r="9" fill="none" stroke="var(--border)" strokeWidth="2.5"/>
              <circle cx="12" cy="12" r="9" fill="none"
                stroke={getScoreColor(company.opportunity_score)} strokeWidth="2.5"
                strokeDasharray={`${company.opportunity_score * 0.565} 100`}
                strokeLinecap="round"/>
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: getScoreColor(company.opportunity_score) }}>
              {Math.round(company.opportunity_score)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── KANBAN COLUMN ─────────────────────────────────────────────────────────
function KanbanColumn({ status, companies, onFavorite, onClick, isOver }: {
  status: string
  companies: Company[]
  onFavorite: (e: React.MouseEvent, id: number) => void
  onClick: (id: number) => void
  isOver: boolean
}) {
  const sc = STATUS_COLORS[status] || STATUS_COLORS.new
  const { setNodeRef } = useDroppable({ id: status })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '220px', maxWidth: '220px' }}>
      {/* COLUMN HEADER */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderRadius: '10px 10px 0 0',
        background: sc.bg, marginBottom: '1px',
        border: `1px solid ${sc.dot}30`, borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: sc.dot }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: sc.text, textTransform: 'capitalize' }}>{status}</span>
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, color: sc.text, background: `${sc.dot}20`, padding: '2px 7px', borderRadius: '999px' }}>{companies.length}</span>
      </div>

      {/* DROP ZONE */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          minHeight: '80px',
          maxHeight: '340px',
          overflowY: 'auto',
          borderRadius: '0 0 10px 10px',
          border: `1px solid ${isOver ? sc.dot + '60' : 'var(--border)'}`,
          borderTop: 'none',
          background: isOver ? `${sc.dot}08` : 'var(--bg-card)',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '7px',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        {companies.map(c => (
          <KanbanCard key={c.id} company={c} onFavorite={onFavorite} onClick={onClick} />
        ))}
        {companies.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '60px' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center' }}>Drop here</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────
export default function Dashboard() {
  const isMobile = useIsMobile()

  const [companies, setCompanies] = useState<Company[]>([])
  const [allCompanies, setAllCompanies] = useState<Company[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'board'>('list')
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [todayTasks, setTodayTasks] = useState<{ total: number; done: number }>({ total: 0, done: 0 })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const sortData = (data: Company[]) => [...data].sort((a, b) => {
    let valA: any, valB: any
    if (sortBy === 'score') { valA = a.opportunity_score; valB = b.opportunity_score }
    else if (sortBy === 'name') { valA = a.name?.toLowerCase(); valB = b.name?.toLowerCase() }
    else if (sortBy === 'date') { valA = new Date(a.updated_at).getTime(); valB = new Date(b.updated_at).getTime() }
    else if (sortBy === 'country') { valA = a.country?.toLowerCase(); valB = b.country?.toLowerCase() }
    return sortDir === 'desc' ? (valA > valB ? -1 : 1) : (valA < valB ? -1 : 1)
  })

  const fetchCompanies = async (targetPage = page) => {
    setLoading(true); setError(''); setIsSmartMode(false)
    try {
      const params: Record<string, string> = {
        skip: String((targetPage - 1) * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      }
      if (search) params.search = search
      if (filterStatus) params.status = filterStatus
      if (filterIndustry) params.industry = filterIndustry
      if (filterHeat) params.heat_level = filterHeat
      if (filterFavorite) params.is_favorite = 'true'
      const res = await axios.get(`${API}/companies/`, { params })
      setCompanies(sortData(res.data.companies as Company[]))
      setTotal(res.data.total)
    } catch { setError('Cannot connect to server.') }
    setLoading(false)
  }

  // Fetch ALL companies for board view (no pagination)
  const fetchAllCompanies = async () => {
    try {
      const params: Record<string, string> = { skip: '0', limit: '1000' }
      if (search) params.search = search
      if (filterStatus) params.status = filterStatus
      if (filterIndustry) params.industry = filterIndustry
      if (filterHeat) params.heat_level = filterHeat
      if (filterFavorite) params.is_favorite = 'true'
      const res = await axios.get(`${API}/companies/`, { params })
      setAllCompanies(sortData(res.data.companies as Company[]))
    } catch {}
  }

  const fetchTodayTasks = async () => {
    try {
      const res = await axios.get(`${API}/companies/tasks/today`)
      const tasks = Array.isArray(res.data) ? res.data : []
      setTodayTasks({ total: tasks.length, done: tasks.filter((t: any) => t.is_done).length })
    } catch {}
  }

  useEffect(() => {
    setPage(1)
    fetchCompanies(1)
    fetchTodayTasks()
  }, [search, filterStatus, filterIndustry, filterHeat, filterFavorite, sortBy, sortDir])

  useEffect(() => { fetchCompanies(page) }, [page])

  useEffect(() => {
    if (view === 'board') fetchAllCompanies()
  }, [view, search, filterStatus, filterIndustry, filterHeat, filterFavorite, sortBy, sortDir])

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
    fetchCompanies(); if (view === 'board') fetchAllCompanies()
  }

  const updateStatus = async (e: React.ChangeEvent<HTMLSelectElement>, id: number) => {
    e.stopPropagation()
    await axios.patch(`${API}/companies/${id}/status?status=${e.target.value}`)
    fetchCompanies()
  }

  const quickUpdateStatus = async (id: number, status: string) => {
    await axios.patch(`${API}/companies/${id}/status?status=${status}`)
    setContextMenu(null); fetchCompanies()
  }

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id
    if (overId && KANBAN_COLUMNS.includes(String(overId))) {
      setOverColumn(String(overId))
    } else {
      setOverColumn(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null); setOverColumn(null)
    if (!over) return
    const companyId = Number(active.id)
    const newStatus = String(over.id)
    if (!KANBAN_COLUMNS.includes(newStatus)) return
    const company = allCompanies.find(c => c.id === companyId)
    if (!company || company.status === newStatus) return

    // Optimistic update
    setAllCompanies(prev => prev.map(c => c.id === companyId ? { ...c, status: newStatus } : c))
    try {
      await axios.patch(`${API}/companies/${companyId}/status?status=${newStatus}`)
    } catch {
      fetchAllCompanies() // rollback on error
    }
  }

  const goToCompany = (id: number) => { window.location.href = `/company/${id}` }
  const getInitials = (name: string) => name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const getScoreColor = (s: number) => s >= 80 ? '#34D399' : s >= 60 ? '#FBBF24' : '#64748B'

  const runSmartSearch = async () => {
    if (!smartQuery.trim()) return
    setSmartSearching(true)
    try {
      const res = await axios.post(`${API}/companies/search/smart`, { query: smartQuery })
      setCompanies(res.data.companies); setAllCompanies(res.data.companies)
      setTotal(res.data.total); setIsSmartMode(true)
    } catch { setError('Smart search failed.') }
    setSmartSearching(false)
  }

  const clearSmartSearch = () => { setSmartQuery(''); setIsSmartMode(false); setShowAdvanced(false); fetchCompanies(1) }
  const clearFilters = () => { setFilterStatus(''); setFilterIndustry(''); setFilterHeat(''); setFilterFavorite(false) }
  const hasFilters = filterStatus || filterIndustry || filterHeat || filterFavorite
  const toggleSort = (f: string) => {
    if (sortBy === f) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(f); setSortDir('desc') }
    setSortMenuOpen(false)
  }

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return
    setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = []
    if (page <= 4) { pages.push(1, 2, 3, 4, 5, '...', totalPages) }
    else if (page >= totalPages - 3) { pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages) }
    else { pages.push(1, '...', page - 1, page, page + 1, '...', totalPages) }
    return pages
  }

  const followUps = companies.filter(c => {
    if (c.status !== 'sent') return false
    return Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000) >= 14
  })

  const hasNotif = (todayTasks.total > 0 && todayTasks.done < todayTasks.total) || followUps.length > 0
  const sortLabel = { score: 'Score', name: 'Name', date: 'Date', country: 'Country' }[sortBy] || 'Score'
  const startItem = (page - 1) * PAGE_SIZE + 1
  const endItem = Math.min(page * PAGE_SIZE, total)
  const activeCompany = activeId ? allCompanies.find(c => c.id === Number(activeId)) : null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', display: 'flex', flexDirection: 'column', paddingTop: isMobile ? '52px' : 0, minHeight: '100vh', overflowX: 'hidden' }}>

        {/* TOP BAR */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '0 10px' : '0 24px', height: '56px',
          background: 'var(--bg-main)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)', transition: 'background 0.25s, border-color 0.25s',
          gap: isMobile ? '6px' : '0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px', flex: isMobile ? 1 : 'auto', minWidth: 0 }}>
            {/* SEARCH */}
            {isMobile ? (
              <button onClick={() => setSearchOpen(p => !p)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', border: search ? '1px solid rgba(79,123,247,0.4)' : '1px solid var(--border)', background: search ? 'rgba(79,123,247,0.12)' : 'var(--bg-input)', color: search ? '#60A5FA' : 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, fontSize: '16px', position: 'relative' }}>
                ⌕
                {search && <span style={{ position: 'absolute', top: '4px', right: '4px', width: '5px', height: '5px', borderRadius: '50%', background: '#60A5FA' }} />}
              </button>
            ) : (
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '13px' }}>⌕</span>
                <input type="text" placeholder="Search companies..."
                  value={search} onChange={e => { setSearch(e.target.value); setIsSmartMode(false) }}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', paddingLeft: '28px', paddingRight: '8px', paddingTop: '7px', paddingBottom: '7px', fontSize: '14px', color: 'var(--text)', width: '208px', outline: 'none', transition: 'all 0.15s' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
            )}

            {/* FILTERS — icon only on mobile */}
            <div style={{ position: 'relative', flexShrink: 0 }} ref={filterRef}>
              <button onClick={e => { e.stopPropagation(); setFilterMenuOpen(p => !p) }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: isMobile ? '7px 9px' : '8px 12px', borderRadius: '8px', fontSize: isMobile ? '16px' : '14px', border: hasFilters ? '1px solid rgba(79,123,247,0.3)' : '1px solid var(--border)', background: hasFilters ? 'rgba(79,123,247,0.15)' : 'var(--bg-input)', color: hasFilters ? '#60A5FA' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}>
                <span>⊟</span>
                {!isMobile && <> Filters</>}
                {hasFilters && <span style={{ position: 'absolute', top: '5px', right: '5px', width: '5px', height: '5px', borderRadius: '50%', background: '#60A5FA', display: 'block' }} />}
              </button>
              {filterMenuOpen && (
                <div style={{ position: 'absolute', left: 0, top: '44px', width: '256px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', backdropFilter: 'blur(12px)', padding: '16px', zIndex: 30, display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Status</p>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: 'var(--text)', outline: 'none' }}>
                      <option value="">All Status</option>
                      {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Industry</p>
                    <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: 'var(--text)', outline: 'none' }}>
                      <option value="">All Industries</option>
                      <option>Architecture</option><option>CGI</option>
                      <option>Interior Design</option><option>Real Estate</option><option>Visualization</option>
                    </select>
                  </div>
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Heat</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['hot', 'warm', 'cold'].map(h => (
                        <button key={h} onClick={() => setFilterHeat(filterHeat === h ? '' : h)}
                          style={{ flex: 1, padding: '6px', borderRadius: '8px', fontSize: '12px', border: filterHeat === h ? '1px solid rgba(79,123,247,0.4)' : '1px solid var(--border)', background: filterHeat === h ? 'rgba(79,123,247,0.2)' : 'var(--bg-input)', color: filterHeat === h ? '#93C5FD' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
                          {HEAT_ICON[h]} {h}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                    <button onClick={() => setFilterFavorite(!filterFavorite)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: filterFavorite ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border)', background: filterFavorite ? 'rgba(245,158,11,0.15)' : 'var(--bg-input)', color: filterFavorite ? '#FBBF24' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
                      ★ Favorites only
                    </button>
                    {hasFilters && <button onClick={clearFilters} style={{ fontSize: '12px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>}
                  </div>
                </div>
              )}
            </div>

            {/* AI SEARCH */}
            <button onClick={e => { e.stopPropagation(); setShowAdvanced(!showAdvanced) }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', fontSize: '14px', border: showAdvanced ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--border)', background: showAdvanced ? 'rgba(139,92,246,0.15)' : 'var(--bg-input)', color: showAdvanced ? '#A78BFA' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
              ✦ AI Search
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px', flexShrink: 0 }}>
            {/* VIEW TOGGLE */}
            <div data-tour="view-toggle" style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px', gap: '2px', flexShrink: 0 }}>
              {([['list','☰'],['board','⊞']] as const).map(([v, icon]) => (
                <button key={v} onClick={() => setView(v)}
                  style={{ padding: isMobile ? '6px 8px' : '5px 10px', borderRadius: '6px', fontSize: isMobile ? '14px' : '12px', fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: view === v ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'transparent', color: view === v ? 'white' : 'var(--text-muted)' }}>
                  {isMobile ? icon : (v === 'list' ? `${icon} List` : `${icon} Board`)}
                </button>
              ))}
            </div>

            {/* SORT — only in list */}
            {view === 'list' && (
              <div style={{ position: 'relative', flexShrink: 0 }} ref={sortRef}>
                <button onClick={e => { e.stopPropagation(); setSortMenuOpen(p => !p) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '7px 9px' : '8px 12px', borderRadius: '8px', fontSize: isMobile ? '14px' : '14px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {isMobile ? '↕' : `↕ ${sortLabel} ${sortDir === 'desc' ? '↓' : '↑'}`}
                </button>
                {sortMenuOpen && (
                  <div style={{ position: 'absolute', right: 0, top: '44px', width: '176px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', backdropFilter: 'blur(12px)', padding: '4px', zIndex: 30, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                    {[['score','🏆 Score'],['name','🔤 Name'],['date','📅 Date'],['country','🌍 Country']].map(([k, l]) => (
                      <button key={k} onClick={e => { e.stopPropagation(); toggleSort(k) }}
                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', color: sortBy === k ? '#60A5FA' : 'var(--text-muted)', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                        {l} {sortBy === k && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* NOTIF */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button onClick={e => { e.stopPropagation(); setNotifOpen(p => !p) }}
                style={{ position: 'relative', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', transition: 'all 0.15s' }}>
                🔔
                {hasNotif && <span style={{ position: 'absolute', top: '6px', right: '6px', width: '6px', height: '6px', background: '#F87171', borderRadius: '50%' }} />}
              </button>
              {notifOpen && (
                <div style={{ position: 'absolute', right: 0, top: '44px', width: '288px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', backdropFilter: 'blur(12px)', overflow: 'hidden', zIndex: 40, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', margin: 0 }}>Notifications</p>
                  </div>
                  <button style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}
                    onClick={() => { window.location.href = '/tasks'; setNotifOpen(false) }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                    <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: '12px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                      <span style={{ fontSize: '18px' }}>✅</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 500, margin: 0 }}>Daily Tasks</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{todayTasks.total === 0 ? 'No tasks yet' : `${todayTasks.done}/${todayTasks.total} done`}</p>
                        {todayTasks.total > 0 && (
                          <div style={{ width: '100%', background: 'var(--border)', borderRadius: '4px', height: '4px', marginTop: '6px' }}>
                            <div style={{ height: '4px', borderRadius: '4px', background: '#60A5FA', width: `${Math.round((todayTasks.done/todayTasks.total)*100)}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '18px' }}>🏢</span>
                      <div>
                        <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 500, margin: 0 }}>CRM</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{total} companies · {companies.filter(c=>c.status==='new').length} new</p>
                      </div>
                    </div>
                  </div>
                  {followUps.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', background: 'rgba(245,158,11,0.05)', padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '18px' }}>⏰</span>
                        <div>
                          <p style={{ fontSize: '14px', color: '#FBBF24', fontWeight: 500, margin: 0 }}>Follow-up Needed</p>
                          <p style={{ fontSize: '12px', color: 'rgba(251,191,36,0.6)', margin: '2px 0 0' }}>{followUps.map(c=>c.name).join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ADD */}
            <button data-tour="add-company" onClick={() => window.location.href = '/add'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: isMobile ? '7px 10px' : '8px 16px', borderRadius: '8px', fontSize: isMobile ? '14px' : '14px', fontWeight: 600, background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', color: 'white', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              {isMobile ? '+' : '+ Add'}
            </button>
          </div>
        </div>

        {/* MOBILE SEARCH BAR */}
        {isMobile && searchOpen && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-main)' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '14px' }}>⌕</span>
              <input
                type="text"
                autoFocus
                placeholder="Search companies..."
                value={search}
                onChange={e => { setSearch(e.target.value); setIsSmartMode(false) }}
                onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
                style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--bg-input)', border: '1px solid rgba(79,123,247,0.4)', borderRadius: '8px', paddingLeft: '32px', paddingRight: search ? '36px' : '12px', paddingTop: '9px', paddingBottom: '9px', fontSize: '14px', color: 'var(--text)', outline: 'none' }}
              />
              {search && (
                <button onClick={() => { setSearch(''); setIsSmartMode(false) }}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '14px', padding: '2px' }}>✕</button>
              )}
            </div>
          </div>
        )}

        {/* AI SEARCH BAR */}
        {showAdvanced && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(124,58,237,0.04)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="e.g. 'hot architecture firms not contacted yet'"
                value={smartQuery} onChange={e => setSmartQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSmartSearch()}
                style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', color: 'var(--text)', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)' }} />
              <button onClick={runSmartSearch} disabled={smartSearching || !smartQuery.trim()}
                style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA', fontSize: '14px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', opacity: (smartSearching || !smartQuery.trim()) ? 0.4 : 1 }}>
                {smartSearching ? '⏳' : '✦ Search'}
              </button>
              {isSmartMode && (
                <button onClick={clearSmartSearch} style={{ fontSize: '14px', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
              )}
            </div>
            {isSmartMode && <p style={{ fontSize: '12px', color: 'rgba(167,139,250,0.6)', marginTop: '6px', marginBottom: 0 }}>AI results for: "{smartQuery}" — {total} found</p>}
          </div>
        )}

        {/* FOLLOW-UP */}
        {followUps.length > 0 && !isSmartMode && (
          <div style={{ padding: '10px 24px', borderBottom: '1px solid rgba(245,158,11,0.1)', background: 'rgba(245,158,11,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p style={{ fontSize: '12px', color: 'rgba(251,191,36,0.7)', fontWeight: 500, margin: 0 }}>⏰ Follow-up:</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {followUps.map(c => (
                  <button key={c.id} onClick={() => goToCompany(c.id)}
                    style={{ fontSize: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#FBBF24', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div style={{ padding: '10px 24px', borderBottom: '1px solid rgba(239,68,68,0.1)', background: 'rgba(239,68,68,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '14px', color: '#F87171', margin: 0 }}>⚠ {error}</p>
              <button onClick={() => fetchCompanies()} style={{ fontSize: '12px', color: 'rgba(248,113,113,0.6)', border: '1px solid rgba(248,113,113,0.2)', padding: '4px 12px', borderRadius: '8px', background: 'none', cursor: 'pointer' }}>Retry</button>
            </div>
          </div>
        )}

        {/* STATS BAR */}
        <div style={{ padding: '8px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>
            {view === 'list'
              ? (total > 0 && !isSmartMode ? `${startItem}–${endItem} of ${total} companies` : `${total} companies`)
              : `${allCompanies.length} companies — drag to change status`}
          </p>
          {isSmartMode && <span style={{ fontSize: '12px', background: 'rgba(139,92,246,0.15)', color: '#A78BFA', padding: '2px 8px', borderRadius: '999px' }}>AI filtered</span>}
          {hasFilters && <span style={{ fontSize: '12px', background: 'rgba(79,123,247,0.15)', color: '#60A5FA', padding: '2px 8px', borderRadius: '999px' }}>Filtered</span>}
          {view === 'board' && <span style={{ fontSize: '12px', background: 'rgba(52,211,153,0.12)', color: '#34D399', padding: '2px 8px', borderRadius: '999px' }}>⊞ Board View</span>}
        </div>

        {/* ═══ LIST VIEW ═══ */}
        {view === 'list' && (
          <div style={{ flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading || smartSearching ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '96px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '32px', height: '32px', border: '2px solid rgba(79,123,247,0.3)', borderTop: '2px solid #4F7BF7', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '14px', color: 'var(--text-dim)', margin: 0 }}>{smartSearching ? 'AI searching...' : 'Loading...'}</p>
                </div>
              </div>
            ) : companies.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '96px' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>⬡</p>
                  <p style={{ fontSize: '14px', color: 'var(--text-dim)', margin: 0 }}>No companies found</p>
                </div>
              </div>
            ) : (
              <>
                {companies.map(c => {
                  const sc = STATUS_COLORS[c.status] || STATUS_COLORS.new
                  return (
                    <div key={c.id}
                      onClick={() => goToCompany(c.id)}
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, company: c }) }}
                      style={{ borderRadius: '12px', border: '1px solid var(--border)', padding: '16px', cursor: 'pointer', transition: 'all 0.15s', background: 'var(--bg-card)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.25)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0, background: 'linear-gradient(135deg, rgba(79,123,247,0.2), rgba(124,58,237,0.2))', border: '1px solid rgba(79,123,247,0.15)', color: '#7BAEF7' }}>
                          {getInitials(c.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</h3>
                            <span style={{ fontSize: '12px', opacity: 0.6 }}>{HEAT_ICON[c.heat_level]}</span>
                            {c.tags && c.tags.split(',').slice(0,2).map(tag => (
                              <span key={tag} style={{ fontSize: '10px', background: 'var(--bg-tag)', color: 'var(--text-dim)', padding: '2px 6px', borderRadius: '4px' }}>{tag.trim()}</span>
                            ))}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[c.country, c.city, c.industry].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                          <div style={{ position: 'relative', width: '32px', height: '32px' }}>
                            <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)' }}>
                              <circle cx="16" cy="16" r="13" fill="none" stroke="var(--border)" strokeWidth="2.5"/>
                              <circle cx="16" cy="16" r="13" fill="none" stroke={getScoreColor(c.opportunity_score)} strokeWidth="2.5" strokeDasharray={`${c.opportunity_score * 0.816} 100`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${getScoreColor(c.opportunity_score)}60)` }} />
                            </svg>
                            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: getScoreColor(c.opportunity_score) }}>{Math.round(c.opportunity_score)}</span>
                          </div>
                          <select value={c.status} onChange={e => updateStatus(e, c.id)} onClick={e => e.stopPropagation()}
                            style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '999px', fontWeight: 500, cursor: 'pointer', border: 'none', outline: 'none', background: sc.bg, color: sc.text }}>
                            {Object.keys(STATUS_COLORS).map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                          <button onClick={e => toggleFavorite(e, c.id)}
                            style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: c.is_favorite ? '#FBBF24' : 'var(--text-dim)', transition: 'color 0.15s' }}>★</button>
                        </div>
                      </div>
                      {c.ai_summary && (
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '8px 0 0', paddingLeft: '48px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{c.ai_summary}</p>
                      )}
                    </div>
                  )
                })}

                {/* PAGINATION */}
                {!isSmartMode && totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', paddingTop: '16px', paddingBottom: '8px' }}>
                    <button onClick={() => goToPage(page - 1)} disabled={page === 1}
                      style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: page === 1 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === 1 ? 0.4 : 1, transition: 'all 0.15s' }}>←</button>
                    {getPageNumbers().map((p, i) => (
                      p === '...' ? (
                        <span key={`dots-${i}`} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'var(--text-dim)' }}>…</span>
                      ) : (
                        <button key={p} onClick={() => goToPage(p as number)}
                          style={{ width: '34px', height: '34px', borderRadius: '8px', fontSize: '13px', fontWeight: page === p ? 600 : 400, border: page === p ? 'none' : '1px solid var(--border)', background: page === p ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'var(--bg-input)', color: page === p ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
                          {p}
                        </button>
                      )
                    ))}
                    <button onClick={() => goToPage(page + 1)} disabled={page === totalPages}
                      style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: page === totalPages ? 'var(--text-dim)' : 'var(--text-muted)', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === totalPages ? 0.4 : 1, transition: 'all 0.15s' }}>→</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ BOARD VIEW ═══ */}
        {view === 'board' && (
          <div style={{ flex: 1, padding: isMobile ? '8px' : '16px 24px', overflowY: 'auto', overflowX: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '96px' }}>
                <div style={{ width: '32px', height: '32px', border: '2px solid rgba(79,123,247,0.3)', borderTop: '2px solid #4F7BF7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px' }}>
                  {/* ROW 1 */}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: isMobile ? 'flex-start' : 'center', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? '8px' : 0 }}>
                    {KANBAN_ROW1.map(status => (
                      <KanbanColumn
                        key={status}
                        status={status}
                        companies={allCompanies.filter(c => c.status === status)}
                        onFavorite={toggleFavorite}
                        onClick={goToCompany}
                        isOver={overColumn === status}
                      />
                    ))}
                  </div>
                  {/* DIVIDER */}
                  <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, var(--border-mid), transparent)', margin: '4px 0' }} />
                  {/* ROW 2 — centered */}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: isMobile ? 'flex-start' : 'center', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? '8px' : 0 }}>
                    {KANBAN_ROW2.map(status => (
                      <KanbanColumn
                        key={status}
                        status={status}
                        companies={allCompanies.filter(c => c.status === status)}
                        onFavorite={toggleFavorite}
                        onClick={goToCompany}
                        isOver={overColumn === status}
                      />
                    ))}
                  </div>
                </div>

                {/* DRAG OVERLAY */}
                <DragOverlay>
                  {activeCompany ? (
                    <div style={{ borderRadius: '10px', border: '1px solid rgba(79,123,247,0.5)', background: 'var(--bg-card)', padding: '12px', width: '220px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', opacity: 0.95 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{activeCompany.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }}>{activeCompany.country} · {activeCompany.industry}</p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        )}
      </div>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div style={{ position: 'fixed', zIndex: 50, borderRadius: '12px', border: '1px solid var(--border)', padding: '4px', width: '192px', background: 'var(--bg-card)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contextMenu.company.name}</p>
          </div>
          {[
            { label: '👁 View', action: () => { goToCompany(contextMenu.company.id); setContextMenu(null) } },
            { label: '✏️ Edit', action: () => { window.location.href = `/edit?id=${contextMenu.company.id}`; setContextMenu(null) } },
            { label: '✉ Generate Email', action: () => { window.location.href = `/company/${contextMenu.company.id}`; setContextMenu(null) } },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '14px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', transition: 'all 0.15s', display: 'block' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}>
              {item.label}
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <p style={{ padding: '4px 12px', fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Status</p>
          {['reviewed','ready','sent','replied','archive'].map(s => (
            <button key={s} onClick={() => quickUpdateStatus(contextMenu.company.id, s)}
              style={{ width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: '12px', color: contextMenu.company.status === s ? '#60A5FA' : 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
              {contextMenu.company.status === s ? '✓ ' : '○ '}{s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
