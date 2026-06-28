'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'

const API = 'http://localhost:8000'

const STATUS_META: Record<string, { color: string; label: string; emoji: string }> = {
  new:      { color: '#4F7BF7', label: 'New',      emoji: '🆕' },
  reviewed: { color: '#8B5CF6', label: 'Reviewed', emoji: '👁' },
  ready:    { color: '#F59E0B', label: 'Ready',    emoji: '✅' },
  sent:     { color: '#F97316', label: 'Sent',     emoji: '📤' },
  waiting:  { color: '#64748B', label: 'Waiting',  emoji: '⏳' },
  replied:  { color: '#34D399', label: 'Replied',  emoji: '💬' },
  meeting:  { color: '#14B8A6', label: 'Meeting',  emoji: '🤝' },
  client:   { color: '#10B981', label: 'Client',   emoji: '🏆' },
  archive:  { color: '#EF4444', label: 'Archive',  emoji: '🗃' },
}

interface Analytics {
  total_companies: number; favorites: number
  status_counts: Record<string, number>
  industries: { name: string; count: number }[]
  top_countries: { name: string; count: number }[]
  emails: { total: number; sent: number; replied: number }
}

// Animated number component
function AnimNum({ value, color }: { value: number | string; color: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const num = typeof value === 'number' ? value : parseFloat(String(value))
    if (isNaN(num)) { return }
    let start = 0
    const step = num / 30
    const timer = setInterval(() => {
      start += step
      if (start >= num) { setDisplay(num); clearInterval(timer) }
      else setDisplay(Math.floor(start))
    }, 20)
    return () => clearInterval(timer)
  }, [value])
  return <span style={{ color }}>{typeof value === 'string' && value.includes('%') ? `${display}%` : display}</span>
}

// Mini bar chart
function MiniBar({ pct, color }: { pct: number; color: string }) {
  const [width, setWidth] = useState(0)
  useEffect(() => { setTimeout(() => setWidth(pct), 100) }, [pct])
  return (
    <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: '999px', transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
    </div>
  )
}

// Donut chart
function DonutChart({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  const size = 140; const r = 50; const cx = size / 2; const cy = size / 2
  const circumference = 2 * Math.PI * r
  let offset = 0
  const segments = data.filter(d => d.value > 0).map(d => {
    const pct = d.value / total
    const seg = { ...d, pct, dasharray: pct * circumference, offset }
    offset += pct * circumference
    return seg
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="16" />
      {segments.map((seg, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={seg.color} strokeWidth="16"
          strokeDasharray={`${seg.dasharray} ${circumference}`}
          strokeDashoffset={-seg.offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.16,1,0.3,1)' }} />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="var(--text-dim)" fontFamily="Arial">companies</text>
    </svg>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<{total: number; done: number}>({ total: 0, done: 0 })

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/companies/analytics/summary`),
      axios.get(`${API}/companies/tasks/today`).catch(() => ({ data: [] })),
    ]).then(([analytics, tasksRes]) => {
      setData(analytics.data)
      const t = Array.isArray(tasksRes.data) ? tasksRes.data : []
      setTasks({ total: t.length, done: t.filter((x: any) => x.is_done).length })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '224px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div className="spinner" />
        <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Loading analytics...</p>
      </div>
    </div>
  )
  if (!data) return null

  const maxInd = Math.max(...data.industries.map(i => i.count), 1)
  const maxCo = Math.max(...data.top_countries.map(c => c.count), 1)
  const replyRate = data.emails.sent > 0 ? Math.round((data.emails.replied / data.emails.sent) * 100) : 0
  const active = Object.entries(data.status_counts).filter(([s]) => !['archive','new'].includes(s)).reduce((a,[,v]) => a + v, 0)
  const conversion = data.total_companies > 0 ? Math.round((data.status_counts.client || 0) / data.total_companies * 100) : 0
  const taskPct = tasks.total > 0 ? Math.round((tasks.done / tasks.total) * 100) : 0

  const donutData = Object.entries(data.status_counts)
    .filter(([,v]) => v > 0)
    .map(([k, v]) => ({ label: k, value: v, color: STATUS_META[k]?.color || '#64748B' }))

  const KPI = ({ icon, label, value, sub, color, bg }: any) => (
    <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = color + '40' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}>
      <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: color, opacity: 0.08 }} />
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>{icon}</div>
      <p style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
        <AnimNum value={value} color={color} />
      </p>
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>{sub}</p>
    </div>
  )

  return (
    <div className="page-enter" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '224px' }}>

        {/* HEADER */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', transition: 'background 0.25s' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Analytics</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>Business development performance</p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {tasks.total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px' }}>
                <div style={{ width: '48px', height: '4px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${taskPct}%`, background: taskPct === 100 ? '#34D399' : '#4F7BF7', borderRadius: '999px', transition: 'width 0.8s' }} />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Tasks {tasks.done}/{tasks.total}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>

          {/* KPI GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <KPI icon="🏢" label="Total Companies" value={data.total_companies} sub={`${data.favorites} favorites`} color="#4F7BF7" bg="rgba(79,123,247,0.12)" />
            <KPI icon="⚡" label="Active Pipeline" value={active} sub="in progress" color="#F59E0B" bg="rgba(245,158,11,0.12)" />
            <KPI icon="💬" label="Reply Rate" value={`${replyRate}%`} sub={`${data.emails.replied} of ${data.emails.sent} sent`} color="#34D399" bg="rgba(52,211,153,0.12)" />
            <KPI icon="🏆" label="Clients Won" value={data.status_counts.client || 0} sub={`${conversion}% conversion`} color="#A78BFA" bg="rgba(167,139,250,0.12)" />
          </div>

          {/* MAIN ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '16px' }}>

            {/* DONUT + PIPELINE */}
            <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Pipeline Distribution</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <DonutChart data={donutData} total={data.total_companies} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(data.status_counts).filter(([,v]) => v > 0).sort(([,a],[,b]) => b-a).map(([s, count]) => {
                  const meta = STATUS_META[s]
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px' }}>{meta?.emoji}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '70px' }}>{meta?.label || s}</span>
                      <div style={{ flex: 1 }}><MiniBar pct={(count / data.total_companies) * 100} color={meta?.color || '#64748B'} /></div>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', width: '24px', textAlign: 'right' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* EMAIL + TASKS + INSIGHTS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* EMAIL STATS */}
              <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Email Campaign</p>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: replyRate > 20 ? '#34D399' : '#F59E0B' }}>{replyRate}% reply rate</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {[
                    { label: 'Generated', value: data.emails.total, color: '#4F7BF7' },
                    { label: 'Sent', value: data.emails.sent, color: '#F97316' },
                    { label: 'Replied', value: data.emails.replied, color: '#34D399' },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-input)', borderRadius: '10px' }}>
                      <p style={{ fontSize: '22px', fontWeight: 800, color: item.color, margin: '0 0 4px' }}><AnimNum value={item.value} color={item.color} /></p>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* TASKS WIDGET */}
              {tasks.total > 0 && (
                <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', position: 'relative', flexShrink: 0 }}>
                    <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="24" cy="24" r="20" fill="none" stroke="var(--border)" strokeWidth="4" />
                      <circle cx="24" cy="24" r="20" fill="none" stroke={taskPct === 100 ? '#34D399' : '#4F7BF7'} strokeWidth="4"
                        strokeDasharray={`${taskPct * 1.257} 200`} strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 0.8s' }} />
                    </svg>
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: taskPct === 100 ? '#34D399' : '#4F7BF7' }}>{taskPct}%</span>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>Today's Tasks</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>{tasks.done} of {tasks.total} completed {taskPct === 100 ? '🎉' : ''}</p>
                  </div>
                  <button onClick={() => window.location.href = '/tasks'}
                    style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA'; e.currentTarget.style.borderColor = 'rgba(79,123,247,0.4)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                    View Tasks →
                  </button>
                </div>
              )}

              {/* QUICK INSIGHTS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {[
                  { icon: '📬', label: 'Outreach Rate', value: data.total_companies > 0 ? `${Math.round((data.emails.sent/data.total_companies)*100)}%` : '0%', color: '#60A5FA' },
                  { icon: '🎯', label: 'Hot Leads', value: data.status_counts.ready || 0, color: '#FBBF24' },
                  { icon: '⏳', label: 'Awaiting Reply', value: data.status_counts.waiting || 0, color: '#9CA3AF' },
                  { icon: '🤝', label: 'In Meeting', value: data.status_counts.meeting || 0, color: '#2DD4BF' },
                ].map(item => (
                  <div key={item.label} style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = item.color + '40'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}>
                    <span style={{ fontSize: '24px' }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: '18px', fontWeight: 800, color: item.color, margin: 0 }}><AnimNum value={item.value} color={item.color} /></p>
                      <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: 0 }}>{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM ROW — Industries + Countries */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Top Industries</p>
              {data.industries.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>No data yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.industries.map((item, i) => {
                    const colors = ['#4F7BF7','#8B5CF6','#34D399','#F59E0B','#F97316']
                    return (
                      <div key={item.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.name}</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: colors[i%5] }}>{item.count}</span>
                        </div>
                        <MiniBar pct={(item.count/maxInd)*100} color={colors[i%5]} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Top Countries</p>
              {data.top_countries.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>No data yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.top_countries.map((item, i) => (
                    <div key={item.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>#{i+1} {item.name}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#34D399' }}>{item.count}</span>
                      </div>
                      <MiniBar pct={(item.count/maxCo)*100} color="#34D399" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
