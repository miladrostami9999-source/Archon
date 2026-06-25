'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'

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
  new: '#3b82f6',
  reviewed: '#8b5cf6',
  ready: '#f59e0b',
  sent: '#f97316',
  waiting: '#6b7280',
  replied: '#22c55e',
  meeting: '#14b8a6',
  client: '#10b981',
  archive: '#ef4444',
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
      Loading...
    </div>
  )

  if (!data) return null

  const maxIndustry = Math.max(...data.industries.map(i => i.count), 1)
  const maxCountry = Math.max(...data.top_countries.map(c => c.count), 1)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-xs text-gray-400">Archon · by Armila Design</p>
        </div>
        <button
          onClick={() => window.location.href = '/'}
          className="text-sm text-gray-500 hover:text-gray-700 transition"
        >
          ← Dashboard
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">

        {/* TOP STATS */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Companies', value: data.total_companies, icon: '🏢' },
            { label: 'Favorites', value: data.favorites, icon: '⭐' },
            { label: 'Emails Generated', value: data.emails.total, icon: '✉️' },
            { label: 'Replies', value: data.emails.replied, icon: '💬' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl mb-1">{stat.icon}</p>
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* STATUS BREAKDOWN */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Status Breakdown</h2>
          <div className="space-y-2">
            {Object.entries(data.status_counts).filter(([_, v]) => v > 0).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16 capitalize">{status}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(count / data.total_companies) * 100}%`,
                      backgroundColor: STATUS_COLORS[status] || '#6b7280'
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-6 text-right">{count}</span>
              </div>
            ))}
            {Object.values(data.status_counts).every(v => v === 0) && (
              <p className="text-sm text-gray-300 text-center py-4">No data yet</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* INDUSTRIES */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Industries</h2>
            <div className="space-y-2">
              {data.industries.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-4">No data yet</p>
              ) : (
                data.industries.map(item => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-24 truncate">{item.name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${(item.count / maxIndustry) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-4 text-right">{item.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* TOP COUNTRIES */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Top Countries</h2>
            <div className="space-y-2">
              {data.top_countries.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-4">No data yet</p>
              ) : (
                data.top_countries.map(item => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-24 truncate">{item.name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${(item.count / maxCountry) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-4 text-right">{item.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* EMAIL STATS */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Email Performance</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Generated', value: data.emails.total, color: 'bg-blue-100 text-blue-700' },
              { label: 'Sent', value: data.emails.sent, color: 'bg-orange-100 text-orange-700' },
              { label: 'Replied', value: data.emails.replied, color: 'bg-green-100 text-green-700' },
            ].map(item => (
              <div key={item.label} className={`rounded-xl p-4 ${item.color}`}>
                <p className="text-2xl font-semibold">{item.value}</p>
                <p className="text-xs mt-0.5 opacity-75">{item.label}</p>
              </div>
            ))}
          </div>
          {data.emails.sent > 0 && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              Reply rate: {Math.round((data.emails.replied / data.emails.sent) * 100)}%
            </p>
          )}
        </div>

      </div>
    </div>
  )
}