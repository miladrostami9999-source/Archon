'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'

const API = 'http://localhost:8000'

interface Analytics {
  total_companies: number
  favorites: number
  status_counts: Record<string, number>
  industries: { name: string; count: number }[]
  top_countries: { name: string; count: number }[]
  emails: { total: number; sent: number; replied: number }
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  new:      { color: '#4F7BF7', label: 'New' },
  reviewed: { color: '#8B5CF6', label: 'Reviewed' },
  ready:    { color: '#F59E0B', label: 'Ready' },
  sent:     { color: '#F97316', label: 'Sent' },
  waiting:  { color: '#64748B', label: 'Waiting' },
  replied:  { color: '#34D399', label: 'Replied' },
  meeting:  { color: '#14B8A6', label: 'Meeting' },
  client:   { color: '#10B981', label: 'Client' },
  archive:  { color: '#EF4444', label: 'Archive' },
}

const card: React.CSSProperties = {
  borderRadius: '12px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  padding: '20px',
}

export default function Analytics() {
  const isMobile = useIsMobile()

  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API}/companies/analytics/summary`)
      .then(res => { setData(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid rgba(79,123,247,0.3)', borderTop: '2px solid #4F7BF7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    </div>
  )

  if (!data) return null

  const maxIndustry = Math.max(...data.industries.map(i => i.count), 1)
  const maxCountry = Math.max(...data.top_countries.map(c => c.count), 1)
  const replyRate = data.emails.sent > 0 ? Math.round((data.emails.replied / data.emails.sent) * 100) : 0
  const activeCompanies = Object.entries(data.status_counts)
    .filter(([s]) => !['archive', 'new'].includes(s))
    .reduce((a, [, v]) => a + v, 0)
  const conversionRate = data.total_companies > 0
    ? Math.round((data.status_counts.client || 0) / data.total_companies * 100) : 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', paddingTop: isMobile ? '52px' : 0 }}>

        {/* HEADER */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          padding: '16px 32px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-main)', backdropFilter: 'blur(12px)',
          transition: 'background 0.25s, border-color 0.25s',
        }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '2px 0 0' }}>Business development performance</p>
        </div>

        <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '1000px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* KPI CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'Total Companies', value: data.total_companies, icon: '🏢', color: '#4F7BF7', sub: `${data.favorites} favorites` },
              { label: 'Active Pipeline', value: activeCompanies, icon: '⚡', color: '#F59E0B', sub: 'in progress' },
              { label: 'Reply Rate', value: `${replyRate}%`, icon: '💬', color: '#34D399', sub: `${data.emails.replied} of ${data.emails.sent} sent` },
              { label: 'Clients Won', value: data.status_counts.client || 0, icon: '🏆', color: '#A78BFA', sub: `${conversionRate}% conversion` },
            ].map(s => (
              <div key={s.label} style={{ ...card, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '64px', height: '64px', borderRadius: '50%', background: s.color, opacity: 0.1, transform: 'translate(30%, -30%)' }} />
                <p style={{ fontSize: '20px', margin: '0 0 8px' }}>{s.icon}</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0', fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* PIPELINE FUNNEL */}
          <div style={card}>
            <h2 style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Pipeline Funnel</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(data.status_counts)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => {
                  const meta = STATUS_META[status]
                  const pct = Math.round((count / data.total_companies) * 100)
                  return (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '96px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta?.color || '#64748B', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{meta?.label || status}</span>
                      </div>
                      <div style={{ flex: 1, background: 'var(--border)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: '999px', background: meta?.color || '#64748B', width: `${pct}%`, opacity: 0.8, transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '56px', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>{count}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{pct}%</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px' }}>

            {/* EMAIL STATS */}
            <div style={card}>
              <h2 style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Email Campaign</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Generated', value: data.emails.total, color: '#4F7BF7' },
                  { label: 'Sent', value: data.emails.sent, color: '#F97316' },
                  { label: 'Replied', value: data.emails.replied, color: '#34D399' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{item.value}</span>
                    </div>
                    <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '6px' }}>
                      <div style={{
                        height: '100%', borderRadius: '999px', background: item.color,
                        width: `${data.emails.total > 0 ? (item.value / data.emails.total) * 100 : 0}%`,
                      }} />
                    </div>
                  </div>
                ))}
                <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Reply Rate</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: replyRate > 20 ? '#34D399' : '#F59E0B' }}>{replyRate}%</span>
                </div>
              </div>
            </div>

            {/* INDUSTRIES */}
            <div style={card}>
              <h2 style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Industries</h2>
              {data.industries.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--text-dim)', textAlign: 'center', padding: '16px 0' }}>No data</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.industries.map((item, i) => (
                    <div key={item.name}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{item.count}</span>
                      </div>
                      <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '6px' }}>
                        <div style={{
                          height: '100%', borderRadius: '999px',
                          width: `${(item.count / maxIndustry) * 100}%`,
                          background: ['#4F7BF7', '#8B5CF6', '#34D399', '#F59E0B', '#F97316'][i % 5],
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COUNTRIES */}
            <div style={card}>
              <h2 style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Top Countries</h2>
              {data.top_countries.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--text-dim)', textAlign: 'center', padding: '16px 0' }}>No data</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.top_countries.map(item => (
                    <div key={item.name}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{item.count}</span>
                      </div>
                      <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '6px' }}>
                        <div style={{ height: '100%', borderRadius: '999px', background: '#34D399', width: `${(item.count / maxCountry) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* QUICK INSIGHTS */}
          <div style={card}>
            <h2 style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Quick Insights</h2>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { icon: '📬', label: 'Outreach Rate', value: data.total_companies > 0 ? `${Math.round(((data.emails.sent || 0) / data.total_companies) * 100)}%` : '0%', desc: 'companies emailed' },
                { icon: '🎯', label: 'Hot Leads', value: data.status_counts.ready || 0, desc: 'ready to contact' },
                { icon: '⏳', label: 'Awaiting Reply', value: data.status_counts.waiting || 0, desc: 'need follow-up' },
                { icon: '🤝', label: 'In Meeting', value: data.status_counts.meeting || 0, desc: 'active discussions' },
              ].map(item => (
                <div key={item.label} style={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', padding: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '24px', margin: '0 0 4px' }}>{item.icon}</p>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{item.value}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{item.label}</p>
                  <p style={{ fontSize: '9px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
