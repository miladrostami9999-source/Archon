'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import { useIsMobile } from '../../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface Summary { all_time_usd: number; this_week_usd: number; this_month_usd: number; mrr_usd: number }
interface TimeseriesPoint {
  period_start: string; period_end: string | null; total_usd: number
  breakdown: Record<string, number>; approved_count: number; in_progress?: boolean
}

const PLAN_COLORS: Record<string, string> = { trial: '#9CA3AF', basic: '#60A5FA', pro: '#A78BFA', agency: '#34D399' }

export default function AdminRevenuePage() {
  const isMobile = useIsMobile()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [items, setItems] = useState<TimeseriesPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('archon-user')
      if (stored && JSON.parse(stored).role !== 'admin') window.location.href = '/dashboard'
    } catch {}
  }, [])

  useEffect(() => {
    axios.get(`${API}/auth/admin/revenue/summary`, { headers: headers() }).then(res => setSummary(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    axios.get(`${API}/auth/admin/revenue/timeseries`, { headers: headers(), params: { period, limit: 12 } })
      .then(res => setItems(res.data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [period])

  const maxTotal = Math.max(1, ...items.map(i => i.total_usd))
  const latestBreakdown = items.length > 0 ? items[items.length - 1].breakdown : {}
  const latestTotal = items.length > 0 ? items[items.length - 1].total_usd : 0

  const formatPeriodLabel = (iso: string) => {
    const d = new Date(iso)
    return period === 'week'
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', minWidth: 0, marginTop: isMobile ? '52px' : 0, height: isMobile ? 'calc(100vh - 52px)' : '100vh', overflowY: 'auto' }}>

        <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px', padding: isMobile ? '0 16px' : '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <a href="/admin" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>← Admin</a>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Revenue</h1>
        </div>

        <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', maxWidth: '1000px', margin: '0 auto' }}>

          {/* KPI ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '10px' : '16px', marginBottom: '28px' }}>
            {([
              ['All-time revenue', summary?.all_time_usd, '#3D4FE0'],
              ['Estimated MRR', summary?.mrr_usd, '#A78BFA'],
              ['This month', summary?.this_month_usd, '#34D399'],
              ['This week', summary?.this_week_usd, '#FBBF24'],
            ] as [string, number | undefined, string][]).map(([label, value, color]) => (
              <div key={label} style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: isMobile ? '14px 16px' : '18px 20px' }}>
                <p style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{label}</p>
                <p className="mono" style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 800, color, margin: 0 }}>
                  {value === undefined ? '—' : `$${value.toLocaleString('en-US')}`}
                </p>
              </div>
            ))}
          </div>

          {/* TREND */}
          <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: isMobile ? '16px' : '24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Revenue trend</h2>
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px' }}>
                {(['week', 'month'] as const).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    style={{ padding: '6px 16px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, border: 'none', cursor: 'pointer', background: period === p ? 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' : 'transparent', color: period === p ? 'white' : 'var(--text-muted)' }}>
                    {p === 'week' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Loading…</p>
            ) : items.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No revenue data yet.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? '6px' : '10px', height: '160px', overflowX: 'auto' }}>
                {items.map(it => (
                  <div key={it.period_start} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 0 auto', minWidth: isMobile ? '32px' : '48px', gap: '6px' }}>
                    <span className="mono" style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{it.total_usd > 0 ? `$${Math.round(it.total_usd)}` : ''}</span>
                    <div style={{
                      width: '100%', maxWidth: '36px', borderRadius: '6px 6px 0 0',
                      height: `${Math.max(3, (it.total_usd / maxTotal) * 110)}px`,
                      background: it.in_progress ? 'var(--accent-dim)' : 'linear-gradient(180deg, #3D4FE0, #2E3BB0)',
                      border: it.in_progress ? '1px dashed var(--accent)' : 'none',
                    }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{formatPeriodLabel(it.period_start)}</span>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '16px 0 0' }}>
              The dashed bar is the current, still-open {period}. Completed periods are finalized automatically at the start of each {period === 'week' ? 'week' : 'Gregorian month'} (Tehran time).
            </p>
          </div>

          {/* BREAKDOWN */}
          <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: isMobile ? '16px' : '24px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>
              Breakdown by plan — current {period}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(latestBreakdown).filter(([, v]) => v > 0).length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No approved payments in this period yet.</p>
              ) : Object.entries(latestBreakdown).map(([plan, amount]) => (
                <div key={plan} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '70px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize', flexShrink: 0 }}>{plan}</span>
                  <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'var(--bg-input)', overflow: 'hidden' }}>
                    <div style={{ width: `${latestTotal > 0 ? (amount / latestTotal) * 100 : 0}%`, height: '100%', background: PLAN_COLORS[plan] || '#60A5FA', borderRadius: '999px' }} />
                  </div>
                  <span className="mono" style={{ fontSize: '12.5px', color: 'var(--text-muted)', width: '70px', textAlign: 'right', flexShrink: 0 }}>${amount.toLocaleString('en-US')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
