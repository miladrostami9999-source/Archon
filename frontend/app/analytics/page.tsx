'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'
import { Building2, Zap, MessageCircle, Trophy, Mail as MailIcon, Target, Hourglass, Handshake } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Analytics {
  total_companies: number
  favorites: number
  status_counts: Record<string, number>
  industries: { name: string; count: number }[]
  top_countries: { name: string; count: number }[]
  emails: { total: number; sent: number; replied: number }
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
  monthly: { month: string; sent: number; replied: number }[]
}

const card: React.CSSProperties = {
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  padding: '20px',
}

export default function Analytics() {
  const isMobile = useIsMobile()

  const [data, setData] = useState<Analytics | null>(null)
  const [email, setEmail] = useState<EmailAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API}/companies/analytics/summary`)
      .then(res => { setData(res.data); setLoading(false) })
      .catch(() => setLoading(false))
    axios.get(`${API}/auth/email-analytics`).then(r => setEmail(r.data)).catch(() => {})
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

        <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '1000px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* KPI CARDS — one neutral style, organizational accent only */}
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

          {/* PIPELINE FUNNEL */}
          <div style={card}>
            <h2 style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Pipeline Funnel</h2>
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
          </div>

          {/* MY OUTREACH — this user's own numbers, kept separate and first since
              it's the thing a member checks most often about their own work */}
          {email && (
            <div style={card}>
              <h2 style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>My Outreach</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 16px' }}>Your own emails — separate from everyone else on the platform.</p>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px' }}>
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

              <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '0 0 8px' }}>Last 6 months</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '90px' }}>
                {email.monthly.map(m => {
                  const peak = Math.max(...email.monthly.map(x => x.sent), 1)
                  return (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '64px' }}>
                        <div title={`${m.sent} sent, ${m.replied} replied`}
                          style={{ width: '100%', height: `${Math.round((m.sent / peak) * 100)}%`, minHeight: m.sent ? '4px' : '2px', background: m.sent ? 'linear-gradient(180deg,#3D4FE0,#2E3BB0)' : 'var(--border)', borderRadius: '4px 4px 0 0', position: 'relative' }}>
                          {m.replied > 0 && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${Math.round((m.replied / Math.max(m.sent, 1)) * 100)}%`, background: 'var(--success)', borderRadius: '0 0 4px 4px' }} />
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{m.month.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '14px', marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: 'var(--accent)', marginRight: '5px' }} />Sent</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: 'var(--success)', marginRight: '5px' }} />Replied</span>
              </div>
            </div>
          )}

          {/* EMAIL STATS (platform-wide) + QUICK INSIGHTS side by side — both are
              small at-a-glance summaries, so pairing them keeps the page scannable */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <div style={card}>
              <h2 style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Email Campaign (whole team)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Generated', value: data.emails.total },
                  { label: 'Sent', value: data.emails.sent },
                  { label: 'Replied', value: data.emails.replied, color: 'var(--success)' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{item.value}</span>
                    </div>
                    <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '6px' }}>
                      <div style={{
                        height: '100%', borderRadius: '999px', background: item.color || 'var(--accent)',
                        width: `${data.emails.total > 0 ? (item.value / data.emails.total) * 100 : 0}%`,
                      }} />
                    </div>
                  </div>
                ))}
                <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Reply Rate</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: replyRate > 20 ? 'var(--success)' : 'var(--warning)' }}>{replyRate}%</span>
                </div>
              </div>
            </div>

            <div style={card}>
              <h2 style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Quick Insights</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { icon: MailIcon, label: 'Outreach Rate', value: data.total_companies > 0 ? `${Math.round(((data.emails.sent || 0) / data.total_companies) * 100)}%` : '0%', desc: 'companies emailed' },
                  { icon: Target, label: 'Hot Leads', value: data.status_counts.ready || 0, desc: 'ready to contact' },
                  { icon: Hourglass, label: 'Awaiting Reply', value: data.status_counts.waiting || 0, desc: 'need follow-up' },
                  { icon: Handshake, label: 'In Meeting', value: data.status_counts.meeting || 0, desc: 'active discussions' },
                ].map(item => (
                  <div key={item.label} style={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', padding: '12px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', display: 'flex', justifyContent: 'center' }}><item.icon size={18} strokeWidth={1.5} color="var(--text-muted)" /></p>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{item.value}</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{item.label}</p>
                    <p style={{ fontSize: '9px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CATALOG BREAKDOWN — industries + countries paired since both are
              "where is the catalog concentrated" views of the same shared data */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <div style={card}>
              <h2 style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Industries</h2>
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
              <h2 style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Top Countries</h2>
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

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
