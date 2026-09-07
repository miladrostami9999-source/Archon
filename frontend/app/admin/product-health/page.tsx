'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import AdminSideNav from '../../components/AdminSideNav'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Info, TrendingDown } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface FunnelStep { step: string; count: number; pct_of_signups: number; pct_of_previous: number | null }
interface Health {
  total_users: number
  activation: { crm_pct: number; marketplace_pct: number; email_sent_pct: number }
  retention: { active_7d_pct: number; active_7d_eligible: number; active_30d_pct: number; active_30d_eligible: number }
  marketplace_funnel: FunnelStep[]
  marketplace_kpis: {
    total_projects: number; projects_with_proposal_pct: number; projects_with_contract_pct: number
    total_contracts: number; active_contracts: number; completed_contracts: number
    completed_contracts_pct: number; disputed_contracts: number
  }
}

const card: React.CSSProperties = { borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }
const sectionHeader: React.CSSProperties = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', margin: '0 0 12px' }

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={card}>
      <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '0 0 6px' }}>{label}</p>
      <p className="mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}

export default function ProductHealthPage() {
  const isMobile = useIsMobile()
  const [data, setData] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('archon-user')
      if (stored && JSON.parse(stored).role !== 'admin') window.location.href = '/dashboard'
    } catch {}
  }, [])

  useEffect(() => {
    axios.get(`${API}/auth/admin/product-health`, { headers: headers() })
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const funnel = data?.marketplace_funnel || []
  const maxFunnel = Math.max(1, ...funnel.map(f => f.count))
  const mp = data?.marketplace_kpis

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', minWidth: 0, marginTop: isMobile ? '52px' : 0, height: isMobile ? 'calc(100vh - 52px)' : '100vh', overflowY: 'auto' }}>

        <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px', padding: isMobile ? '0 16px' : '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Product Health</h1>
        </div>

        <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>
          {!isMobile && <AdminSideNav active="/admin/product-health" />}

          <main style={{ flex: 1, minWidth: 0, maxWidth: '1000px' }}>
            {loading || !data ? (
              <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Loading…</p>
            ) : (
              <>
                {/* ── راهنمای فارسی ── */}
                <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-dim)', background: 'linear-gradient(135deg, rgba(61,79,224,0.06), rgba(46,59,176,0.03))', padding: '18px 20px', marginBottom: '24px', direction: 'rtl', textAlign: 'right' }}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', fontSize: '13px', fontWeight: 700, color: 'var(--accent)', margin: '0 0 10px' }}>
                    راهنمای بررسی سلامت مارکت‌پلیس <Info size={15} strokeWidth={1.75} />
                  </p>
                  <ol style={{ margin: 0, paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                    <li><strong style={{ color: 'var(--text)' }}>«قیف مارکت‌پلیس»</strong> رو نگاه کن — چهار پله از بالا به پایین. هر پله باید کمتر از پله‌ی قبلش باشه؛ عدد مهم، درصد افتِ بین دو پله‌ست (زیر هر نوار نوشته شده).</li>
                    <li>اگه بین «ثبت‌نام» و «پست پروژه یا پروپوزال» افت زیاده → یعنی کاربرا اصلاً مارکت‌پلیس رو کشف/امتحان نمی‌کنن (مشکل آنبوردینگ یا دیده‌شدن).</li>
                    <li>اگه بین «پست/پروپوزال» و «قرارداد» افت زیاده → یعنی پروژه‌ها پیشنهاد می‌گیرن ولی به قرارداد نمی‌رسن (مشکل قیمت/اعتماد/فرآیند accept).</li>
                    <li>اگه بین «قرارداد» و «قرارداد تکمیل‌شده» افت زیاده → یعنی قراردادها شروع می‌شن ولی تموم نمی‌شن (مشکل تحویل کار یا پرداخت).</li>
                    <li>کارت‌های «KPI مارکت‌پلیس» زیرش جزئیات همون قیف رو در سطح پروژه/قرارداد نشون می‌دن (نه اکانت) — برای اینکه ببینی مشکل مال «تعداد کم» است یا «نرخ تبدیل کم».</li>
                    <li style={{ color: 'var(--text-dim)' }}>عدد کم بودن طبیعیه چون هنوز کاربر واقعی کمه — این صفحه برای رصد <strong>روند</strong>ه، نه قضاوت فوری.</li>
                  </ol>
                </div>

                {/* ── OVERVIEW ── */}
                <p style={sectionHeader}>Overview</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
                  <Kpi label="Total signups" value={String(data.total_users)} />
                  <Kpi label="CRM activation" value={`${data.activation.crm_pct}%`} sub="added ≥1 company" />
                  <Kpi label="Marketplace activation" value={`${data.activation.marketplace_pct}%`} sub="posted or proposed" />
                  <Kpi label="Sent an email" value={`${data.activation.email_sent_pct}%`} />
                </div>

                {/* ── RETENTION ── */}
                <p style={sectionHeader}>Retention</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)', gap: '12px', marginBottom: '28px' }}>
                  <Kpi label="Active in last 7 days" value={`${data.retention.active_7d_pct}%`} sub={`of ${data.retention.active_7d_eligible} accounts ≥7 days old`} />
                  <Kpi label="Active in last 30 days" value={`${data.retention.active_30d_pct}%`} sub={`of ${data.retention.active_30d_eligible} accounts ≥30 days old`} />
                </div>

                {/* ── MARKETPLACE FUNNEL ── */}
                <p style={sectionHeader}>Marketplace funnel — accounts, not events</p>
                <div style={{ ...card, marginBottom: '28px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {funnel.map((f, i) => (
                      <div key={f.step}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>{f.step}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="mono" style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 700 }}>{f.count}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>({f.pct_of_signups}% of signups)</span>
                          </span>
                        </div>
                        <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '10px' }}>
                          <div style={{ height: '100%', borderRadius: '999px', background: 'var(--accent)', width: `${(f.count / maxFunnel) * 100}%`, transition: 'width 0.3s' }} />
                        </div>
                        {i > 0 && f.pct_of_previous !== null && (
                          <p style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: f.pct_of_previous < 50 ? 'var(--warning)' : 'var(--text-dim)', margin: '5px 0 0' }}>
                            <TrendingDown size={11} strokeWidth={2} /> {f.pct_of_previous}% of the previous step
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── MARKETPLACE KPIs ── */}
                <p style={sectionHeader}>Marketplace KPIs — project/contract-level detail</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                  <Kpi label="Total projects posted" value={String(mp?.total_projects ?? 0)} />
                  <Kpi label="Got ≥1 proposal" value={`${mp?.projects_with_proposal_pct ?? 0}%`} />
                  <Kpi label="Led to a contract" value={`${mp?.projects_with_contract_pct ?? 0}%`} />
                  <Kpi label="Total contracts" value={String(mp?.total_contracts ?? 0)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
                  <Kpi label="Active contracts" value={String(mp?.active_contracts ?? 0)} />
                  <Kpi label="Completed contracts" value={String(mp?.completed_contracts ?? 0)} sub={`${mp?.completed_contracts_pct ?? 0}% of all contracts`} />
                  <Kpi label="Disputed contracts" value={String(mp?.disputed_contracts ?? 0)} />
                  <Kpi label="Sample size" value={String(mp?.total_projects ?? 0)} sub="projects — small samples swing a lot" />
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
