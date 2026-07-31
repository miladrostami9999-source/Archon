'use client'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

// ── Types mirroring the /companies/discovery/* API ──────────────────────────
interface Source { key: string; label: string; hint: string }
interface SourceGroup { key: string; label: string; blurb: string; sources: Source[] }
interface Signal { key: string; label: string; hint: string }
interface SizeOption { key: string; label: string }
interface Catalog {
  groups: SourceGroup[]
  segments: string[]
  project_types: string[]
  signals: Signal[]
  company_sizes: SizeOption[]
}

interface Criteria {
  sources: string[]
  countries: string
  cities: string
  segments: string[]
  project_types: string[]
  company_sizes: string[]
  signals: string[]
  languages: string
  require_website: boolean
  require_email: boolean
  min_score: number
  count: number
  brief: string
}

interface Lead {
  name: string
  website?: string | null; email?: string | null; domain?: string | null
  country?: string | null; city?: string | null
  industry?: string | null; company_size?: string | null
  linkedin?: string | null; instagram?: string | null
  source?: string | null; source_url?: string | null
  evidence?: string | null; confidence?: string | null
  signals?: string[]; why?: string; score?: number
}

interface SavedHunt {
  id: number; name: string; criteria: Partial<Criteria>
  runs: number; found_total: number; added_total: number; last_run_at: string | null
}

interface RunLog {
  id: number; criteria: Partial<Criteria>
  found: number; fresh: number; added: number
  error: string | null; created_at: string
}

const EMPTY: Criteria = {
  sources: [], countries: '', cities: '', segments: [], project_types: [],
  company_sizes: [], signals: [], languages: '',
  require_website: true, require_email: false, min_score: 0, count: 10, brief: '',
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#34D399', medium: '#FBBF24', low: '#9CA3AF',
}

export default function LeadHunter() {
  const isMobile = useIsMobile()

  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [criteria, setCriteria] = useState<Criteria>(EMPTY)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const [hunting, setHunting] = useState(false)
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [runId, setRunId] = useState<number | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [stats, setStats] = useState<{ found: number; new: number; duplicates: number } | null>(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const [hunts, setHunts] = useState<SavedHunt[]>([])
  const [runs, setRuns] = useState<RunLog[]>([])
  const [huntName, setHuntName] = useState('')
  const [activeHunt, setActiveHunt] = useState<number | null>(null)
  const [tab, setTab] = useState<'setup' | 'saved' | 'history'>('setup')
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    axios.get(`${API}/companies/discovery/sources`, { headers: headers() })
      .then(r => {
        setCatalog(r.data)
        // Open the two highest-yield groups so the page isn't a wall of collapsed rows.
        setOpenGroups({ awards: true, hiring: true })
      })
      .catch(err => { if (err.response?.status === 403) setDenied(true) })
    loadHunts(); loadRuns()
  }, [])

  const loadHunts = () => {
    axios.get(`${API}/companies/discovery/hunts`, { headers: headers() })
      .then(r => setHunts(r.data)).catch(() => {})
  }
  const loadRuns = () => {
    axios.get(`${API}/companies/discovery/runs`, { headers: headers() })
      .then(r => setRuns(r.data)).catch(() => {})
  }

  // ── criteria helpers ──────────────────────────────────────────────────────
  const toggleIn = (field: 'sources' | 'segments' | 'project_types' | 'company_sizes' | 'signals', value: string) => {
    setCriteria(c => {
      const list = c[field]
      return { ...c, [field]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] }
    })
  }
  const set = <K extends keyof Criteria>(field: K, value: Criteria[K]) =>
    setCriteria(c => ({ ...c, [field]: value }))

  const toggleWholeGroup = (group: SourceGroup) => {
    const keys = group.sources.map(s => s.key)
    const allOn = keys.every(k => criteria.sources.includes(k))
    setCriteria(c => ({
      ...c,
      sources: allOn ? c.sources.filter(k => !keys.includes(k)) : Array.from(new Set([...c.sources, ...keys])),
    }))
  }

  const selectedCount = criteria.sources.length

  // ── actions ───────────────────────────────────────────────────────────────
  const runHunt = async () => {
    setHunting(true); setMsg(''); setLeads(null); setStats(null); setPicked(new Set())
    try {
      const res = await axios.post(
        `${API}/companies/discovery/hunt`,
        { ...criteria, hunt_id: activeHunt },
        { headers: headers() },
      )
      setLeads(res.data.suggestions)
      setRunId(res.data.run_id)
      setStats({ found: res.data.found, new: res.data.new, duplicates: res.data.duplicates })
      setPicked(new Set(res.data.suggestions.map((_: Lead, i: number) => i)))
      if (!res.data.suggestions.length) {
        setMsg(res.data.duplicates
          ? `Everything found (${res.data.duplicates}) is already in the catalog — try different sources or a new region.`
          : 'Nothing found. Try widening the criteria or picking more sources.')
      }
      loadRuns()
    } catch (e: any) {
      setMsg(`✗ ${e.response?.data?.detail || 'Hunt failed'}`)
      loadRuns()
    }
    setHunting(false)
  }

  const saveLeads = async () => {
    if (!leads) return
    const chosen = leads.filter((_, i) => picked.has(i))
    if (!chosen.length) { setMsg('Select at least one company first.'); return }
    setSaving(true); setMsg('')
    try {
      const res = await axios.post(
        `${API}/companies/discovery/save`,
        { companies: chosen, run_id: runId },
        { headers: headers() },
      )
      setMsg(`✓ ${res.data.message}`)
      setLeads(null); setStats(null)
      loadRuns(); loadHunts()
    } catch (e: any) {
      setMsg(`✗ ${e.response?.data?.detail || 'Could not save'}`)
    }
    setSaving(false)
  }

  const saveHunt = async () => {
    const name = huntName.trim()
    if (!name) { setMsg('Give the hunt a name first.'); return }
    try {
      await axios.post(`${API}/companies/discovery/hunts`, { name, criteria }, { headers: headers() })
      setHuntName(''); setMsg(`✓ Saved “${name}”`); loadHunts()
    } catch (e: any) {
      setMsg(`✗ ${e.response?.data?.detail || 'Could not save hunt'}`)
    }
  }

  const loadHunt = (h: SavedHunt) => {
    setCriteria({ ...EMPTY, ...h.criteria } as Criteria)
    setActiveHunt(h.id)
    setTab('setup')
    setMsg(`Loaded “${h.name}” — press Hunt to run it.`)
  }

  const deleteHunt = async (id: number) => {
    try { await axios.delete(`${API}/companies/discovery/hunts/${id}`, { headers: headers() }); loadHunts() } catch {}
  }

  const updateLead = (i: number, field: keyof Lead, value: string) => {
    setLeads(prev => prev ? prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l) : prev)
  }

  // ── styles ────────────────────────────────────────────────────────────────
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px',
    fontSize: '12.5px', color: 'var(--text)', outline: 'none',
  }
  const card: React.CSSProperties = {
    borderRadius: '14px', border: '1px solid var(--border)',
    background: 'var(--bg-card)', padding: '18px',
  }
  const sectionLabel: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--text-dim)', margin: '0 0 8px',
  }

  const Chip = ({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) => (
    <button type="button" onClick={onClick} title={title}
      style={{
        fontSize: '11.5px', padding: '5px 10px', borderRadius: '999px', cursor: 'pointer',
        border: `1px solid ${on ? 'rgba(79,123,247,0.45)' : 'var(--border)'}`,
        background: on ? 'rgba(79,123,247,0.14)' : 'var(--bg-input)',
        color: on ? '#60A5FA' : 'var(--text-muted)', textAlign: 'left',
      }}>
      {children}
    </button>
  )

  const summary = useMemo(() => {
    const bits: string[] = []
    if (criteria.countries) bits.push(criteria.countries)
    if (criteria.cities) bits.push(criteria.cities)
    if (criteria.segments.length) bits.push(criteria.segments.join(', '))
    if (criteria.signals.length && catalog) {
      bits.push(catalog.signals.filter(s => criteria.signals.includes(s.key)).map(s => s.label).join(', '))
    }
    return bits.join(' · ') || 'no filters yet'
  }, [criteria, catalog])

  if (denied) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: isMobile ? '52px' : 0 }}>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Lead Hunter is admin-only.</p>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', display: 'flex', flexDirection: 'column', paddingTop: isMobile ? '52px' : 0 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: isMobile ? '0 16px' : '0 24px', height: '56px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>🎯 Lead Hunter</h1>
            <p style={{ fontSize: '10.5px', color: 'var(--text-dim)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedCount ? `${selectedCount} sources · ` : ''}{summary}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {(['setup', 'saved', 'history'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                  background: tab === t ? 'rgba(79,123,247,0.14)' : 'transparent',
                  color: tab === t ? '#60A5FA' : 'var(--text-dim)',
                }}>
                {t === 'saved' ? `Saved (${hunts.length})` : t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px' : '20px 24px' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {msg && (
              <p style={{
                fontSize: '12.5px', margin: 0, padding: '10px 14px', borderRadius: '10px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: msg.startsWith('✓') ? '#34D399' : msg.startsWith('✗') ? '#F87171' : 'var(--text-muted)',
              }}>{msg}</p>
            )}

            {/* ══ SETUP ══ */}
            {tab === 'setup' && (
              <>
                {/* WHO */}
                <div style={card}>
                  <p style={sectionLabel}>Who are you looking for</p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>Countries / regions</label>
                      <input value={criteria.countries} onChange={e => set('countries', e.target.value)} placeholder="UAE, Saudi Arabia, Denmark" style={input} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>Cities</label>
                      <input value={criteria.cities} onChange={e => set('cities', e.target.value)} placeholder="Dubai, Riyadh, Copenhagen" style={input} />
                    </div>
                  </div>

                  <p style={{ ...sectionLabel, marginTop: '4px' }}>Business type</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    {catalog?.segments.map(s => (
                      <Chip key={s} on={criteria.segments.includes(s)} onClick={() => toggleIn('segments', s)}>{s}</Chip>
                    ))}
                  </div>

                  <p style={sectionLabel}>Project types they work on</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    {catalog?.project_types.map(p => (
                      <Chip key={p} on={criteria.project_types.includes(p)} onClick={() => toggleIn('project_types', p)}>{p}</Chip>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                    <div>
                      <p style={sectionLabel}>Company size</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {catalog?.company_sizes.map(s => (
                          <Chip key={s.key} on={criteria.company_sizes.includes(s.key)} onClick={() => toggleIn('company_sizes', s.key)}>{s.label}</Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={sectionLabel}>Site / content language</p>
                      <input value={criteria.languages} onChange={e => set('languages', e.target.value)} placeholder="English, Arabic, German" style={input} />
                    </div>
                  </div>
                </div>

                {/* SIGNALS */}
                <div style={card}>
                  <p style={sectionLabel}>Buying signals to prioritise</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 10px', lineHeight: 1.6 }}>
                    A firm that just won an award, announced a project, or is hiring a visualiser has a
                    reason to reply this month. These push those to the top.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {catalog?.signals.map(s => (
                      <Chip key={s.key} on={criteria.signals.includes(s.key)} onClick={() => toggleIn('signals', s.key)} title={s.hint}>
                        {s.label}
                      </Chip>
                    ))}
                  </div>
                </div>

                {/* SOURCES */}
                <div style={card}>
                  <p style={sectionLabel}>Where to hunt</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 12px', lineHeight: 1.6 }}>
                    Pick the sources to search. Leave everything unticked for a broad search — but naming
                    sources is what gets you past the same twenty famous studios.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {catalog?.groups.map(g => {
                      const open = !!openGroups[g.key]
                      const onCount = g.sources.filter(s => criteria.sources.includes(s.key)).length
                      return (
                        <div key={g.key} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 13px', background: 'var(--bg-input)' }}>
                            <button type="button" onClick={() => setOpenGroups(o => ({ ...o, [g.key]: !open }))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '12px', padding: 0 }}>
                              {open ? '▾' : '▸'}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                                {g.label}
                                {onCount > 0 && <span style={{ marginLeft: '8px', fontSize: '10.5px', fontWeight: 700, color: '#60A5FA', background: 'rgba(79,123,247,0.14)', padding: '2px 7px', borderRadius: '999px' }}>{onCount}</span>}
                              </p>
                              <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '2px 0 0', lineHeight: 1.5 }}>{g.blurb}</p>
                            </div>
                            <button type="button" onClick={() => toggleWholeGroup(g)}
                              style={{ fontSize: '11px', fontWeight: 600, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              {onCount === g.sources.length ? 'None' : 'All'}
                            </button>
                          </div>
                          {open && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '11px 13px' }}>
                              {g.sources.map(s => (
                                <Chip key={s.key} on={criteria.sources.includes(s.key)} onClick={() => toggleIn('sources', s.key)} title={s.hint}>
                                  {s.label}
                                </Chip>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* RULES + RUN */}
                <div style={card}>
                  <p style={sectionLabel}>Rules & brief</p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>How many leads</label>
                      <input type="number" min={1} max={25} value={criteria.count}
                        onChange={e => set('count', Math.min(25, Math.max(1, parseInt(e.target.value || '10', 10))))} style={input} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>Minimum score</label>
                      <input type="number" min={0} max={100} value={criteria.min_score}
                        onChange={e => set('min_score', Math.min(100, Math.max(0, parseInt(e.target.value || '0', 10))))} style={input} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'flex-end', paddingBottom: '2px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={criteria.require_website} onChange={e => set('require_website', e.target.checked)} style={{ accentColor: '#4F7BF7' }} />
                        Must have a website
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={criteria.require_email} onChange={e => set('require_email', e.target.checked)} style={{ accentColor: '#4F7BF7' }} />
                        Must have an email
                      </label>
                    </div>
                  </div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>Extra brief (optional)</label>
                  <textarea value={criteria.brief} onChange={e => set('brief', e.target.value)} rows={3}
                    placeholder="e.g. boutique studios doing warm minimalist interiors, avoid anything doing its own CGI in-house"
                    style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '14px' }}>
                    <button onClick={runHunt} disabled={hunting}
                      style={{ padding: '11px 24px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: hunting ? 'wait' : 'pointer', opacity: hunting ? 0.65 : 1 }}>
                      {hunting ? 'Hunting the web…' : '🎯 Hunt leads'}
                    </button>
                    <button onClick={() => { setCriteria(EMPTY); setActiveHunt(null); setMsg('') }}
                      style={{ padding: '11px 16px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      Reset
                    </button>
                    <div style={{ flex: 1 }} />
                    <input value={huntName} onChange={e => setHuntName(e.target.value)} placeholder="Name this hunt to save it"
                      style={{ ...input, width: isMobile ? '100%' : '230px' }} />
                    <button onClick={saveHunt}
                      style={{ padding: '11px 16px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 600, color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Save hunt
                    </button>
                  </div>
                  {hunting && (
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '12px 0 0', lineHeight: 1.6 }}>
                      Searching each source and verifying every company on its own site. This takes a
                      minute or two — leave the tab open.
                    </p>
                  )}
                </div>

                {/* RESULTS */}
                {stats && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Found', value: stats.found, color: '#60A5FA' },
                      { label: 'New', value: stats.new, color: '#34D399' },
                      { label: 'Already in catalog', value: stats.duplicates, color: '#9CA3AF' },
                    ].map(s => (
                      <div key={s.label} style={{ ...card, flex: 1, minWidth: '120px', padding: '13px 16px' }}>
                        <p style={{ fontSize: '20px', fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {leads && leads.length > 0 && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <p style={{ ...sectionLabel, margin: 0 }}>Review before adding</p>
                      <button onClick={() => setPicked(new Set(leads.map((_, i) => i)))}
                        style={{ fontSize: '11.5px', fontWeight: 600, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer' }}>Select all</button>
                      <button onClick={() => setPicked(new Set())}
                        style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                      {leads.map((lead, i) => {
                        const on = picked.has(i)
                        return (
                          <div key={i} style={{
                            borderRadius: '12px', padding: '14px 16px',
                            border: `1px solid ${on ? 'rgba(79,123,247,0.4)' : 'var(--border)'}`,
                            background: on ? 'rgba(79,123,247,0.05)' : 'var(--bg-card)',
                          }}>
                            <div style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                              <input type="checkbox" checked={on} onChange={() => setPicked(p => {
                                const next = new Set(p); next.has(i) ? next.delete(i) : next.add(i); return next
                              })} style={{ marginTop: '4px', flexShrink: 0, accentColor: '#4F7BF7' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>{lead.name}</span>
                                  {typeof lead.score === 'number' && (
                                    <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: lead.score >= 70 ? '#34D399' : lead.score >= 40 ? '#FBBF24' : '#9CA3AF', background: 'var(--bg-tag)' }}>{lead.score}</span>
                                  )}
                                  {lead.confidence && (
                                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: CONFIDENCE_COLOR[lead.confidence] || '#9CA3AF' }}>
                                      {lead.confidence} confidence
                                    </span>
                                  )}
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                                  {[lead.city, lead.country, lead.industry, lead.company_size].filter(Boolean).join(' · ')}
                                </p>

                                {lead.evidence && (
                                  <p style={{ fontSize: '12px', color: 'var(--text)', margin: '8px 0 0', lineHeight: 1.6, paddingLeft: '10px', borderLeft: '2px solid rgba(79,123,247,0.35)' }}>
                                    {lead.evidence}
                                  </p>
                                )}
                                {lead.why && (
                                  <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '6px 0 0', lineHeight: 1.6 }}>{lead.why}</p>
                                )}

                                {/* Editable before it lands in the shared catalog */}
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '7px', marginTop: '10px' }}>
                                  <input value={lead.email || ''} onChange={e => updateLead(i, 'email', e.target.value)} placeholder="email — blank if none found" style={{ ...input, fontSize: '12px', padding: '7px 9px' }} />
                                  <input value={lead.website || ''} onChange={e => updateLead(i, 'website', e.target.value)} placeholder="website" style={{ ...input, fontSize: '12px', padding: '7px 9px' }} />
                                </div>

                                <div style={{ display: 'flex', gap: '12px', marginTop: '9px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {lead.source_url && (
                                    <a href={lead.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: '#60A5FA', textDecoration: 'none' }}>
                                      📎 {lead.source || 'Source'}
                                    </a>
                                  )}
                                  {!lead.source_url && lead.source && (
                                    <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>📎 {lead.source}</span>
                                  )}
                                  {lead.linkedin && <a href={lead.linkedin} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: '#60A5FA', textDecoration: 'none' }}>LinkedIn</a>}
                                  {lead.instagram && <a href={lead.instagram} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: '#60A5FA', textDecoration: 'none' }}>Instagram</a>}
                                  {lead.signals?.map(s => (
                                    <span key={s} style={{ fontSize: '10.5px', color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '2px 7px', borderRadius: '999px' }}>{s}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <button onClick={saveLeads} disabled={saving}
                      style={{ alignSelf: 'flex-start', padding: '11px 24px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1, marginBottom: '30px' }}>
                      {saving ? 'Adding…' : `Add ${picked.size} to catalog`}
                    </button>
                  </>
                )}
              </>
            )}

            {/* ══ SAVED HUNTS ══ */}
            {tab === 'saved' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {hunts.length === 0 && (
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                    No saved hunts yet. Build a set of criteria on the Setup tab, name it, and save — then
                    you can re-run it any time without rebuilding the filters.
                  </p>
                )}
                {hunts.map(h => (
                  <div key={h.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{h.name}</p>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '3px 0 0' }}>
                        {h.runs} run{h.runs === 1 ? '' : 's'} · {h.found_total} found · {h.added_total} added
                        {h.last_run_at && ` · last ${new Date(h.last_run_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <button onClick={() => loadHunt(h)}
                      style={{ padding: '8px 15px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer' }}>
                      Load
                    </button>
                    <button onClick={() => deleteHunt(h.id)}
                      style={{ padding: '8px 12px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', cursor: 'pointer' }}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ══ HISTORY ══ */}
            {tab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {runs.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No hunts run yet.</p>}
                {runs.map(r => (
                  <div key={r.id} style={{ ...card, padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                      {r.error ? (
                        <span style={{ fontSize: '12px', color: '#F87171' }}>failed — {r.error}</span>
                      ) : (
                        <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                          <strong style={{ color: '#60A5FA' }}>{r.found}</strong> found ·{' '}
                          <strong style={{ color: '#34D399' }}>{r.fresh}</strong> new ·{' '}
                          <strong style={{ color: 'var(--text)' }}>{r.added}</strong> added
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '4px 0 0', lineHeight: 1.5 }}>
                      {[r.criteria.countries, r.criteria.cities, (r.criteria.segments || []).join(', '),
                        `${(r.criteria.sources || []).length} sources`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
