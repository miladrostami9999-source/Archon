'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import AdminSideNav from '../../components/AdminSideNav'
import GrowthChart from '../../components/GrowthChart'
import { useIsMobile } from '../../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface Bucket { name: string; count: number }
interface Report {
  total_companies: number
  country_count: number
  industry_count: number
  avg_score: number
  by_country: Bucket[]
  by_industry: Bucket[]
  by_size: Bucket[]
  by_source: Bucket[]
  score_buckets: { poor: number; fair: number; good: number; great: number }
}

const SIZE_LABELS: Record<string, string> = { solo: 'Solo', small: 'Small', medium: 'Medium', large: 'Large' }

const card: React.CSSProperties = { borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }
const sectionHeader: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }

function BarList({ items, max, limit }: { items: Bucket[]; max: number; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items
  const rest = limit && items.length > limit ? items.length - limit : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {shown.map(item => (
        <div key={item.name}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{SIZE_LABELS[item.name] || item.name}</span>
            <span className="mono" style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{item.count}</span>
          </div>
          <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '6px' }}>
            <div style={{ height: '100%', borderRadius: '999px', background: 'var(--accent)', width: `${(item.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
      {rest > 0 && <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>+{rest} more</p>}
    </div>
  )
}

export default function MarketIntelligencePage() {
  const isMobile = useIsMobile()
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('archon-user')
      if (stored && JSON.parse(stored).role !== 'admin') window.location.href = '/dashboard'
    } catch {}
  }, [])

  useEffect(() => {
    axios.get(`${API}/auth/admin/market-intelligence`, { headers: headers() })
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const maxCountry = Math.max(1, ...(data?.by_country || []).map(b => b.count))
  const maxIndustry = Math.max(1, ...(data?.by_industry || []).map(b => b.count))
  const maxSize = Math.max(1, ...(data?.by_size || []).map(b => b.count))
  const maxSource = Math.max(1, ...(data?.by_source || []).map(b => b.count))
  const maxScoreBucket = data ? Math.max(1, ...Object.values(data.score_buckets)) : 1

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', minWidth: 0, marginTop: isMobile ? '52px' : 0, height: isMobile ? 'calc(100vh - 52px)' : '100vh', overflowY: 'auto' }}>

        <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px', padding: isMobile ? '0 16px' : '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Market Intelligence</h1>
        </div>

        <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>
          {!isMobile && <AdminSideNav active="/admin/market-intelligence" />}

          <main style={{ flex: 1, minWidth: 0, maxWidth: '1000px' }}>

          {loading ? (
            <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Loading…</p>
          ) : !data ? (
            <p style={{ fontSize: '13px', color: 'var(--error)' }}>Could not load the report.</p>
          ) : (
            <>
              {/* KPI ROW */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '10px' : '16px', marginBottom: '20px' }}>
                {([
                  ['Total companies', data.total_companies.toLocaleString('en-US')],
                  ['Countries', data.country_count],
                  ['Industries', data.industry_count],
                  ['Avg. score', data.avg_score],
                ] as [string, string | number][]).map(([label, value]) => (
                  <div key={label} style={{ ...card, padding: isMobile ? '14px 16px' : '18px 20px' }}>
                    <p style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{label}</p>
                    <p className="mono" style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* GROWTH */}
              <div style={{ marginBottom: '20px' }}>
                <GrowthChart />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={card}>
                  <h2 style={sectionHeader}>By Country</h2>
                  {data.by_country.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No data</p> : <BarList items={data.by_country} max={maxCountry} limit={20} />}
                </div>
                <div style={card}>
                  <h2 style={sectionHeader}>By Industry</h2>
                  {data.by_industry.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No data</p> : <BarList items={data.by_industry} max={maxIndustry} />}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={card}>
                  <h2 style={sectionHeader}>By Company Size</h2>
                  {data.by_size.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No data</p> : <BarList items={data.by_size} max={maxSize} />}
                </div>
                <div style={card}>
                  <h2 style={sectionHeader}>Discovery Source</h2>
                  {data.by_source.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No data</p> : <BarList items={data.by_source} max={maxSource} limit={10} />}
                </div>
              </div>

              <div style={{ ...card, marginBottom: '32px' }}>
                <h2 style={sectionHeader}>Score Distribution</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  {([
                    ['Poor (0-39)', data.score_buckets.poor],
                    ['Fair (40-59)', data.score_buckets.fair],
                    ['Good (60-79)', data.score_buckets.good],
                    ['Great (80-100)', data.score_buckets.great],
                  ] as [string, number][]).map(([label, count]) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ height: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '8px' }}>
                        <div style={{ width: '32px', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', background: 'var(--accent)', height: `${Math.max(4, (count / maxScoreBucket) * 80)}px` }} />
                      </div>
                      <p className="mono" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>{count}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          </main>
        </div>
      </div>
    </div>
  )
}
