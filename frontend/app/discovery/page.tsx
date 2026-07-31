'use client'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

// ── Types mirroring /companies/discovery/* ──────────────────────────────────
interface Source { key: string; label: string; hint: string }
interface SourceGroup { key: string; label: string; blurb: string; sources: Source[] }
interface Signal { key: string; label: string; hint: string }
interface SizeOption { key: string; label: string }
interface Catalog {
  groups: SourceGroup[]; segments: string[]; project_types: string[]
  signals: Signal[]; company_sizes: SizeOption[]
}

interface Criteria {
  sources: string[]; countries: string; cities: string
  segments: string[]; project_types: string[]; company_sizes: string[]
  signals: string[]; languages: string
  require_website: boolean; require_email: boolean
  min_score: number; count: number; brief: string
}

/** Stage 1 result — who exists, and where we found them. */
interface Scouted {
  name: string; website?: string | null; country?: string | null; city?: string | null
  segment?: string | null; source?: string | null; source_url?: string | null; note?: string | null
}

interface ScoreAxis { axis: string; points: number; max: number; note: string }

/** Stage 2 result — researched and scored. */
interface Enriched extends Scouted {
  email?: string | null; phone?: string | null
  linkedin?: string | null; instagram?: string | null
  industry?: string | null; company_size?: string | null
  signals?: string[]; evidence?: string | null; confidence?: string | null
  why?: string | null; style_fit?: number
  score: number; grade: string; verdict: string; breakdown: ScoreAxis[]
  enriched?: boolean
  /** Optional rules from the setup form this company didn't meet. */
  fails_rules?: string[]
}

interface SavedHunt {
  id: number; name: string; criteria: Partial<Criteria>
  runs: number; found_total: number; added_total: number; last_run_at: string | null
}

interface RunLog {
  id: number; stage: string; criteria: any
  found: number; fresh: number; added: number
  input_tokens: number; output_tokens: number
  error: string | null; created_at: string
}

interface Usage { input_tokens: number; output_tokens: number }

const EMPTY: Criteria = {
  sources: [], countries: '', cities: '', segments: [], project_types: [],
  company_sizes: [], signals: [], languages: '',
  require_website: true, require_email: false, min_score: 0, count: 15, brief: '',
}

const GRADE_COLOR: Record<string, string> = { A: '#34D399', B: '#60A5FA', C: '#FBBF24', D: '#9CA3AF' }
const CONFIDENCE_COLOR: Record<string, string> = { high: '#34D399', medium: '#FBBF24', low: '#9CA3AF' }

type Stage = 'setup' | 'scouted' | 'enriched'

/**
 * One-click starting points.
 *
 * The full filter set is powerful but it's a lot to face on an empty page, so
 * these do the setup for the searches actually worth running, and stay editable
 * afterwards. Everything they set is optional — a preset is a shortcut, not a
 * requirement.
 */
const PRESETS: { label: string; blurb: string; patch: Partial<Criteria> }[] = [
  {
    label: '🔥 Hiring a visualiser',
    blurb: 'The strongest buying signal there is — they need the capacity now',
    patch: {
      signals: ['hiring_viz', 'no_inhouse'],
      sources: ['archinect_jobs', 'linkedin_jobs', 'cgarchitect_jobs'],
      segments: ['Architecture studio', 'Interior design studio'],
    },
  },
  {
    label: '🏗 Gulf developers launching',
    blurb: 'Biggest budgets, and every launch needs marketing imagery',
    patch: {
      countries: 'United Arab Emirates, Saudi Arabia, Qatar',
      segments: ['Real estate developer'],
      signals: ['new_project', 'exhibiting'],
      sources: ['gulf_developers', 'cityscape', 'big5', 'property_press'],
    },
  },
  {
    label: '🏆 Award shortlists',
    blurb: 'They just won something and need press images',
    patch: {
      segments: ['Architecture studio', 'Interior design studio'],
      signals: ['recent_award'],
      sources: ['waf', 'dezeen_awards', 'architizer_a', 'mies', 'riba_awards'],
    },
  },
  {
    label: '🎯 Small studios, no in-house 3D',
    blurb: 'The bread and butter — they outsource by default',
    patch: {
      company_sizes: ['small', 'solo'],
      segments: ['Architecture studio', 'Interior design studio'],
      signals: ['no_inhouse', 'dated_visuals'],
      sources: ['riba_arb', 'bak_bda', 'cscae', 'bna', 'nordic_bodies', 'world_architects'],
    },
  },
]

export default function LeadHunter() {
  const isMobile = useIsMobile()

  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [criteria, setCriteria] = useState<Criteria>(EMPTY)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  // Refinement is collapsed by default: the brief alone is a valid search, and
  // showing every filter at once made the page read as a form to complete.
  const [refineOpen, setRefineOpen] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)

  const [stage, setStage] = useState<Stage>('setup')
  const [scouted, setScouted] = useState<Scouted[]>([])
  const [enriched, setEnriched] = useState<Enriched[]>([])
  const [keep, setKeep] = useState<Set<number>>(new Set())
  const [runId, setRunId] = useState<number | null>(null)

  const [scouting, setScouting] = useState(false)
  const [researching, setResearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scoutStats, setScoutStats] = useState<{ found: number; new: number; duplicates: number } | null>(null)
  const [spend, setSpend] = useState<Usage>({ input_tokens: 0, output_tokens: 0 })
  const [msg, setMsg] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const [hunts, setHunts] = useState<SavedHunt[]>([])
  const [runs, setRuns] = useState<RunLog[]>([])
  const [huntName, setHuntName] = useState('')
  const [activeHunt, setActiveHunt] = useState<number | null>(null)
  const [tab, setTab] = useState<'hunt' | 'saved' | 'history'>('hunt')
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    axios.get(`${API}/companies/discovery/sources`, { headers: headers() })
      .then(r => { setCatalog(r.data); setOpenGroups({ awards: true, hiring: true }) })
      .catch(err => { if (err.response?.status === 403) setDenied(true) })
    loadHunts(); loadRuns()
  }, [])

  const loadHunts = () => axios.get(`${API}/companies/discovery/hunts`, { headers: headers() })
    .then(r => setHunts(r.data)).catch(() => {})
  const loadRuns = () => axios.get(`${API}/companies/discovery/runs`, { headers: headers() })
    .then(r => setRuns(r.data)).catch(() => {})

  // ── criteria helpers ──────────────────────────────────────────────────────
  const toggleIn = (field: 'sources' | 'segments' | 'project_types' | 'company_sizes' | 'signals', value: string) =>
    setCriteria(c => {
      const list = c[field]
      return { ...c, [field]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] }
    })
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

  const toggleKeep = (i: number) => setKeep(p => {
    const next = new Set(p); next.has(i) ? next.delete(i) : next.add(i); return next
  })

  const applyPreset = (patch: Partial<Criteria>) => {
    setCriteria(c => ({ ...EMPTY, brief: c.brief, count: c.count, ...patch }))
    setRefineOpen(true)
    setMsg('Preset loaded — edit anything below, or just hit Scout.')
  }

  /** How many filters are set, for the "Refine" summary. */
  const activeFilters = useMemo(() => {
    const n = criteria.sources.length + criteria.segments.length + criteria.project_types.length
      + criteria.company_sizes.length + criteria.signals.length
      + (criteria.countries ? 1 : 0) + (criteria.cities ? 1 : 0) + (criteria.languages ? 1 : 0)
    return n
  }, [criteria])

  // ── stage 1 ───────────────────────────────────────────────────────────────
  const runScout = async () => {
    setScouting(true); setMsg(''); setScouted([]); setEnriched([]); setScoutStats(null)
    setSpend({ input_tokens: 0, output_tokens: 0 })
    try {
      const r = await axios.post(`${API}/companies/discovery/scout`,
        { ...criteria, hunt_id: activeHunt }, { headers: headers() })
      setScouted(r.data.candidates)
      setRunId(r.data.run_id)
      setScoutStats({ found: r.data.found, new: r.data.new, duplicates: r.data.duplicates })
      setSpend(r.data.usage)
      setKeep(new Set(r.data.candidates.map((_: Scouted, i: number) => i)))
      setStage('scouted')
      if (!r.data.candidates.length) {
        setMsg(r.data.duplicates
          ? `Everything found (${r.data.duplicates}) is already in the catalog — try other sources or a new region.`
          : 'Nothing found. Widen the criteria or pick more sources.')
      }
      loadRuns()
    } catch (e: any) {
      setMsg(`✗ ${e.response?.data?.detail || 'Scout failed'}`); loadRuns()
    }
    setScouting(false)
  }

  // ── stage 2 ───────────────────────────────────────────────────────────────
  const runEnrich = async () => {
    const picks = scouted.filter((_, i) => keep.has(i))
    if (!picks.length) { setMsg('Tick at least one company to research.'); return }
    setResearching(true); setMsg('')
    try {
      const r = await axios.post(`${API}/companies/discovery/enrich`,
        { companies: picks, criteria, hunt_id: activeHunt }, { headers: headers() })
      setEnriched(r.data.companies)
      setRunId(r.data.run_id)
      setSpend(s => ({
        input_tokens: s.input_tokens + r.data.usage.input_tokens,
        output_tokens: s.output_tokens + r.data.usage.output_tokens,
      }))
      // Pre-tick what's worth an email and meets whatever rules were set, so
      // the common case is "glance, then Add" rather than ticking 20 boxes.
      const floor = criteria.min_score || 48
      setKeep(new Set(r.data.companies
        .map((c: Enriched, i: number) => (c.score >= floor && !(c.fails_rules?.length) ? i : -1))
        .filter((i: number) => i >= 0)))
      setStage('enriched')
      loadRuns()
    } catch (e: any) {
      setMsg(`✗ ${e.response?.data?.detail || 'Research failed'}`); loadRuns()
    }
    setResearching(false)
  }

  // ── stage 3 ───────────────────────────────────────────────────────────────
  const saveChosen = async () => {
    const chosen = enriched.filter((_, i) => keep.has(i))
    if (!chosen.length) { setMsg('Tick at least one company to add.'); return }
    setSaving(true); setMsg('')
    try {
      const r = await axios.post(`${API}/companies/discovery/save`,
        { companies: chosen, run_id: runId }, { headers: headers() })
      setMsg(`✓ ${r.data.message}`)
      setStage('setup'); setScouted([]); setEnriched([]); setScoutStats(null); setKeep(new Set())
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
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not save hunt'}`) }
  }

  const loadHunt = (h: SavedHunt) => {
    setCriteria({ ...EMPTY, ...h.criteria } as Criteria)
    setActiveHunt(h.id); setTab('hunt'); setStage('setup')
    setMsg(`Loaded “${h.name}” — press Scout to run it.`)
  }

  const deleteHunt = async (id: number) => {
    try { await axios.delete(`${API}/companies/discovery/hunts/${id}`, { headers: headers() }); loadHunts() } catch {}
  }

  const editEnriched = (i: number, field: keyof Enriched, value: string) =>
    setEnriched(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

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
      }}>{children}</button>
  )

  /** A collapsed filter group that shows what's set without being opened. */
  const Section = ({ id, title, hint, summary, children }: {
    id: string; title: string; hint: string; summary: string; children: React.ReactNode
  }) => {
    const open = openSection === id
    const isSet = summary !== 'Any'
    return (
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <button type="button" onClick={() => setOpenSection(open ? null : id)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 2px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', width: '10px', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              {title} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-dim)' }}>· {hint}</span>
            </p>
            <p style={{
              fontSize: '11.5px', margin: '2px 0 0', color: isSet ? '#60A5FA' : 'var(--text-dim)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{summary}</p>
          </div>
        </button>
        {open && <div style={{ padding: '2px 0 16px 20px' }}>{children}</div>}
      </div>
    )
  }

  const listSummary = (items: string[], fallback = 'Any') => items.length ? items.join(', ') : fallback

  const summary = useMemo(() => {
    const bits: string[] = []
    if (criteria.countries) bits.push(criteria.countries)
    if (criteria.cities) bits.push(criteria.cities)
    if (criteria.segments.length) bits.push(criteria.segments.join(', '))
    return bits.join(' · ') || 'no filters yet'
  }, [criteria])

  const STEPS: { key: Stage; n: number; label: string; sub: string }[] = [
    { key: 'setup',    n: 1, label: 'Scout',    sub: 'find who exists — cheap' },
    { key: 'scouted',  n: 2, label: 'Research', sub: 'only the ones you keep' },
    { key: 'enriched', n: 3, label: 'Add',      sub: 'you pick what lands' },
  ]
  const stageIndex = STEPS.findIndex(s => s.key === stage)

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
              {criteria.sources.length ? `${criteria.sources.length} sources · ` : ''}{summary}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {(['hunt', 'saved', 'history'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                  background: tab === t ? 'rgba(79,123,247,0.14)' : 'transparent',
                  color: tab === t ? '#60A5FA' : 'var(--text-dim)',
                }}>{t === 'saved' ? `Saved (${hunts.length})` : t}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px' : '20px 24px' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {tab === 'hunt' && (
              <>
                {/* STEPPER */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {STEPS.map((s, i) => {
                    const active = i === stageIndex
                    const done = i < stageIndex
                    return (
                      <div key={s.key} style={{
                        flex: 1, minWidth: '150px', padding: '11px 14px', borderRadius: '11px',
                        border: `1px solid ${active ? 'rgba(79,123,247,0.4)' : 'var(--border)'}`,
                        background: active ? 'rgba(79,123,247,0.07)' : 'var(--bg-card)',
                        opacity: done ? 0.65 : 1,
                      }}>
                        <p style={{ fontSize: '12.5px', fontWeight: 700, margin: 0, color: active ? '#60A5FA' : done ? '#34D399' : 'var(--text-dim)' }}>
                          {done ? '✓' : s.n}. {s.label}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{s.sub}</p>
                      </div>
                    )
                  })}
                </div>

                {(spend.input_tokens > 0 || spend.output_tokens > 0) && (
                  <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                    Tokens this session: {spend.input_tokens.toLocaleString()} in · {spend.output_tokens.toLocaleString()} out
                  </p>
                )}

                {msg && (
                  <p style={{
                    fontSize: '12.5px', margin: 0, padding: '10px 14px', borderRadius: '10px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: msg.startsWith('✓') ? '#34D399' : msg.startsWith('✗') ? '#F87171' : 'var(--text-muted)',
                  }}>{msg}</p>
                )}

                {/* ══ STAGE 1: SETUP ══ */}
                {stage === 'setup' && (
                  <>
                    {/* THE SEARCH. Everything else on this page is optional. */}
                    <div style={{ ...card, padding: '20px' }}>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>
                        What are you hunting for?
                      </label>
                      <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 10px', lineHeight: 1.6 }}>
                        Describe it in plain words. This is the only field that matters — and even
                        it can be left blank for a broad sweep.
                      </p>
                      <textarea value={criteria.brief} onChange={e => set('brief', e.target.value)} rows={3}
                        placeholder="small interior studios in Dubai that are hiring a visualiser&#10;or: Scandinavian architecture practices doing warm minimalist housing"
                        style={{ ...input, fontSize: '13.5px', padding: '12px 13px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
                        <button onClick={runScout} disabled={scouting}
                          style={{ padding: '12px 26px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: scouting ? 'wait' : 'pointer', opacity: scouting ? 0.65 : 1 }}>
                          {scouting ? 'Scouting…' : '🔍 Scout for leads'}
                        </button>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                          Find
                          <input type="number" min={1} max={40} value={criteria.count}
                            onChange={e => set('count', Math.min(40, Math.max(1, parseInt(e.target.value || '15', 10))))}
                            style={{ ...input, width: '62px', padding: '8px 9px', textAlign: 'center' }} />
                          companies
                        </label>
                        <div style={{ flex: 1 }} />
                        {activeFilters > 0 && (
                          <button onClick={() => { setCriteria({ ...EMPTY, brief: criteria.brief, count: criteria.count }); setActiveHunt(null) }}
                            style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>
                            Clear {activeFilters} filter{activeFilters === 1 ? '' : 's'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* PRESETS — a running start for the searches worth running */}
                    <div>
                      <p style={{ ...sectionLabel, marginBottom: '8px' }}>Or start from one of these</p>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '8px' }}>
                        {PRESETS.map(p => (
                          <button key={p.label} onClick={() => applyPreset(p.patch)}
                            style={{
                              textAlign: 'left', padding: '13px 15px', borderRadius: '11px', cursor: 'pointer',
                              border: '1px solid var(--border)', background: 'var(--bg-card)',
                            }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{p.label}</p>
                            <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '3px 0 0', lineHeight: 1.5 }}>{p.blurb}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* REFINE — collapsed, because none of it is required */}
                    <div style={{ ...card, padding: '4px 18px 6px' }}>
                      <button type="button" onClick={() => setRefineOpen(o => !o)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 2px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', width: '10px' }}>{refineOpen ? '▾' : '▸'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Narrow it down</p>
                          <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '2px 0 0' }}>
                            All optional — {activeFilters > 0 ? `${activeFilters} set` : 'nothing set, searching broadly'}
                          </p>
                        </div>
                      </button>

                      {refineOpen && (
                        <div style={{ paddingBottom: '6px' }}>
                          <Section id="where" title="Where" hint="countries, cities, language"
                            summary={[criteria.countries, criteria.cities, criteria.languages].filter(Boolean).join(' · ') || 'Any'}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>Countries / regions</label>
                                <input value={criteria.countries} onChange={e => set('countries', e.target.value)} placeholder="UAE, Denmark" style={input} />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>Cities</label>
                                <input value={criteria.cities} onChange={e => set('cities', e.target.value)} placeholder="Dubai, Riyadh" style={input} />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>Site language</label>
                                <input value={criteria.languages} onChange={e => set('languages', e.target.value)} placeholder="English, Arabic" style={input} />
                              </div>
                            </div>
                          </Section>

                          <Section id="who" title="Who" hint="business type, projects, size"
                            summary={listSummary([...criteria.segments, ...criteria.project_types, ...criteria.company_sizes])}>
                            <p style={{ ...sectionLabel, marginTop: '6px' }}>Business type</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                              {catalog?.segments.map(s => <Chip key={s} on={criteria.segments.includes(s)} onClick={() => toggleIn('segments', s)}>{s}</Chip>)}
                            </div>
                            <p style={sectionLabel}>Project types</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                              {catalog?.project_types.map(p => <Chip key={p} on={criteria.project_types.includes(p)} onClick={() => toggleIn('project_types', p)}>{p}</Chip>)}
                            </div>
                            <p style={sectionLabel}>Company size</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {catalog?.company_sizes.map(s => <Chip key={s.key} on={criteria.company_sizes.includes(s.key)} onClick={() => toggleIn('company_sizes', s.key)}>{s.label}</Chip>)}
                            </div>
                          </Section>

                          <Section id="signals" title="Buying signals" hint="weigh heavily in the score"
                            summary={listSummary(catalog?.signals.filter(s => criteria.signals.includes(s.key)).map(s => s.label) || [])}>
                            <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '6px 0 10px', lineHeight: 1.6 }}>
                              A firm that just won an award, launched a project, or is hiring a
                              visualiser has a reason to reply this month.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {catalog?.signals.map(s => (
                                <Chip key={s.key} on={criteria.signals.includes(s.key)} onClick={() => toggleIn('signals', s.key)} title={s.hint}>{s.label}</Chip>
                              ))}
                            </div>
                          </Section>

                          <Section id="sources" title="Where to hunt" hint={`${catalog?.groups.reduce((n, g) => n + g.sources.length, 0) || 0} sources`}
                            summary={criteria.sources.length ? `${criteria.sources.length} selected` : 'Any'}>
                            <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '6px 0 10px', lineHeight: 1.6 }}>
                              Naming sources is what gets you past the same twenty famous studios.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {catalog?.groups.map(g => {
                                const open = !!openGroups[g.key]
                                const onCount = g.sources.filter(s => criteria.sources.includes(s.key)).length
                                return (
                                  <div key={g.key} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-input)' }}>
                                      <button type="button" onClick={() => setOpenGroups(o => ({ ...o, [g.key]: !open }))}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '12px', padding: 0 }}>{open ? '▾' : '▸'}</button>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                                          {g.label}
                                          {onCount > 0 && <span style={{ marginLeft: '8px', fontSize: '10.5px', fontWeight: 700, color: '#60A5FA', background: 'rgba(79,123,247,0.14)', padding: '2px 7px', borderRadius: '999px' }}>{onCount}</span>}
                                        </p>
                                        <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0', lineHeight: 1.5 }}>{g.blurb}</p>
                                      </div>
                                      <button type="button" onClick={() => toggleWholeGroup(g)}
                                        style={{ fontSize: '11px', fontWeight: 600, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        {onCount === g.sources.length ? 'None' : 'All'}
                                      </button>
                                    </div>
                                    {open && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '11px 12px' }}>
                                        {g.sources.map(s => <Chip key={s.key} on={criteria.sources.includes(s.key)} onClick={() => toggleIn('sources', s.key)} title={s.hint}>{s.label}</Chip>)}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </Section>

                          <Section id="rules" title="Rules" hint="what to skip"
                            summary={[
                              criteria.require_website ? 'needs a website' : '',
                              criteria.require_email ? 'needs an email' : '',
                              criteria.min_score ? `score ≥ ${criteria.min_score}` : '',
                            ].filter(Boolean).join(' · ') || 'Any'}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '6px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={criteria.require_website} onChange={e => set('require_website', e.target.checked)} style={{ accentColor: '#4F7BF7' }} />
                                Skip companies with no website
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={criteria.require_email} onChange={e => set('require_email', e.target.checked)} style={{ accentColor: '#4F7BF7' }} />
                                Skip companies with no published email
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                                Minimum score
                                <input type="number" min={0} max={100} value={criteria.min_score}
                                  onChange={e => set('min_score', Math.min(100, Math.max(0, parseInt(e.target.value || '0', 10))))}
                                  style={{ ...input, width: '74px', padding: '7px 9px', textAlign: 'center' }} />
                              </label>
                            </div>
                          </Section>
                        </div>
                      )}
                    </div>

                    {/* FOOTER — saving a hunt is housekeeping, not part of the search */}
                    <div style={{ display: 'flex', gap: '9px', alignItems: 'center', flexWrap: 'wrap', paddingBottom: '30px' }}>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0, flex: 1, minWidth: '220px', lineHeight: 1.6 }}>
                        Scouting only collects names, sites and where they were found — the cheap pass.
                        Nothing is researched or added until you say so.
                      </p>
                      <input value={huntName} onChange={e => setHuntName(e.target.value)} placeholder="Name this hunt to reuse it"
                        style={{ ...input, width: isMobile ? '100%' : '210px', padding: '8px 10px' }} />
                      <button onClick={saveHunt}
                        style={{ padding: '9px 14px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Save hunt</button>
                    </div>
                  </>
                )}

                {/* ══ STAGE 2: REVIEW SCOUTED ══ */}
                {stage === 'scouted' && (
                  <>
                    {scoutStats && (
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {[
                          { label: 'Found', value: scoutStats.found, color: '#60A5FA' },
                          { label: 'New', value: scoutStats.new, color: '#34D399' },
                          { label: 'Already in catalog', value: scoutStats.duplicates, color: '#9CA3AF' },
                        ].map(s => (
                          <div key={s.label} style={{ ...card, flex: 1, minWidth: '120px', padding: '13px 16px' }}>
                            <p style={{ fontSize: '20px', fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{s.label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <p style={{ ...sectionLabel, margin: 0 }}>Untick anything you don&apos;t want researched</p>
                      <button onClick={() => setKeep(new Set(scouted.map((_, i) => i)))} style={{ fontSize: '11.5px', fontWeight: 600, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer' }}>All</button>
                      <button onClick={() => setKeep(new Set())} style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>None</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {scouted.map((c, i) => {
                        const on = keep.has(i)
                        return (
                          <label key={i} style={{
                            display: 'flex', gap: '11px', alignItems: 'flex-start', cursor: 'pointer',
                            borderRadius: '11px', padding: '12px 14px',
                            border: `1px solid ${on ? 'rgba(79,123,247,0.4)' : 'var(--border)'}`,
                            background: on ? 'rgba(79,123,247,0.05)' : 'var(--bg-card)',
                          }}>
                            <input type="checkbox" checked={on} onChange={() => toggleKeep(i)} style={{ marginTop: '3px', flexShrink: 0, accentColor: '#4F7BF7' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{c.name}</p>
                              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                                {[c.city, c.country, c.segment].filter(Boolean).join(' · ')}
                              </p>
                              {c.note && <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '4px 0 0', lineHeight: 1.5 }}>{c.note}</p>}
                              <div style={{ display: 'flex', gap: '12px', marginTop: '5px', flexWrap: 'wrap' }}>
                                {c.website && <a href={c.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '11.5px', color: '#60A5FA', textDecoration: 'none' }}>Website</a>}
                                {c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '11.5px', color: '#60A5FA', textDecoration: 'none' }}>📎 {c.source || 'Source'}</a>}
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingBottom: '30px' }}>
                      <button onClick={runEnrich} disabled={researching || keep.size === 0}
                        style={{ padding: '11px 24px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: researching ? 'wait' : 'pointer', opacity: researching || keep.size === 0 ? 0.55 : 1 }}>
                        {researching ? 'Researching…' : `🔬 Research & score ${keep.size}`}
                      </button>
                      <button onClick={() => { setStage('setup'); setMsg('') }}
                        style={{ padding: '11px 16px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                        ← Back to criteria
                      </button>
                      {researching && (
                        <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0, alignSelf: 'center', flexBasis: '100%', lineHeight: 1.6 }}>
                          Visiting each site to find contacts, size and buying signals. A minute or
                          two — leave the tab open.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* ══ STAGE 3: REVIEW ENRICHED ══ */}
                {stage === 'enriched' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <p style={{ ...sectionLabel, margin: 0 }}>Sorted by score — untick anything you don&apos;t want in the catalog</p>
                      <button onClick={() => setKeep(new Set(enriched.map((_, i) => i)))} style={{ fontSize: '11.5px', fontWeight: 600, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer' }}>All</button>
                      <button onClick={() => setKeep(new Set())} style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>None</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                      {enriched.map((c, i) => {
                        const on = keep.has(i)
                        const open = expanded === i
                        return (
                          <div key={i} style={{
                            borderRadius: '12px', padding: '14px 16px',
                            border: `1px solid ${on ? 'rgba(79,123,247,0.4)' : 'var(--border)'}`,
                            background: on ? 'rgba(79,123,247,0.05)' : 'var(--bg-card)',
                          }}>
                            <div style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                              <input type="checkbox" checked={on} onChange={() => toggleKeep(i)} style={{ marginTop: '5px', flexShrink: 0, accentColor: '#4F7BF7' }} />

                              {/* SCORE */}
                              <div style={{ flexShrink: 0, textAlign: 'center', width: '46px' }}>
                                <p style={{ fontSize: '21px', fontWeight: 800, margin: 0, color: GRADE_COLOR[c.grade] || '#9CA3AF', lineHeight: 1.1 }}>{Math.round(c.score)}</p>
                                <p style={{ fontSize: '10px', fontWeight: 700, margin: 0, color: GRADE_COLOR[c.grade] || '#9CA3AF' }}>{c.grade}</p>
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>{c.name}</span>
                                  {c.confidence && (
                                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: CONFIDENCE_COLOR[c.confidence] || '#9CA3AF' }}>{c.confidence} confidence</span>
                                  )}
                                  {c.enriched === false && (
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#FB923C' }}>not researched</span>
                                  )}
                                  {c.fails_rules?.map(f => (
                                    <span key={f} style={{ fontSize: '10px', fontWeight: 600, color: '#FB923C', background: 'rgba(251,146,60,0.1)', padding: '2px 7px', borderRadius: '999px' }}>{f}</span>
                                  ))}
                                </div>
                                <p style={{ fontSize: '12px', color: '#60A5FA', margin: '2px 0 0', fontWeight: 600 }}>{c.verdict}</p>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                                  {[c.city, c.country, c.industry || c.segment, c.company_size].filter(Boolean).join(' · ')}
                                </p>

                                {c.evidence && (
                                  <p style={{ fontSize: '12px', color: 'var(--text)', margin: '8px 0 0', lineHeight: 1.6, paddingLeft: '10px', borderLeft: '2px solid rgba(79,123,247,0.35)' }}>{c.evidence}</p>
                                )}
                                {c.why && <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '6px 0 0', lineHeight: 1.6 }}>{c.why}</p>}

                                {/* SCORE BREAKDOWN */}
                                <button onClick={() => setExpanded(open ? null : i)}
                                  style={{ fontSize: '11.5px', fontWeight: 600, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 0 0' }}>
                                  {open ? 'Hide score breakdown' : 'Why this score?'}
                                </button>
                                {open && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '7px', padding: '10px 12px', borderRadius: '9px', background: 'var(--bg-input)' }}>
                                    {c.breakdown.map(b => (
                                      <div key={b.axis} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', width: '84px', flexShrink: 0 }}>{b.axis}</span>
                                        <div style={{ flex: 1, height: '5px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden', minWidth: '50px' }}>
                                          <div style={{ width: `${Math.max(0, (b.points / b.max) * 100)}%`, height: '100%', background: '#4F7BF7' }} />
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)', width: '40px', textAlign: 'right', flexShrink: 0 }}>{b.points}/{b.max}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.note}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* EDIT BEFORE IT LANDS IN THE SHARED CATALOG */}
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '7px', marginTop: '10px' }}>
                                  <input value={c.email || ''} onChange={e => editEnriched(i, 'email', e.target.value)} placeholder="email — blank if none found" style={{ ...input, fontSize: '12px', padding: '7px 9px' }} />
                                  <input value={c.website || ''} onChange={e => editEnriched(i, 'website', e.target.value)} placeholder="website" style={{ ...input, fontSize: '12px', padding: '7px 9px' }} />
                                </div>

                                <div style={{ display: 'flex', gap: '12px', marginTop: '9px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {c.source_url
                                    ? <a href={c.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: '#60A5FA', textDecoration: 'none' }}>📎 {c.source || 'Source'}</a>
                                    : c.source && <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>📎 {c.source}</span>}
                                  {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: '#60A5FA', textDecoration: 'none' }}>LinkedIn</a>}
                                  {c.instagram && <a href={c.instagram} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: '#60A5FA', textDecoration: 'none' }}>Instagram</a>}
                                  {c.signals?.map(s => (
                                    <span key={s} style={{ fontSize: '10.5px', color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '2px 7px', borderRadius: '999px' }}>{s.replace(/_/g, ' ')}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingBottom: '30px' }}>
                      <button onClick={saveChosen} disabled={saving || keep.size === 0}
                        style={{ padding: '11px 24px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#34D399,#10B981)', border: 'none', cursor: 'pointer', opacity: saving || keep.size === 0 ? 0.55 : 1 }}>
                        {saving ? 'Adding…' : `✓ Add ${keep.size} to catalog`}
                      </button>
                      <button onClick={() => { setStage('scouted'); setKeep(new Set(scouted.map((_, i) => i))); setMsg('') }}
                        style={{ padding: '11px 16px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                        ← Back to shortlist
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ══ SAVED HUNTS ══ */}
            {tab === 'saved' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {hunts.length === 0 && (
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.7 }}>
                    No saved hunts yet. Build a set of criteria, name it, and save — then you can
                    re-run it monthly without rebuilding the filters.
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
                      style={{ padding: '8px 15px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer' }}>Load</button>
                    <button onClick={() => deleteHunt(h.id)}
                      style={{ padding: '8px 12px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', cursor: 'pointer' }}>Delete</button>
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
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: r.stage === 'enrich' ? '#A78BFA' : '#60A5FA' }}>{r.stage}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{new Date(r.created_at).toLocaleString()}</span>
                      {r.error ? (
                        <span style={{ fontSize: '12px', color: '#F87171' }}>failed — {r.error}</span>
                      ) : (
                        <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                          <strong style={{ color: '#60A5FA' }}>{r.found}</strong> {r.stage === 'enrich' ? 'researched' : 'found'} ·{' '}
                          <strong style={{ color: '#34D399' }}>{r.fresh}</strong> new ·{' '}
                          <strong style={{ color: 'var(--text)' }}>{r.added}</strong> added
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '4px 0 0', lineHeight: 1.5 }}>
                      {(r.input_tokens || r.output_tokens)
                        ? `${(r.input_tokens || 0).toLocaleString()} in · ${(r.output_tokens || 0).toLocaleString()} out tokens`
                        : '—'}
                      {r.criteria?.countries ? ` · ${r.criteria.countries}` : ''}
                      {Array.isArray(r.criteria?.sources) ? ` · ${r.criteria.sources.length} sources` : ''}
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
