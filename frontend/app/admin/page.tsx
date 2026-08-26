'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import AdminSideNav from '../components/AdminSideNav'
import GrowthChart from '../components/GrowthChart'
import AdminUsersPanel from '../components/AdminUsersPanel'
import { useIsMobile } from '../hooks/useIsMobile'
import { Upload, Download, RefreshCw, Flame, BookOpen, AlertTriangle, Users as UsersIcon } from 'lucide-react'
import InlineStatus from '../components/InlineStatus'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface Stats {
  total_companies: number
  emails_sent: number
  reply_rate: number
  clients_won: number
}

interface AtRiskUser { id: number; name: string; email: string; plan: string; reasons: string[] }

export default function AdminPanel() {
  const isMobile = useIsMobile()
  const [recalculating, setRecalculating] = useState(false)
  const [recalcMsg, setRecalcMsg] = useState('')
  const [recalcHeating, setRecalcHeating] = useState(false)
  const [heatMsg, setHeatMsg] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [userCount, setUserCount] = useState(0)
  const [revenue, setRevenue] = useState<{ all_time_usd: number; this_week_usd: number; this_month_usd: number; mrr_usd: number } | null>(null)
  const [atRisk, setAtRisk] = useState<AtRiskUser[]>([])
  const [view, setView] = useState<'overview' | 'users'>('overview')

  // Deep-link support for the embedded Users view (e.g. from the command palette)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'users') setView('users')
  }, [])

  // Admin-only page — members who navigate here directly get sent back
  useEffect(() => {
    try {
      const stored = localStorage.getItem('archon-user')
      if (stored && JSON.parse(stored).role !== 'admin') window.location.href = '/dashboard'
    } catch {}
  }, [])

  useEffect(() => {
    axios.get(`${API}/companies/analytics/summary`).then(res => {
      const d = res.data
      setStats({
        total_companies: d.total_companies,
        emails_sent: d.emails?.sent || 0,
        reply_rate: d.emails?.sent > 0 ? Math.round((d.emails.replied / d.emails.sent) * 100) : 0,
        clients_won: d.status_counts?.client || 0,
      })
    }).catch(() => {})
    axios.get(`${API}/auth/users`, { headers: headers() }).then(res => {
      setUserCount(Array.isArray(res.data) ? res.data.length : 0)
    }).catch(() => {})
    axios.get(`${API}/auth/admin/revenue/summary`, { headers: headers() }).then(res => setRevenue(res.data)).catch(() => {})
    axios.get(`${API}/auth/admin/at-risk-users`, { headers: headers() }).then(res => setAtRisk(res.data.users || [])).catch(() => {})
  }, [])

  // CSV export needs the auth header, so it can't be a plain window.open
  const exportCsv = async () => {
    try {
      const res = await axios.get(`${API}/companies/export/csv`, { headers: headers(), responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = `archon_export_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed')
    }
  }

  const exportUsers = async () => {
    try {
      const res = await axios.get(`${API}/auth/users/export`, { headers: headers(), responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = `archon_users_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed')
    }
  }

  const recalcScores = async () => {
    setRecalculating(true); setRecalcMsg('')
    try {
      const res = await axios.post(`${API}/companies/recalculate-scores`)
      const g = res.data.grades
      setRecalcMsg(g ? `✓ ${res.data.message} — A:${g.A} B:${g.B} C:${g.C} D:${g.D}` : `✓ ${res.data.message}`)
    } catch { setRecalcMsg('✗ Error') }
    setRecalculating(false)
  }

  const recalcHeat = async () => {
    setRecalcHeating(true); setHeatMsg('')
    try {
      const res = await axios.post(`${API}/companies/recalculate-heat`)
      const c = res.data.counts
      setHeatMsg(`✓ 🔥${c.hot} 🌤${c.warm} ❄️${c.cold} across all ${res.data.total} companies — ${res.data.engaged} in your pipeline, ${res.data.changed} changed`)
    } catch (e: any) { setHeatMsg(`✗ ${e.response?.data?.detail || 'Error'}`) }
    setRecalcHeating(false)
  }

  const kpiCards = [
    { label: 'Companies', value: stats?.total_companies ?? '—' },
    { label: 'Users', value: userCount || '—' },
    { label: 'Emails Sent', value: stats?.emails_sent ?? '—' },
    { label: 'Clients Won', value: stats?.clients_won ?? '—' },
  ]

  // Only tools with no equivalent in the Sidebar's own Admin/Workspace nav.
  const tools = [
    { Icon: Upload, title: 'Import CSV', desc: 'Bulk import companies from spreadsheet', action: () => window.location.href = '/import', label: 'Open Import' },
    { Icon: Download, title: 'Export CSV', desc: 'Download all companies as CSV file', action: exportCsv, label: 'Download CSV' },
    { Icon: RefreshCw, title: 'Recalculate Scores', desc: 'Re-score every company with the current weights.', action: recalcScores, label: recalculating ? 'Recalculating...' : 'Recalculate All', msg: recalcMsg, disabled: recalculating },
    { Icon: Flame, title: 'Recalculate Heat', desc: 'Refresh hot / warm / cold across your pipeline.', action: recalcHeat, label: recalcHeating ? 'Recalculating...' : 'Recalculate Heat', msg: heatMsg, disabled: recalcHeating },
    { Icon: BookOpen, title: 'API Documentation', desc: 'FastAPI Swagger UI for developers', action: () => window.open(`${API}/docs`, '_blank'), label: 'Open Docs' },
    { Icon: UsersIcon, title: 'Export Users', desc: 'Download every user (plan, activity, signup) as a spreadsheet', action: exportUsers, label: 'Download Excel/CSV' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', minWidth: 0, marginTop: isMobile ? '52px' : 0, height: isMobile ? 'calc(100vh - 52px)' : '100vh', overflowY: 'auto' }}>

        <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{view === 'users' ? 'Users' : 'Admin Panel'}</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>{view === 'users' ? 'Manage every account on the platform' : 'Platform management and system tools'}</p>
          </div>
        </div>

        <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>
          {!isMobile && <AdminSideNav active="/admin" usersView={view === 'users'} onUsersClick={() => setView('users')} />}

          {view === 'users' ? (
            <main style={{ flex: 1, minWidth: 0 }}>
              <AdminUsersPanel />
            </main>
          ) : (
          <main style={{ flex: 1, minWidth: 0 }}>
            {/* KPI CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '10px' : '16px', marginBottom: '20px' }}>
              {kpiCards.map(k => (
                <div key={k.label} style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: isMobile ? '14px 16px' : '18px 20px' }}>
                  <p className="mono" style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{k.value}</p>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>{k.label}</p>
                </div>
              ))}
            </div>

            {/* REVENUE SUMMARY */}
            <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: isMobile ? '16px' : '18px 22px', marginBottom: '20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '14px' : '24px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '16px' : '32px' }}>
                {([
                  ['All-time revenue', revenue?.all_time_usd],
                  ['This month', revenue?.this_month_usd],
                  ['This week', revenue?.this_week_usd],
                  ['Est. MRR', revenue?.mrr_usd],
                ] as [string, number | undefined][]).map(([label, value]) => (
                  <div key={label}>
                    <p style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{label}</p>
                    <p className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                      {value === undefined ? '—' : `$${value.toLocaleString('en-US')}`}
                    </p>
                  </div>
                ))}
              </div>
              <a href="/admin/revenue" style={{ flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                View full revenue →
              </a>
            </div>

            {/* GROWTH + AT RISK */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: '16px', marginBottom: '24px', alignItems: 'stretch' }}>
              <GrowthChart />

              <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={15} strokeWidth={1.5} color="var(--warning)" /> At-risk users
                </h2>
                {atRisk.length === 0 ? (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>Nobody looks at-risk right now.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '200px' }}>
                    {atRisk.slice(0, 8).map(u => (
                      <button key={u.id} onClick={() => setView('users')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: 'none', cursor: 'pointer' }}>
                        <p style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{u.name} <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>· {u.plan}</span></p>
                        <p style={{ fontSize: '11px', color: 'var(--warning)', margin: '2px 0 0' }}>{u.reasons.join(', ')}</p>
                      </button>
                    ))}
                    {atRisk.length > 8 && <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>+{atRisk.length - 8} more</p>}
                  </div>
                )}
              </div>
            </div>

            {/* TOOLS GRID */}
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '16px' }}>Tools & Actions</p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '10px' : '14px', paddingBottom: '40px' }}>
              {tools.map((tool) => (
                <div key={tool.title} style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <tool.Icon size={16} strokeWidth={1.5} color="var(--text-muted)" />
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '0 0 3px' }}>{tool.title}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0, lineHeight: 1.4 }}>{tool.desc}</p>
                    </div>
                  </div>
                  <button onClick={tool.action} disabled={'disabled' in tool ? tool.disabled : false}
                    style={{ marginTop: 'auto', width: '100%', padding: '9px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: tool.disabled ? 'not-allowed' : 'pointer', color: 'white', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', border: 'none', opacity: tool.disabled ? 0.5 : 1 }}>
                    {tool.label}
                  </button>
                  {'msg' in tool && tool.msg && (
                    <div style={{ marginTop: '8px', textAlign: 'center' }}><InlineStatus text={tool.msg} size={11} /></div>
                  )}
                </div>
              ))}
            </div>
          </main>
          )}
        </div>
      </div>
    </div>
  )
}
