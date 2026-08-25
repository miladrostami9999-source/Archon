'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface Point { date: string; label: string; users: number; companies: number }

export default function GrowthChart() {
  const [metric, setMetric] = useState<'users' | 'companies'>('users')
  const [interval, setInterval_] = useState<'day' | 'week' | 'month'>('day')
  const [points, setPoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(true)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    axios.get(`${API}/auth/admin/growth`, { headers: headers(), params: { interval } })
      .then(res => setPoints(res.data.points || []))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false))
  }, [interval])

  const max = Math.max(1, ...points.map(p => p[metric]))
  const total = points.reduce((sum, p) => sum + p[metric], 0)
  const hovered = hoverIdx !== null ? points[hoverIdx] : null
  const rangeLabel = points.length > 0 ? `${points[0].label} – ${points[points.length - 1].label}` : ''

  return (
    <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Growth</h2>
          <p className="mono" style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{total} new {metric} in this range</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px' }}>
            {(['day', 'week', 'month'] as const).map(iv => (
              <button key={iv} onClick={() => setInterval_(iv)}
                style={{ padding: '5px 12px', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, border: 'none', cursor: 'pointer', textTransform: 'capitalize', background: interval === iv ? 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' : 'transparent', color: interval === iv ? 'white' : 'var(--text-muted)' }}>
                {iv === 'day' ? 'Daily' : iv === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px' }}>
            {(['users', 'companies'] as const).map(m => (
              <button key={m} onClick={() => setMetric(m)}
                style={{ padding: '5px 12px', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, border: 'none', cursor: 'pointer', textTransform: 'capitalize', background: metric === m ? 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' : 'transparent', color: metric === m ? 'white' : 'var(--text-muted)' }}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Loading…</p>
      ) : points.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No data yet.</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: interval === 'day' ? '3px' : '6px', height: '120px', overflowX: 'auto', paddingTop: '28px' }}>
          {points.map((p, i) => (
            <div key={p.date} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}
              style={{ position: 'relative', flex: '1 0 auto', minWidth: interval === 'day' ? '6px' : '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}>
              {hoverIdx === i && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap', zIndex: 5, boxShadow: 'var(--shadow-pop)', pointerEvents: 'none',
                }}>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>{p[metric]}</span> {metric}
                </div>
              )}
              <div style={{
                width: '100%', maxWidth: interval === 'day' ? '14px' : '28px', borderRadius: '3px 3px 0 0',
                height: `${Math.max(2, (p[metric] / max) * 90)}px`,
                background: hoverIdx === i ? 'linear-gradient(180deg, #7A88FF, #3D4FE0)' : 'linear-gradient(180deg, #3D4FE0, #2E3BB0)',
              }} />
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '10px 0 0', textAlign: 'center' }}>
        {hovered ? hovered.label : rangeLabel}
      </p>
    </div>
  )
}
