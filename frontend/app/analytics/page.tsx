'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import ReplyTrendChart from '../components/ReplyTrendChart'
import { useIsMobile } from '../hooks/useIsMobile'
import {
  Building2, Zap, MessageCircle, Trophy, Mail as MailIcon, Target, Hourglass, Handshake,
  Flame, CloudSun, Snowflake, Gauge, Compass, CheckSquare, MessageSquareText,
  LayoutDashboard, TrendingUp, GitBranch, Search, Activity, Globe2,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface Analytics {
  total_companies: number
  favorites: number
  status_counts: Record<string, number>
  industries: { name: string; count: number }[]
  top_countries: { name: string; count: number }[]
  emails: { total: number; sent: number; replied: number }
  heat_counts: { hot: number; warm: number; cold: number }
  score_buckets: { poor: number; fair: number; good: number; great: number }
  pipeline_velocity_days: number | null
  task_completion: { done: number; total: number }
  tone_performance: { tone: string; sent: number; replied: number; reply_rate: number }[]
}

interface DiscoveryHuntRow {
  name: string; runs: number; found_total: number; added_total: number
  conversion_pct: number; last_run_at: string | null
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  new:      { color: '#3D4FE0', label: 'New' },
  reviewed: { color: '#8B5CF6', label: 'Reviewed' },
  ready:    { color: '#F59E0B', label: 'Ready' },
  sent:     { color: '#F97316', label: 'Sent' },
  waiting:  { color: '#64748B', label: 'Waiting' },
  replied:  { color: '#34D399', label: 'Replied' },
  meeting:  { color: '#14B8A6', label: 'Meeting' },
  client:   { color: '#10B981', label: 'Client' },
  archive:  { color: '#EF4444', label: 'Archive' },
}

interface EmailAnalytics {
  generated: number; sent: number; replied: number; drafts: number; reply_rate: number
}

const card: React.CSSProperties = {
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  padding: '20px',
}

const sectionHeader: React.CSSProperties = {
  fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)',
  textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px',
}

const SECTIONS = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'reply-trend', label: 'Reply Trend', Icon: TrendingUp },
  { id: 'pipeline', label: 'Pipeline', Icon: GitBranch },
  { id: 'leadgen', label: 'Lead Generation', Icon: Search },
  { id: 'activity', label: 'My Activity', Icon: Activity },
  { id: 'catalog', label: 'Catalog', Icon: Globe2 },
]

export default function Analytics() {
  const isMobile = useIsMobile()

  const [data, setData] = useState<Analytics | null>(null)
  const [email, setEmail] = useState<EmailAnalytics | null>(null)
  const [hunts, setHunts] = useState<DiscoveryHuntRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API}/companies/analytics/summary`, { headers: headers() })
      .then(res => { setData(res.data); setLoading(false) })
      .catch(() => setLoading(false))
    axios.get(`${API}/auth/email-analytics`, { headers: headers() }).then(r => setEmail(r.data)).catch(() => {})
    axios.get(`${API}/companies/analytics/discovery-roi`, { headers: headers() }).then(r => setHunts(r.data || [])).catch(() => {})
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid var(--accent-dim)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    </div>
  )

  if (!data) return null

  const maxIndustry = Math.max(...data.industries.map(i => i.count), 1)
  const maxCountry = Math.max(...data.top_countries.map(c => c.count), 1)
  const replyRate = data.emails.sent > 0 ? Math.round((data.emails.replied / data.emails.sent) * 100) : 0
  const activeCompanies = Object.entries(data.status_counts)
    .filter(([s]) => !['archive', 'new'].includes(s))
    .reduce((a, [, v]) => a + v, 0)
  const conversionRate = data.total_companies > 0
    ? Math.round((data.status_counts.client || 0) / data.total_companies * 100) : 0

  const heatTotal = data.heat_counts.hot + data.heat_counts.warm + data.heat_counts.cold
  const scoreTotal = data.score_buckets.poor + data.score_buckets.fair + data.score_buckets.good + data.score_buckets.great
  const taskPct = data.task_completion.total > 0 ? Math.round((data.task_completion.done / data.task_completion.total) * 100) : 0

  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', paddingTop: isMobile ? '52px' : 0 }}>

        {/* HEADER */}
        <div style={{
          position: 'sticky', top: isMobile ? '52px' : 0, zIndex: 20,
          padding: '16px 32px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-main)', backdropFilter: 'blur(12px)',
          transition: 'background 0.25s, border-color 0.25s',
        }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '2px 0 0' }}>Business development performance</p>
        </div>

        <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>

          {/* JUMP-TO-SECTION NAV — sticky, mirrors AdminSideNav's role but for
              in-page anchors instead of separate routes */}
          {!isMobile && (
            <aside style={{ width: '176px', flexShrink: 0, position: 'sticky', top: '90px', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => scroll(s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  <s.Icon size={14} strokeWidth={1.75} />
                  {s.label}
                </button>
              ))}
            </aside>
          )}

          <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '40px' }}>

          {/* ══════ OVERVIEW ══════ */}
          <section id="overview" style={{ scrollMarginTop: '90px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'Total Companies', value: data.total_companies, icon: Building2, sub: `${data.favorites} favorites` },
                { label: 'Active Pipeline', value: activeCompanies, icon: Zap, sub: 'in progress' },
                { label: 'Reply Rate', value: `${replyRate}%`, icon: MessageCircle, sub: `${data.emails.replied} of ${data.emails.sent} sent` },
                { label: 'Clients Won', value: data.status_counts.client || 0, icon: Trophy, sub: `${conversionRate}% conversion` },
              ].map(s => (
                <div key={s.label} style={card}>
                  <p style={{ margin: '0 0 8px' }}><s.icon size={18} strokeWidth={1.5} color="var(--text-muted)" /></p>
                  <p className="mono" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{s.value}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Heat + Score distribution — where the pipeline's quality actually sits */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div style={card}>
                <h2 style={sectionHeader}>Heat Distribution</h2>
                {heatTotal === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No pipeline activity yet.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {([
                      ['hot', Flame, 'Hot'],
                      ['warm', CloudSun, 'Warm'],
                      ['cold', Snowflake, 'Cold'],
                    ] as const).map(([key, Icon, label]) => (
                      <div key={key} style={{ flex: 1, borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', padding: '12px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 4px', display: 'flex', justifyContent: 'center' }}><Icon size={16} strokeWidth={1.5} color="var(--text-muted)" /></p>
                        <p className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{data.heat_counts[key]}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={card}>
                <h2 style={sectionHeader}>Score Distribution</h2>
                {scoreTotal === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No scored companies in your pipeline yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {([
                      ['poor', '0–39'], ['fair', '40–59'], ['good', '60–79'], ['great', '80–100'],
                    ] as const).map(([key, range]) => {
                      const count = data.score_buckets[key]
                      const pct = Math.round((count / scoreTotal) * 100)
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '52px', flexShrink: 0 }}>{range}</span>
                          <div style={{ flex: 1, background: 'var(--border)', borderRadius: '999px', height: '7px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: '999px', background: 'var(--accent)', width: `${pct}%` }} />
                          </div>
                          <span className="mono" style={{ fontSize: '11px', color: 'var(--text-dim)', width: '26px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ══════ REPLY TREND ══════ */}
          <section id="reply-trend" style={{ scrollMarginTop: '90px' }}>
            <ReplyTrendChart />
          </section>

          {/* ══════ PIPELINE ══════ */}
          <section id="pipeline" style={{ scrollMarginTop: '90px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={card}>
              <h2 style={sectionHeader}>Pipeline Funnel</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(data.status_counts)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
                    const meta = STATUS_META[status]
                    const pct = Math.round((count / data.total_companies) * 100)
                    return (
                      <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '96px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta?.color || '#64748B', flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{meta?.label || status}</span>
                        </div>
                        <div style={{ flex: 1, background: 'var(--border)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '999px', background: meta?.color || '#64748B', width: `${pct}%`, opacity: 0.8, transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '56px', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>{count}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
              </div>
              {data.pipeline_velocity_days !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <Gauge size={14} strokeWidth={1.75} color="var(--text-muted)" />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pipeline velocity — average time a moved company has spent in its current stage:</span>
                  <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{data.pipeline_velocity_days}d</span>
                </div>
              )}
            </div>
          </section>

          {/* ══════ LEAD GENERATION ══════ */}
          <section id="leadgen" style={{ scrollMarginTop: '90px' }}>
            <div style={card}>
              <h2 style={{ ...sectionHeader, display: 'flex', alignItems: 'center', gap: '7px' }}><Compass size={13} strokeWidth={1.75} /> Lead Hunter ROI</h2>
              {hunts.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No saved hunts yet — run one from Lead Hunter to see conversion here.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {hunts.map(h => (
                    <div key={h.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                      <span className="mono" style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>{h.runs} run{h.runs === 1 ? '' : 's'}</span>
                      <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{h.found_total} found → {h.added_total} added</span>
                      <span className="mono" style={{ fontSize: '12px', fontWeight: 700, color: h.conversion_pct >= 20 ? 'var(--success)' : 'var(--text-muted)', width: '48px', textAlign: 'right', flexShrink: 0 }}>{h.conversion_pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ══════ MY ACTIVITY ══════ */}
          <section id="activity" style={{ scrollMarginTop: '90px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {email && (
              <div style={card}>
                <h2 style={{ ...sectionHeader, margin: '0 0 4px' }}>My Outreach</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 16px' }}>Your own emails — separate from everyone else on the platform.</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px' }}>
                  {[
                    { label: 'Generated', value: email.generated },
                    { label: 'Sent', value: email.sent },
                    { label: 'Replies', value: email.replied },
                    { label: 'Reply rate', value: `${email.reply_rate}%`, color: email.reply_rate > 20 ? 'var(--success)' : 'var(--warning)' },
                  ].map(m => (
                    <div key={m.label} style={{ borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', padding: '12px' }}>
                      <p className="mono" style={{ fontSize: '18px', fontWeight: 700, color: m.color || 'var(--text)', margin: 0 }}>{m.value}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div style={card}>
                <h2 style={{ ...sectionHeader, display: 'flex', alignItems: 'center', gap: '7px' }}><CheckSquare size={13} strokeWidth={1.75} /> Task Completion (30d)</h2>
                {data.task_completion.total === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No daily tasks in the last 30 days.</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                      <span className="mono" style={{ fontSize: '26px', fontWeight: 800, color: taskPct >= 60 ? 'var(--success)' : 'var(--text)' }}>{taskPct}%</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{data.task_completion.done} of {data.task_completion.total} done</span>
                    </div>
                    <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '999px', background: taskPct >= 60 ? 'var(--success)' : 'var(--accent)', width: `${taskPct}%` }} />
                    </div>
                  </>
                )}
              </div>

              <div style={card}>
                <h2 style={{ ...sectionHeader, display: 'flex', alignItems: 'center', gap: '7px' }}><MessageSquareText size={13} strokeWidth={1.75} /> Reply Rate by Tone</h2>
                {data.tone_performance.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No sent emails with a tone recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    {data.tone_performance.map(t => (
                      <div key={t.tone} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', width: '76px', flexShrink: 0, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.tone}</span>
                        <div style={{ flex: 1, background: 'var(--border)', borderRadius: '999px', height: '7px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '999px', background: 'var(--accent)', width: `${t.reply_rate}%` }} />
                        </div>
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--text-dim)', width: '58px', textAlign: 'right', flexShrink: 0 }}>{t.reply_rate}% · {t.sent}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={card}>
              <h2 style={sectionHeader}>Quick Insights</h2>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px' }}>
                {[
                  { icon: MailIcon, label: 'Outreach Rate', value: data.total_companies > 0 ? `${Math.round(((data.emails.sent || 0) / data.total_companies) * 100)}%` : '0%', desc: 'companies emailed' },
                  { icon: Target, label: 'Hot Leads', value: data.status_counts.ready || 0, desc: 'ready to contact' },
                  { icon: Hourglass, label: 'Awaiting Reply', value: data.status_counts.waiting || 0, desc: 'need follow-up' },
                  { icon: Handshake, label: 'In Meeting', value: data.status_counts.meeting || 0, desc: 'active discussions' },
                ].map(item => (
                  <div key={item.label} style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-input)', padding: '12px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', display: 'flex', justifyContent: 'center' }}><item.icon size={18} strokeWidth={1.5} color="var(--text-muted)" /></p>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{item.value}</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{item.label}</p>
                    <p style={{ fontSize: '9px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══════ CATALOG BREAKDOWN ══════ */}
          <section id="catalog" style={{ scrollMarginTop: '90px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div style={card}>
                <h2 style={sectionHeader}>Industries</h2>
                {data.industries.length === 0 ? (
                  <p style={{ fontSize: '14px', color: 'var(--text-dim)', textAlign: 'center', padding: '16px 0' }}>No data</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {data.industries.map((item) => (
                      <div key={item.name}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{item.count}</span>
                        </div>
                        <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '6px' }}>
                          <div style={{
                            height: '100%', borderRadius: '999px',
                            width: `${(item.count / maxIndustry) * 100}%`,
                            background: 'var(--accent)',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={card}>
                <h2 style={sectionHeader}>Top Countries</h2>
                {data.top_countries.length === 0 ? (
                  <p style={{ fontSize: '14px', color: 'var(--text-dim)', textAlign: 'center', padding: '16px 0' }}>No data</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {data.top_countries.map(item => (
                      <div key={item.name}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{item.count}</span>
                        </div>
                        <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '6px' }}>
                          <div style={{ height: '100%', borderRadius: '999px', background: 'var(--accent)', width: `${(item.count / maxCountry) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          </main>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
