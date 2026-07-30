'use client'
import { useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface Suggestion {
  name: string; website?: string | null; email?: string | null
  country?: string | null; city?: string | null; industry?: string | null
  company_size?: string | null; linkedin?: string | null; instagram?: string | null
  why?: string; score?: number
}

/**
 * Claude searches the web for firms that fit Armila's client profile, skipping
 * anything already in the catalog. Results are reviewed before saving — the
 * catalog is shared by every account, so nothing lands in it unattended.
 */
export default function LeadDiscovery({ isMobile }: { isMobile: boolean }) {
  const [criteria, setCriteria] = useState({ country: '', industry: '', count: 5 })
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const search = async () => {
    setSearching(true); setMsg(''); setSuggestions(null); setPicked(new Set())
    try {
      const r = await axios.post(`${API}/companies/discover`, criteria, { headers: headers() })
      setSuggestions(r.data.suggestions)
      setPicked(new Set(r.data.suggestions.map((_: Suggestion, i: number) => i)))
      if (!r.data.suggestions.length) setMsg('No new companies found — try a different country or industry.')
    } catch (e: any) {
      setMsg(`✗ ${e.response?.data?.detail || 'Discovery failed'}`)
    }
    setSearching(false)
  }

  const save = async () => {
    if (!suggestions) return
    const chosen = suggestions.filter((_, i) => picked.has(i))
    if (!chosen.length) { setMsg('Select at least one company first.'); return }
    setSaving(true); setMsg('')
    try {
      const r = await axios.post(`${API}/companies/discover/save`, { companies: chosen }, { headers: headers() })
      setMsg(`✓ ${r.data.message}`)
      setSuggestions(null)
    } catch (e: any) {
      setMsg(`✗ ${e.response?.data?.detail || 'Could not save'}`)
    }
    setSaving(false)
  }

  const toggle = (i: number) => {
    setPicked(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px',
    fontSize: '12.5px', color: 'var(--text)', outline: 'none',
  }

  return (
    <>
      <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px', marginTop: '28px' }}>AI Lead Discovery</p>
      <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Claude searches the web for firms that fit Armila&apos;s client profile and skips anything already in the catalog. Review the results before adding them — the catalog is shared by every account.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr auto auto', gap: '10px', alignItems: 'end', marginBottom: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Country / region</label>
          <input value={criteria.country} onChange={e => setCriteria(c => ({ ...c, country: e.target.value }))} placeholder="e.g. UAE, Germany" style={input} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Industry</label>
          <input value={criteria.industry} onChange={e => setCriteria(c => ({ ...c, industry: e.target.value }))} placeholder="e.g. Interior Design" style={input} />
        </div>
        <div style={{ width: isMobile ? '100%' : '90px' }}>
          <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>How many</label>
          <input type="number" min={1} max={10} value={criteria.count}
            onChange={e => setCriteria(c => ({ ...c, count: Math.min(10, Math.max(1, parseInt(e.target.value || '5', 10))) }))} style={input} />
        </div>
        <button onClick={search} disabled={searching}
          style={{ padding: '10px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: searching ? 'wait' : 'pointer', opacity: searching ? 0.6 : 1, whiteSpace: 'nowrap' }}>
          {searching ? 'Searching the web…' : '✦ Find leads'}
        </button>
      </div>

      {msg && <p style={{ fontSize: '12.5px', color: msg.startsWith('✓') ? '#34D399' : msg.startsWith('✗') ? '#F87171' : 'var(--text-muted)', margin: '0 0 12px' }}>{msg}</p>}

      {suggestions && suggestions.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {suggestions.map((sug, i) => (
              <label key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', borderRadius: '12px', border: `1px solid ${picked.has(i) ? 'rgba(79,123,247,0.4)' : 'var(--border)'}`, background: picked.has(i) ? 'rgba(79,123,247,0.05)' : 'var(--bg-card)', padding: '12px 14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} style={{ marginTop: '3px', flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{sug.name}</span>
                    {typeof sug.score === 'number' && (
                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: sug.score >= 70 ? '#34D399' : sug.score >= 40 ? '#FBBF24' : '#9CA3AF', background: 'var(--bg-tag)' }}>{sug.score}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {[sug.city, sug.country, sug.industry].filter(Boolean).join(' · ')}
                  </div>
                  {sug.why && <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '5px 0 0', lineHeight: 1.5 }}>{sug.why}</p>}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {sug.website && <a href={sug.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '11.5px', color: '#60A5FA', textDecoration: 'none' }}>Website</a>}
                    {sug.linkedin && <a href={sug.linkedin} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '11.5px', color: '#60A5FA', textDecoration: 'none' }}>LinkedIn</a>}
                    {sug.email && <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{sug.email}</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <button onClick={save} disabled={saving}
            style={{ padding: '10px 22px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: 'pointer', marginBottom: '20px', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Adding…' : `Add ${picked.size} to catalog`}
          </button>
        </>
      )}
    </>
  )
}
