'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface PlanLimit {
  plan: string
  max_companies: number
  max_emails_per_month: number
  period_days: number
}

interface Stats {
  total_companies: number
  total_users?: number
  active_users?: number
  emails_sent: number
  reply_rate: number
  clients_won: number
}

export default function AdminPanel() {
  const isMobile = useIsMobile()
  const [recalculating, setRecalculating] = useState(false)
  const [recalcMsg, setRecalcMsg] = useState('')
  const [backing, setBacking] = useState(false)
  const [backMsg, setBackMsg] = useState('')
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [planLimits, setPlanLimits] = useState<PlanLimit[]>([])
  const [savingPlan, setSavingPlan] = useState<string | null>(null)
  const [limitMsg, setLimitMsg] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [userCount, setUserCount] = useState(0)

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
    axios.get(`${API}/auth/plan-limits`, { headers: headers() }).then(res => {
      setPlanLimits(res.data.sort((a: PlanLimit, b: PlanLimit) =>
        ['trial', 'basic', 'pro', 'agency'].indexOf(a.plan) - ['trial', 'basic', 'pro', 'agency'].indexOf(b.plan)))
    }).catch(() => {})
  }, [])

  const savePlanLimit = async (pl: PlanLimit) => {
    setLimitMsg(''); setSavingPlan(pl.plan)
    try {
      await axios.put(`${API}/auth/plan-limits/${pl.plan}`, {
        max_companies: pl.max_companies,
        max_emails_per_month: pl.max_emails_per_month,
        period_days: pl.period_days,
      }, { headers: headers() })
      setLimitMsg(`✓ ${pl.plan} limits saved`)
    } catch (e: any) {
      setLimitMsg(`✗ ${e.response?.data?.detail || 'Save failed'}`)
    }
    setSavingPlan(null)
  }

  const setPl = (plan: string, field: keyof PlanLimit, value: number) => {
    setPlanLimits(prev => prev.map(p => p.plan === plan ? { ...p, [field]: value } : p))
  }

  const runBackup = async () => {
    setBacking(true); setBackMsg(''); setLastBackup(null)
    try {
      const res = await axios.post(`${API}/companies/backup/run`, {}, { headers: headers() })
      const totalRows = Object.values(res.data.row_counts as Record<string, number>).reduce((a, b) => a + b, 0)
      setBackMsg(`✓ Saved ${res.data.filename} (${res.data.size_kb} KB, ${totalRows} rows)`)
      setLastBackup(res.data.filename)
    } catch {
      setBackMsg('✗ Backup failed — check server logs')
    }
    setBacking(false)
  }

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

  // Downloads through axios so the auth header is sent, then saves via a blob URL
  const downloadBackup = async (filename: string) => {
    try {
      const res = await axios.get(`${API}/companies/backup/download/${filename}`, { headers: headers(), responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch {
      setBackMsg('✗ Download failed')
    }
  }

  const recalcScores = async () => {
    setRecalculating(true); setRecalcMsg('')
    try { const res = await axios.post(`${API}/companies/recalculate-scores`); setRecalcMsg(res.data.message) }
    catch { setRecalcMsg('Error') }
    setRecalculating(false)
  }

  const kpiCards = [
    { icon: '🏢', label: 'Companies', value: stats?.total_companies ?? '—', color: '#4F7BF7', bg: 'rgba(79,123,247,0.08)', border: 'rgba(79,123,247,0.15)' },
    { icon: '👥', label: 'Users', value: userCount || '—', color: '#A78BFA', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.15)' },
    { icon: '✉', label: 'Emails Sent', value: stats?.emails_sent ?? '—', color: '#34D399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.15)' },
    { icon: '🏆', label: 'Clients Won', value: stats?.clients_won ?? '—', color: '#FBBF24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.15)' },
  ]

  const tools = [
    {
      icon: '📥', title: 'Import CSV', desc: 'Bulk import companies from spreadsheet',
      color: '#60A5FA', bg: 'rgba(79,123,247,0.08)', border: 'rgba(79,123,247,0.15)',
      action: () => window.location.href = '/import',
      label: 'Open Import',
    },
    {
      icon: '📤', title: 'Export CSV', desc: 'Download all companies as CSV file',
      color: '#34D399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.15)',
      action: exportCsv,
      label: 'Download CSV',
    },
    {
      icon: '🔄', title: 'Recalculate Scores', desc: 'Recompute opportunity scores for all companies',
      color: '#FBBF24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)',
      action: recalcScores,
      label: recalculating ? 'Recalculating...' : 'Recalculate All',
      msg: recalcMsg, msgColor: '#34D399',
      disabled: recalculating,
    },
    {
      icon: '💾', title: 'Manual Backup', desc: 'Full database export, saved on the server',
      color: '#A78BFA', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.15)',
      action: runBackup,
      label: backing ? 'Backing up...' : 'Run Backup',
      msg: backMsg, msgColor: backMsg.startsWith('✓') ? '#34D399' : 'var(--text-muted)',
      disabled: backing,
    },
    {
      icon: '📊', title: 'Weekly AI Report', desc: 'AI-powered business development summary',
      color: '#60A5FA', bg: 'rgba(79,123,247,0.08)', border: 'rgba(79,123,247,0.15)',
      action: () => window.location.href = '/report',
      label: 'Generate Report',
    },
    {
      icon: '👥', title: 'User Management', desc: 'Manage subscribers, plans and permissions',
      color: '#F472B6', bg: 'rgba(244,114,182,0.08)', border: 'rgba(244,114,182,0.15)',
      action: () => window.location.href = '/users',
      label: 'Manage Users',
    },
    {
      icon: '📈', title: 'Analytics', desc: 'Full pipeline and performance report',
      color: '#22D3EE', bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.15)',
      action: () => window.location.href = '/analytics',
      label: 'View Analytics',
    },
    {
      icon: '📖', title: 'API Documentation', desc: 'FastAPI Swagger UI for developers',
      color: 'var(--text-muted)', bg: 'var(--bg-input)', border: 'var(--border)',
      action: () => window.open(`${API}/docs`, '_blank'),
      label: 'Open Docs',
    },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', minWidth: 0, paddingTop: isMobile ? '52px' : 0 }}>

        {/* STICKY HEADER */}
        <div style={{ position: 'sticky', top: isMobile ? '52px' : 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', transition: 'background 0.25s' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Admin Panel</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>Platform management and system tools</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Archon v0.2.0</span>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399', boxShadow: '0 0 6px #34D39980' }} />
          </div>
        </div>

        <div style={{ padding: isMobile ? '0 16px' : '0 40px 0', maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ marginBottom: '0' }}>

          {/* KPI CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '10px' : '16px', marginBottom: '24px', marginTop: '24px' }}>
            {kpiCards.map(k => (
              <div key={k.label} style={{
                borderRadius: '16px', border: `1px solid ${k.border}`,
                background: k.bg, padding: isMobile ? '14px 16px' : '20px 24px',
                position: 'relative', overflow: 'hidden',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${k.border}` }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: k.color, opacity: 0.06 }} />
                <p style={{ fontSize: isMobile ? '22px' : '28px', margin: isMobile ? '0 0 8px' : '0 0 12px' }}>{k.icon}</p>
                <p style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 800, color: k.color, margin: '0 0 4px', letterSpacing: '-0.02em' }}>{k.value}</p>
                <p style={{ fontSize: isMobile ? '11px' : '12px', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>{k.label}</p>
              </div>
            ))}
          </div>

          </div>

          {/* TOOLS GRID */}
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '16px', marginTop: '0' }}>Tools & Actions</p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: isMobile ? '10px' : '14px', paddingBottom: '40px' }}>
            {tools.map((tool) => (
              <div key={tool.title} style={{
                borderRadius: '16px', border: `1px solid ${tool.border}`,
                background: 'var(--bg-card)', padding: '20px',
                display: 'flex', flexDirection: 'column',
                transition: 'all 0.2s', cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = tool.color + '50'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = tool.border; e.currentTarget.style.transform = 'none' }}>

                {/* ICON + TITLE */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: tool.bg, border: `1px solid ${tool.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                    {tool.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '0 0 3px' }}>{tool.title}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0, lineHeight: 1.4 }}>{tool.desc}</p>
                  </div>
                </div>

                {/* BUTTON */}
                <button
                  onClick={tool.action}
                  disabled={'disabled' in tool ? tool.disabled : false}
                  style={{
                    marginTop: 'auto', width: '100%', padding: '9px',
                    borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                    cursor: tool.disabled ? 'not-allowed' : 'pointer',
                    color: tool.color, background: tool.bg,
                    border: `1px solid ${tool.border}`,
                    transition: 'all 0.15s',
                    opacity: tool.disabled ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!tool.disabled) { e.currentTarget.style.opacity = '0.8' } }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = tool.disabled ? '0.5' : '1' }}>
                  {tool.label}
                </button>

                {'msg' in tool && tool.msg && (
                  <p style={{ fontSize: '11px', color: tool.msgColor, marginTop: '8px', marginBottom: 0, textAlign: 'center' }}>{tool.msg}</p>
                )}

                {/* Backups live on the server volume — offer a download so a copy
                    can be kept off Railway */}
                {tool.title === 'Manual Backup' && lastBackup && (
                  <button onClick={() => downloadBackup(lastBackup)}
                    style={{ marginTop: '8px', width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', cursor: 'pointer' }}>
                    ⬇ Download backup file
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* ── PLAN LIMITS EDITOR ── */}
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px', marginTop: '28px' }}>Plan Limits</p>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 16px' }}>
            Edit quotas per plan. Changes apply immediately to everyone on that plan. Use <strong>-1</strong> for unlimited.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px', paddingBottom: '40px' }}>
            {planLimits.map(pl => (
              <div key={pl.plan} style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{pl.plan}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {([
                    ['Max companies', 'max_companies'],
                    ['Emails per period', 'max_emails_per_month'],
                    ['Period (days)', 'period_days'],
                  ] as [string, keyof PlanLimit][]).map(([label, field]) => (
                    <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <label style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{label}</label>
                      <input type="number" value={pl[field] as number}
                        onChange={e => setPl(pl.plan, field, parseInt(e.target.value || '0', 10))}
                        style={{ width: '110px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', color: 'var(--text)', outline: 'none', textAlign: 'right' }} />
                    </div>
                  ))}
                </div>
                <button onClick={() => savePlanLimit(pl)} disabled={savingPlan === pl.plan}
                  style={{ marginTop: '14px', width: '100%', padding: '9px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer', opacity: savingPlan === pl.plan ? 0.6 : 1 }}>
                  {savingPlan === pl.plan ? 'Saving…' : 'Save'}
                </button>
              </div>
            ))}
          </div>
          {limitMsg && <p style={{ fontSize: '12px', color: limitMsg.startsWith('✓') ? '#34D399' : '#F87171', marginTop: '-24px', marginBottom: '24px' }}>{limitMsg}</p>}
        </div>
      </div>
    </div>
  )
}
