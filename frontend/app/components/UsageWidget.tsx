'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Usage {
  plan: string
  days_total: number; days_used: number | null; days_remaining: number | null; expired: boolean
  companies_used: number; companies_limit: number; companies_remaining: number | null
  emails_used: number; emails_limit: number; emails_remaining: number | null
  plan_expires_at: string | null
}

// A compact meter: value/limit with a colored bar, or an "Unlimited" pill.
function Meter({ label, used, limit, remaining, unit }: { label: string; used: number; limit: number; remaining: number | null; unit?: string }) {
  const unlimited = limit === -1 || remaining === null
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100))
  const low = !unlimited && remaining !== null && remaining <= Math.max(1, Math.round(limit * 0.15))
  const color = unlimited ? '#34D399' : low ? '#F87171' : '#60A5FA'
  return (
    <div style={{ flex: 1, minWidth: '150px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color }}>
          {unlimited ? 'Unlimited' : `${remaining}${unit ? ' ' + unit : ''} left`}
        </span>
      </div>
      <div style={{ height: '6px', borderRadius: '999px', background: 'var(--bg-input)', overflow: 'hidden' }}>
        <div style={{ width: unlimited ? '100%' : `${pct}%`, height: '100%', background: color, opacity: unlimited ? 0.3 : 1, transition: 'width 0.3s' }} />
      </div>
      {!unlimited && <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>{used} / {limit} used</span>}
    </div>
  )
}

export default function UsageWidget() {
  const [u, setU] = useState<Usage | null>(null)

  useEffect(() => {
    axios.get(`${API}/auth/usage`).then(r => setU(r.data)).catch(() => {})
  }, [])

  if (!u) return null
  // Nothing useful to show if everything is unlimited (e.g. admin/agency)
  if (u.companies_limit === -1 && u.emails_limit === -1 && u.days_remaining === null) return null

  return (
    <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: '90px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Your plan</span>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#A78BFA', textTransform: 'capitalize' }}>{u.plan}</span>
        <a href="/upgrade" style={{ fontSize: '10.5px', color: '#60A5FA', textDecoration: 'none' }}>Upgrade →</a>
      </div>
      <Meter label="Companies" used={u.companies_used} limit={u.companies_limit} remaining={u.companies_remaining} />
      <Meter label="Emails this period" used={u.emails_used} limit={u.emails_limit} remaining={u.emails_remaining} />
      {u.days_remaining !== null && (
        <Meter
          label="Plan days"
          used={u.days_used ?? Math.max(0, u.days_total - u.days_remaining)}
          limit={u.days_total}
          remaining={u.days_remaining}
          unit="days"
        />
      )}
    </div>
  )
}
