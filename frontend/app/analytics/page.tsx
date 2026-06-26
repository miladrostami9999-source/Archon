'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'

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

export default function Analytics() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API}/companies/analytics/summary`)
      .then(res => { setData(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar />
      <div className="flex-1 ml-56 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
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
  const conversionRate = data.total_companies > 0 ? Math.round((data.status_counts.client || 0) / data.total_companies * 100) : 0

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar />
      <div className="flex-1 ml-56">

        {/* HEADER */}
        <div className="sticky top-0 z-20 px-8 py-4 border-b border-white/5"
          style={{ background: 'rgba(15,17,23,0.85)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-lg font-semibold text-white/85">Analytics</h1>
          <p className="text-xs text-white/30">Business development performance</p>
        </div>

        <div className="px-8 py-6 max-w-5xl w-full mx-auto space-y-5">

          {/* KPI CARDS */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Companies', value: data.total_companies, icon: '🏢', color: '#4F7BF7', sub: `${data.favorites} favorites` },
              { label: 'Active Pipeline', value: activeCompanies, icon: '⚡', color: '#F59E0B', sub: 'in progress' },
              { label: 'Reply Rate', value: `${replyRate}%`, icon: '💬', color: '#34D399', sub: `${data.emails.replied} of ${data.emails.sent} sent` },
              { label: 'Clients Won', value: data.status_counts.client || 0, icon: '🏆', color: '#A78BFA', sub: `${conversionRate}% conversion` },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/8 p-4 relative overflow-hidden"
                style={{ background: 'rgba(30,36,54,0.6)' }}>
                <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10"
                  style={{ background: s.color, transform: 'translate(30%, -30%)' }} />
                <p className="text-xl mb-2">{s.icon}</p>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-white/60 mt-0.5 font-medium">{s.label}</p>
                <p className="text-[10px] text-white/25 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* PIPELINE FUNNEL */}
          <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-widest mb-4">Pipeline Funnel</h2>
            <div className="space-y-2">
              {Object.entries(data.status_counts)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => {
                  const meta = STATUS_META[status]
                  const pct = Math.round((count / data.total_companies) * 100)
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-24">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta?.color || '#64748B' }} />
                        <span className="text-xs text-white/50">{meta?.label || status}</span>
                      </div>
                      <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: meta?.color || '#64748B', opacity: 0.8 }} />
                      </div>
                      <div className="flex items-center gap-2 w-14 justify-end">
                        <span className="text-xs font-medium text-white/60">{count}</span>
                        <span className="text-[10px] text-white/25">{pct}%</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">

            {/* EMAIL STATS */}
            <div className="rounded-xl border border-white/8 p-5 col-span-1" style={{ background: 'rgba(30,36,54,0.6)' }}>
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-widest mb-4">Email Campaign</h2>
              <div className="space-y-3">
                {[
                  { label: 'Generated', value: data.emails.total, color: '#4F7BF7' },
                  { label: 'Sent', value: data.emails.sent, color: '#F97316' },
                  { label: 'Replied', value: data.emails.replied, color: '#34D399' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/40">{item.label}</span>
                      <span className="text-xs font-medium text-white/70">{item.value}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5">
                      <div className="h-full rounded-full"
                        style={{
                          width: `${data.emails.total > 0 ? (item.value / data.emails.total) * 100 : 0}%`,
                          background: item.color
                        }} />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/30">Reply Rate</span>
                    <span className="text-sm font-bold" style={{ color: replyRate > 20 ? '#34D399' : '#F59E0B' }}>
                      {replyRate}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* INDUSTRIES */}
            <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-widest mb-4">Industries</h2>
              {data.industries.length === 0 ? (
                <p className="text-sm text-white/20 text-center py-4">No data</p>
              ) : (
                <div className="space-y-3">
                  {data.industries.map((item, i) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/50 truncate">{item.name}</span>
                        <span className="text-xs text-white/40">{item.count}</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5">
                        <div className="h-full rounded-full"
                          style={{
                            width: `${(item.count / maxIndustry) * 100}%`,
                            background: ['#4F7BF7', '#8B5CF6', '#34D399', '#F59E0B', '#F97316'][i % 5]
                          }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COUNTRIES */}
            <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-widest mb-4">Top Countries</h2>
              {data.top_countries.length === 0 ? (
                <p className="text-sm text-white/20 text-center py-4">No data</p>
              ) : (
                <div className="space-y-3">
                  {data.top_countries.map(item => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/50 truncate">{item.name}</span>
                        <span className="text-xs text-white/40">{item.count}</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5">
                        <div className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${(item.count / maxCountry) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ACTIVITY SCORE */}
          <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-widest mb-4">Quick Insights</h2>
            <div className="grid grid-cols-4 gap-3">
              {[
                {
                  icon: '📬',
                  label: 'Outreach Rate',
                  value: data.total_companies > 0 ? `${Math.round(((data.emails.sent || 0) / data.total_companies) * 100)}%` : '0%',
                  desc: 'companies emailed'
                },
                {
                  icon: '🎯',
                  label: 'Hot Leads',
                  value: data.status_counts.ready || 0,
                  desc: 'ready to contact'
                },
                {
                  icon: '⏳',
                  label: 'Awaiting Reply',
                  value: data.status_counts.waiting || 0,
                  desc: 'need follow-up'
                },
                {
                  icon: '🤝',
                  label: 'In Meeting',
                  value: data.status_counts.meeting || 0,
                  desc: 'active discussions'
                },
              ].map(item => (
                <div key={item.label} className="rounded-lg bg-white/3 border border-white/5 p-3 text-center">
                  <p className="text-2xl mb-1">{item.icon}</p>
                  <p className="text-xl font-bold text-white/80">{item.value}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{item.label}</p>
                  <p className="text-[9px] text-white/20 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}