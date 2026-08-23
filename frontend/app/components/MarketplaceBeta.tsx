'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Info {
  max_contract_usd: number
  support_email: string
  support_phone: string
}

/** Small inline chip for page headers. */
export function BetaTag() {
  return (
    <span style={{
      fontSize: '9.5px', fontWeight: 700, color: '#A78BFA', background: 'rgba(139,92,246,0.12)',
      padding: '2px 7px', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>Beta</span>
  )
}

/**
 * The one place that explains what "beta" actually means here, rather than
 * leaving it as a badge people learn nothing from: money moves by hand, and
 * contracts are capped while that's true. Dismissible per browser, because
 * it's context rather than a warning that needs re-reading every visit.
 */
export default function MarketplaceBeta({ compact = false }: { compact?: boolean }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    setHidden(localStorage.getItem('archon-mp-beta-dismissed') === '1')
    axios.get(`${API}/marketplace/info`).then(r => setInfo(r.data)).catch(() => {})
  }, [])

  const dismiss = () => {
    localStorage.setItem('archon-mp-beta-dismissed', '1')
    setHidden(true)
  }

  if (hidden || !info) return null

  const cap = info.max_contract_usd
    ? `Contracts are capped at $${info.max_contract_usd.toLocaleString('en-US')} each for now.`
    : ''
  const contact = [info.support_email, info.support_phone].filter(Boolean).join(' · ')

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      borderRadius: '12px', border: '1px solid rgba(139,92,246,0.25)',
      background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(79,123,247,0.06))',
      padding: compact ? '10px 12px' : '13px 15px', marginBottom: '16px',
    }}>
      <span style={{ fontSize: '15px', lineHeight: 1.2, flexShrink: 0 }}>🧪</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#A78BFA', margin: '0 0 3px' }}>
          Marketplace is in beta
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
          Payments run through Archon manually — the client transfers, we confirm it, and the freelancer is
          paid out once the work is approved. {cap} {contact && <>Something looks wrong? {contact}</>}
        </p>
      </div>
      <button onClick={dismiss} aria-label="Dismiss"
        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}>
        ✕
      </button>
    </div>
  )
}
