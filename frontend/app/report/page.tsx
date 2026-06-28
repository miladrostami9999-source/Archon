'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'

const API = 'http://localhost:8000'

interface Report {
  title: string; summary: string; pipeline_insight: string
  top_leads: string; follow_up_action: string
  email_performance: string; weekly_goals: string; motivation: string
}

const SECTIONS = [
  { key: 'summary',           icon: '📊', label: 'Executive Summary',   labelFa: 'خلاصه اجرایی',      color: '#4F7BF7', bg: 'rgba(79,123,247,0.06)' },
  { key: 'pipeline_insight',  icon: '🔄', label: 'Pipeline Health',     labelFa: 'سلامت پایپلاین',    color: '#8B5CF6', bg: 'rgba(139,92,246,0.06)' },
  { key: 'top_leads',         icon: '🎯', label: 'Top Leads',           labelFa: 'بهترین لیدها',       color: '#F59E0B', bg: 'rgba(245,158,11,0.06)' },
  { key: 'follow_up_action',  icon: '⏰', label: 'Follow-up Actions',   labelFa: 'پیگیری‌ها',          color: '#F97316', bg: 'rgba(249,115,22,0.06)' },
  { key: 'email_performance', icon: '✉', label:  'Email Performance',   labelFa: 'عملکرد ایمیل',       color: '#34D399', bg: 'rgba(52,211,153,0.06)' },
  { key: 'weekly_goals',      icon: '✦', label:  'Goals for Next Week', labelFa: 'اهداف هفته آینده',  color: '#14B8A6', bg: 'rgba(20,184,166,0.06)' },
] as const

export default function WeeklyReport() {
  const [lang, setLang] = useState<'en' | 'fa'>('en')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [lastGenerated, setLastGenerated] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>('')

  // Load report + timestamp from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('archon-report-generated')
    if (stored) setLastGenerated(Number(stored))
    const storedReport = localStorage.getItem('archon-report-data')
    if (storedReport) {
      try { setReport(JSON.parse(storedReport)) } catch {}
    }
    const storedLang = localStorage.getItem('archon-report-lang')
    if (storedLang === 'fa' || storedLang === 'en') setLang(storedLang)
  }, [])

  // Countdown timer
  useEffect(() => {
    if (!lastGenerated) return
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastGenerated
      const week = 7 * 24 * 60 * 60 * 1000
      const remaining = week - elapsed
      if (remaining <= 0) {
        setLastGenerated(null)
        setReport(null)
        localStorage.removeItem('archon-report-generated')
        localStorage.removeItem('archon-report-data')
        localStorage.removeItem('archon-report-lang')
        setTimeLeft('')
        clearInterval(interval)
      } else {
        const days = Math.floor(remaining / (24*60*60*1000))
        const hours = Math.floor((remaining % (24*60*60*1000)) / (60*60*1000))
        const mins = Math.floor((remaining % (60*60*1000)) / (60*1000))
        if (days > 0) setTimeLeft(`${days}d ${hours}h remaining`)
        else if (hours > 0) setTimeLeft(`${hours}h ${mins}m remaining`)
        else setTimeLeft(`${mins}m remaining`)
      }
    }, 60000)
    // Set immediately
    const elapsed = Date.now() - lastGenerated
    const week = 7 * 24 * 60 * 60 * 1000
    const remaining = week - elapsed
    if (remaining > 0) {
      const days = Math.floor(remaining / (24*60*60*1000))
      const hours = Math.floor((remaining % (24*60*60*1000)) / (60*60*1000))
      const mins = Math.floor((remaining % (60*60*1000)) / (60*1000))
      if (days > 0) setTimeLeft(`${days}d ${hours}h remaining`)
      else if (hours > 0) setTimeLeft(`${hours}h ${mins}m remaining`)
      else setTimeLeft(`${mins}m remaining`)
    }
    return () => clearInterval(interval)
  }, [lastGenerated])

  const isLocked = !!(lastGenerated && Date.now() - lastGenerated < 7 * 24 * 60 * 60 * 1000)

  const generate = async () => {
    if (isLocked) return
    setLoading(true); setError(''); setReport(null)
    try {
      const res = await axios.post(`${API}/companies/report/weekly`, { lang })
      setReport(res.data)
      const now = Date.now()
      setLastGenerated(now)
      localStorage.setItem('archon-report-generated', String(now))
      localStorage.setItem('archon-report-data', JSON.stringify(res.data))
      localStorage.setItem('archon-report-lang', lang)
    }
    catch { setError('Failed to generate. Check API key.') }
    setLoading(false)
  }

  const copyReport = () => {
    if (!report) return
    const isFa = lang === 'fa'
    const text = SECTIONS.map(s => `${s.icon} ${isFa ? s.labelFa : s.label}\n${report[s.key as keyof Report]}`).join('\n\n')
    navigator.clipboard.writeText(`${report.title}\n${'─'.repeat(40)}\n\n${text}\n\n─\n"${report.motivation}"`)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  const isFa = lang === 'fa'

  return (
    <div className="page-enter" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      <div style={{ flex: 1, marginLeft: '224px', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'auto' }}>

        {/* HEADER */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', transition: 'background 0.25s' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Weekly AI Report</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>Business development summary</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {report && (
              <button onClick={copyReport}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: copied ? 'rgba(52,211,153,0.1)' : 'var(--bg-input)', color: copied ? '#34D399' : 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s' }}>
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
            )}
            {report && (
              <div style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px' }}>
                {(['en','fa'] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: lang === l ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'transparent', color: lang === l ? 'white' : 'var(--text-muted)' }}>
                    {l === 'en' ? 'EN' : 'FA'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, padding: '24px 28px', maxWidth: '760px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

          {/* GENERATE CARD */}
          {!report && (
            <div style={{ borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '48px 32px', textAlign: 'center' }}>
              {/* Animated icon */}
              <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(79,123,247,0.15), rgba(124,58,237,0.15))', border: '1px solid rgba(79,123,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px' }}>
                📈
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                {isFa ? 'گزارش هفتگی هوش مصنوعی' : 'Weekly AI Report'}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 36px', lineHeight: 1.7, maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
                {isFa
                  ? 'Claude تمام داده‌های CRM شما را تحلیل کرده و یک گزارش هفتگی کامل تهیه می‌کند.'
                  : 'Claude analyzes your CRM data and generates a comprehensive weekly business development report.'}
              </p>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '13px', padding: '10px 16px', borderRadius: '8px', marginBottom: '20px' }}>
                  {error}
                </div>
              )}

              {/* Lang selector */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                {(['en','fa'] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    style={{ padding: '8px 24px', borderRadius: '8px', fontSize: '13px', border: lang === l ? 'none' : '1px solid var(--border)', background: lang === l ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'var(--bg-input)', color: lang === l ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s', fontWeight: lang === l ? 600 : 400 }}>
                    {l === 'en' ? '🇬🇧 English' : '🇮🇷 فارسی'}
                  </button>
                ))}
              </div>
              {isLocked ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '16px' }}>🔒</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>{isFa ? 'گزارش این هفته تولید شده' : 'Report already generated this week'}</span>
                  </div>
                  {timeLeft && <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>⏱ Next report available in: <strong style={{ color: '#FBBF24' }}>{timeLeft}</strong></p>}
                </div>
              ) : (
                <button onClick={generate} disabled={loading}
                  style={{ padding: '10px 28px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'rgba(79,123,247,0.5)' : 'linear-gradient(135deg, #4F7BF7, #7C3AED)', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: loading ? 'none' : '0 4px 16px rgba(79,123,247,0.3)', transition: 'all 0.15s' }}>
                  {loading ? <><div className="spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />{isFa ? 'در حال تولید...' : 'Generating...'}</> : `✦ ${isFa ? 'تولید گزارش' : 'Generate Report'}`}
                </button>
              )}

              {loading && (
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '16px' }}>
                  {isFa ? 'Claude در حال تحلیل داده‌های CRM شما است...' : 'Claude is analyzing your CRM data...'}
                </p>
              )}
            </div>
          )}

          {/* REPORT */}
          {report && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* TITLE */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>{report.title}</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
                    Generated by Claude AI
                    {lastGenerated && (
                      <span style={{ color: 'var(--text-dim)' }}>
                        · {new Date(lastGenerated).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>
                {/* Timer shown when locked */}
                {isLocked && timeLeft && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                    <span style={{ fontSize: '12px' }}>⏱</span>
                    <span style={{ fontSize: '11px', color: '#FBBF24', fontWeight: 500 }}>{timeLeft}</span>
                  </div>
                )}
              </div>

              {/* SECTIONS */}
              {SECTIONS.map(section => {
                const content = report[section.key as keyof Report]
                if (!content) return null
                return (
                  <div key={section.key} style={{ borderRadius: '14px', border: `1px solid ${section.color}20`, background: section.bg, padding: '18px 20px', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = section.color + '40'; e.currentTarget.style.transform = 'translateX(2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = section.color + '20'; e.currentTarget.style.transform = 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: section.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>{section.icon}</div>
                      <h3 style={{ fontSize: '11px', fontWeight: 700, color: section.color, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                        {isFa ? section.labelFa : section.label}
                      </h3>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line', direction: isFa ? 'rtl' : 'ltr', textAlign: isFa ? 'right' : 'left' }}>
                      {content}
                    </p>
                  </div>
                )
              })}

              {/* MOTIVATION */}
              {report.motivation && (
                <div style={{ borderRadius: '14px', border: '1px solid rgba(79,123,247,0.15)', background: 'linear-gradient(135deg, rgba(79,123,247,0.06), rgba(124,58,237,0.06))', padding: '20px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '16px', fontStyle: 'italic', color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.7, direction: isFa ? 'rtl' : 'ltr' }}>
                    "{report.motivation}"
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>— Claude AI</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner-sm { width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-top-color:white; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; }
      `}</style>
    </div>
  )
}
