'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface Point { date: string; users: number; companies: number }

export default function GrowthChart() {
  const [metric, setMetric] = useState<'users' | 'companies'>('users')
  const [points, setPoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API}/auth/admin/growth`, { headers: headers(), params: { days: 30 } })
      .then(res => setPoints(res.data.points || []))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false))
  }, [])

  const max = Math.max(1, ...points.map(p => p[metric]))
  const total = points.reduce((sum, p) => sum + p[metric], 0)

  return (
    <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Growth — last 30 days</h2>
          <p className="mono" style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{total} new {metric} total</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px' }}>
          {(['users', 'companies'] as const).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              style={{ padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', textTransform: 'capitalize', background: metric === m ? 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' : 'transparent', color: metric === m ? 'white' : 'var(--text-muted)' }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Loading…</p>
      ) : points.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No data yet.</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '110px', overflowX: 'auto' }}>
          {points.map(p => (
            <div key={p.date} title={`${p.date}: ${p[metric]}`} style={{ flex: '1 0 auto', minWidth: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '100%', maxWidth: '14px', borderRadius: '3px 3px 0 0',
                height: `${Math.max(2, (p[metric] / max) * 90)}px`,
                background: 'linear-gradient(180deg, #3D4FE0, #2E3BB0)',
              }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
