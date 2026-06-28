'use client'
import { useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'

const API = 'http://localhost:8000'

interface Report {
  title: string
  summary: string
  pipeline_insight: string
  top_leads: string
  follow_up_action: string
  email_performance: string
  weekly_goals: string
  motivation: string
}

const SECTIONS = [
  { key: 'summary',          icon: '📊', label: 'Executive Summary',     labelFa: 'خلاصه اجرایی' },
  { key: 'pipeline_insight', icon: '🔄', label: 'Pipeline Health',       labelFa: 'سلامت پایپلاین' },
  { key: 'top_leads',        icon: '🎯', label: 'Top Leads This Week',   labelFa: 'بهترین لیدهای هفته' },
  { key: 'follow_up_action', icon: '⏰', label: 'Follow-up Actions',     labelFa: 'اقدامات پیگیری' },
  { key: 'email_performance',icon: '✉',  label: 'Email Performance',     labelFa: 'عملکرد ایمیل' },
  { key: 'weekly_goals',     icon: '✦',  label: 'Goals for Next Week',   labelFa: 'اهداف هفته آینده' },
]

export default function WeeklyReport() {
  const [lang, setLang] = useState<'en' | 'fa'>('en')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const res = await axios.post(`${API}/companies/report/weekly`, { lang })
      setReport(res.data)
    } catch {
      setError('Failed to generate report. Check API key and backend.')
    }
    setLoading(false)
  }

  const copyReport = () => {
    if (!report) return
    const isFa = lang === 'fa'
    const text = `${report.title}
${'─'.repeat(40)}

${isFa ? '📊 خلاصه اجرایی' : '📊 Executive Summary'}
${report.summary}

${isFa ? '🔄 سلامت پایپلاین' : '🔄 Pipeline Health'}
${report.pipeline_insight}

${isFa ? '🎯 بهترین لیدهای هفته' : '🎯 Top Leads This Week'}
${report.top_leads}

${isFa ? '⏰ اقدامات پیگیری' : '⏰ Follow-up Actions'}
${report.follow_up_action}

${isFa ? '✉ عملکرد ایمیل' : '✉ Email Performance'}
${report.email_performance}

${isFa ? '✦ اهداف هفته آینده' : '✦ Goals for Next Week'}
${report.weekly_goals}

${'─'.repeat(40)}
${report.motivation}`

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isFa = lang === 'fa'
  const card: React.CSSProperties = {
    borderRadius: '12px', border: '1px solid var(--border)',
    background: 'var(--bg-card)', padding: '20px',
    transition: 'background 0.25s, border-color 0.25s',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      <div style={{ flex: 1, marginLeft: '224px', display: 'flex', flexDirection: 'column' }}>

        {/* HEADER */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', height: '56px',
          background: 'var(--bg-main)', borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)', transition: 'background 0.25s, border-color 0.25s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => window.location.href = '/admin'}
              style={{ fontSize: '14px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
              ← Back
            </button>
            <div>
              <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Weekly AI Report</h1>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>Business development summary</p>
            </div>
          </div>

          {report && (
            <button onClick={copyReport}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.4)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
              {copied ? '✅ Copied!' : '📋 Copy Report'}
            </button>
          )}
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, padding: '24px', maxWidth: '800px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

          {/* GENERATE CARD */}
          {!report && (
            <div style={{ ...card, textAlign: 'center', padding: '48px 32px' }}>
              <p style={{ fontSize: '40px', marginBottom: '16px' }}>📈</p>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
                {isFa ? 'گزارش هفتگی هوش مصنوعی' : 'Weekly AI Report'}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 32px', lineHeight: 1.6 }}>
                {isFa
                  ? 'Claude تمام داده‌های CRM شما را تحلیل کرده و یک گزارش جامع هفتگی تهیه می‌کند.'
                  : 'Claude analyzes your entire CRM data and generates a comprehensive weekly business development report.'}
              </p>

              {/* LANGUAGE TOGGLE */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                {(['en', 'fa'] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    style={{
                      padding: '8px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 500,
                      border: lang === l ? 'none' : '1px solid var(--border)',
                      background: lang === l ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'var(--bg-input)',
                      color: lang === l ? 'white' : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {l === 'en' ? '🇬🇧 English' : '🇮🇷 فارسی'}
                  </button>
                ))}
              </div>

              <button onClick={generate} disabled={loading}
                style={{ padding: '12px 32px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {loading ? (
                  <>
                    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    {isFa ? 'در حال تولید...' : 'Generating...'}
                  </>
                ) : (
                  <>{isFa ? '✦ تولید گزارش' : '✦ Generate Report'}</>
                )}
              </button>

              {loading && (
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '16px' }}>
                  {isFa ? 'Claude در حال تحلیل داده‌های شما است...' : 'Claude is analyzing your CRM data...'}
                </p>
              )}

              {error && (
                <div style={{ marginTop: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '13px', padding: '10px 16px', borderRadius: '8px' }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* REPORT */}
          {report && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* TITLE + REGENERATE */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{report.title}</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>
                    {isFa ? 'تولید شده توسط Claude AI' : 'Generated by Claude AI'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* LANG TOGGLE */}
                  <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px' }}>
                    {(['en', 'fa'] as const).map(l => (
                      <button key={l} onClick={() => setLang(l)}
                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', border: 'none', background: lang === l ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'transparent', color: lang === l ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {l === 'en' ? 'EN' : 'FA'}
                      </button>
                    ))}
                  </div>
                  <button onClick={generate} disabled={loading}
                    style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.4)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
                    {loading
                      ? <><div style={{ width: '12px', height: '12px', border: '2px solid rgba(79,123,247,0.3)', borderTop: '2px solid #4F7BF7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> {isFa ? 'در حال تولید...' : 'Generating...'}</>
                      : <>🔄 {isFa ? 'تولید مجدد' : 'Regenerate'}</>
                    }
                  </button>
                </div>
              </div>

              {/* SECTIONS */}
              {SECTIONS.map(section => {
                const content = report[section.key as keyof Report]
                if (!content) return null
                const isRtl = isFa
                return (
                  <div key={section.key} style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '16px' }}>{section.icon}</span>
                      <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                        {isFa ? section.labelFa : section.label}
                      </h3>
                    </div>
                    <p style={{
                      fontSize: '14px', color: 'var(--text)', lineHeight: 1.8, margin: 0,
                      whiteSpace: 'pre-line',
                      direction: isRtl ? 'rtl' : 'ltr',
                      textAlign: isRtl ? 'right' : 'left',
                    }}>
                      {content}
                    </p>
                  </div>
                )
              })}

              {/* MOTIVATION */}
              {report.motivation && (
                <div style={{ ...card, background: 'linear-gradient(135deg, rgba(79,123,247,0.08), rgba(124,58,237,0.08))', border: '1px solid rgba(79,123,247,0.15)', textAlign: 'center', padding: '24px' }}>
                  <p style={{ fontSize: '16px', fontStyle: 'italic', color: 'var(--text)', margin: 0, lineHeight: 1.6, direction: isFa ? 'rtl' : 'ltr' }}>
                    "{report.motivation}"
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '8px 0 0' }}>— Claude AI</p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
