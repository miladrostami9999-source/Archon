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

const STATUS_COLORS: Record<string, string> = {
  new: '#4F7BF7', reviewed: '#8B5CF6', ready: '#F59E0B',
  sent: '#F97316', waiting: '#64748B', replied: '#34D399',
  meeting: '#14B8A6', client: '#10B981', archive: '#EF4444',
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
    <div className="flex min-h-screen bg-[#0F1117]">
      <Sidebar />
      <div className="flex-1 ml-56 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    </div>
  )

  if (!data) return null

  const maxIndustry = Math.max(...data.industries.map(i => i.count), 1)
  const maxCountry = Math.max(...data.top_countries.map(c => c.count), 1)

  return (
    <div className="flex min-h-screen bg-[#0F1117]">
      <Sidebar />
      <div className="flex-1 ml-56">

        {/* HEADER */}
        <div className="sticky top-0 z-20 px-8 py-4 border-b border-white/5"
          style={{ background: 'rgba(15,17,23,0.85)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-lg font-semibold text-white/85">Analytics</h1>
          <p className="text-xs text-white/30">Performance overview</p>
        </div>

        <div className="px-8 py-6 max-w-4xl space-y-4">

          {/* TOP STATS */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Companies', value: data.total_companies, icon: '🏢', color: '#4F7BF7' },
              { label: 'Favorites', value: data.favorites, icon: '⭐', color: '#FBBF24' },
              { label: 'Emails Sent', value: data.emails.total, icon: '✉️', color: '#34D399' },
              { label: 'Replies', value: data.emails.replied, icon: '💬', color: '#F97316' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/8 p-4" style={{ background: 'rgba(30,36,54,0.6)' }}>
                <p className="text-xl mb-2">{s.icon}</p>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-white/30 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* STATUS */}
          <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
            <h2 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">Status Breakdown</h2>
            <div className="space-y-2.5">
              {Object.entries(data.status_counts).filter(([, v]) => v > 0).map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs text-white/40 w-16 capitalize">{status}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${(count / data.total_companies) * 100}%`, backgroundColor: STATUS_COLORS[status] || '#64748B' }} />
                  </div>
                  <span className="text-xs font-medium text-white/50 w-4 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* INDUSTRIES */}
            <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
              <h2 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">Industries</h2>
              {data.industries.length === 0 ? (
                <p className="text-sm text-white/20 text-center py-4">No data</p>
              ) : data.industries.map(item => (
                <div key={item.name} className="flex items-center gap-3 mb-2.5">
                  <span className="text-xs text-white/40 w-24 truncate">{item.name}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(item.count / maxIndustry) * 100}%` }} />
                  </div>
                  <span className="text-xs text-white/40 w-4 text-right">{item.count}</span>
                </div>
              ))}
            </div>

            {/* COUNTRIES */}
            <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
              <h2 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">Top Countries</h2>
              {data.top_countries.length === 0 ? (
                <p className="text-sm text-white/20 text-center py-4">No data</p>
              ) : data.top_countries.map(item => (
                <div key={item.name} className="flex items-center gap-3 mb-2.5">
                  <span className="text-xs text-white/40 w-24 truncate">{item.name}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${(item.count / maxCountry) * 100}%` }} />
                  </div>
                  <span className="text-xs text-white/40 w-4 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* EMAIL PERFORMANCE */}
          <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
            <h2 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">Email Performance</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Generated', value: data.emails.total, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                { label: 'Sent', value: data.emails.sent, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
                { label: 'Replied', value: data.emails.replied, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
              ].map(item => (
                <div key={item.label} className={`rounded-xl border p-4 ${item.bg}`}>
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-white/30 mt-1">{item.label}</p>
                </div>
              ))}
            </div>
            {data.emails.sent > 0 && (
              <p className="text-xs text-white/25 mt-3 text-center">
                Reply rate: {Math.round((data.emails.replied / data.emails.sent) * 100)}%
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}