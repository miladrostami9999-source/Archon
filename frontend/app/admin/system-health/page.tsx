'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import AdminSideNav from '../../components/AdminSideNav'
import { useIsMobile } from '../../hooks/useIsMobile'
import { DatabaseBackup, CircleCheck, CircleX, Circle, Pencil, Trash2, AlertOctagon, AlertTriangle, Info } from 'lucide-react'
import InlineStatus from '../../components/InlineStatus'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface JobStatus { job_id: string; last_status: string | null; last_ran_at: string | null; last_detail: string | null; next_run_time: string | null }
interface Backup { filename: string; size_kb: number; created_at: string }
interface ActivityRow { id: number; admin_name: string; action: string; target: string; detail: string; created_at: string }
interface ExchangeRate { rate: number | null; source: string; fetched_at: string | null; mode?: string }
interface LogEntry { id: number; level: string; source: string; message: string; detail: string; created_at: string }

export default function SystemHealthPage() {
  const isMobile = useIsMobile()
  const [jobs, setJobs] = useState<JobStatus[]>([])
  const [latestBackup, setLatestBackup] = useState<Backup | null>(null)
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null)
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [backing, setBacking] = useState(false)
  const [backMsg, setBackMsg] = useState('')

  const [editingRate, setEditingRate] = useState(false)
  const [rateMode, setRateMode] = useState<'auto' | 'manual'>('auto')
  const [manualRateInput, setManualRateInput] = useState('')
  const [savingRate, setSavingRate] = useState(false)

  const [logLevel, setLogLevel] = useState<string>('')
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [retentionDays, setRetentionDays] = useState(14)
  const [expandedLog, setExpandedLog] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('archon-user')
      if (stored && JSON.parse(stored).role !== 'admin') window.location.href = '/dashboard'
    } catch {}
  }, [])

  const loadHealth = () => {
    axios.get(`${API}/auth/admin/system-health`, { headers: headers() }).then(res => {
      setJobs(res.data.jobs || [])
      setLatestBackup(res.data.latest_backup || null)
      setExchangeRate(res.data.exchange_rate || null)
      setRateMode((res.data.exchange_rate?.mode as 'auto' | 'manual') || 'auto')
    }).catch(() => {})
  }

  const loadLog = () => {
    axios.get(`${API}/auth/admin/platform-log`, { headers: headers(), params: { limit: 100, ...(logLevel ? { level: logLevel } : {}) } })
      .then(res => { setLogEntries(res.data.entries || []); setRetentionDays(res.data.retention_days || 14) })
      .catch(() => {})
  }

  useEffect(() => {
    loadHealth()
    axios.get(`${API}/auth/admin/activity-log`, { headers: headers(), params: { limit: 50 } }).then(res => setActivity(res.data || [])).catch(() => {})
  }, [])

  useEffect(() => { loadLog() }, [logLevel])

  const runBackup = async () => {
    setBacking(true); setBackMsg('')
    try {
      const res = await axios.post(`${API}/companies/backup/run`, {}, { headers: headers() })
      setBackMsg(`✓ Saved ${res.data.filename} (${res.data.size_kb} KB)`)
      loadHealth()
    } catch {
      setBackMsg('✗ Backup failed — check server logs')
    }
    setBacking(false)
  }

  const openRateEditor = () => {
    setManualRateInput(exchangeRate?.mode === 'manual' && exchangeRate.rate ? String(exchangeRate.rate) : '')
    setEditingRate(true)
  }

  const saveRateSettings = async () => {
    setSavingRate(true)
    try {
      const payload: any = { mode: rateMode }
      if (rateMode === 'manual') payload.manual_rate = manualRateInput
      const res = await axios.put(`${API}/auth/admin/exchange-rate/settings`, payload, { headers: headers() })
      setExchangeRate(res.data)
      setEditingRate(false)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Could not save exchange rate settings')
    }
    setSavingRate(false)
  }

  const clearLog = async () => {
    if (!window.confirm('Clear the entire platform diagnostics log? This cannot be undone.')) return
    setClearing(true)
    try {
      await axios.delete(`${API}/auth/admin/platform-log`, { headers: headers() })
      loadLog()
    } catch {}
    setClearing(false)
  }

  const StatusIcon = ({ status }: { status: string | null }) => {
    if (status === 'success') return <CircleCheck size={15} strokeWidth={1.5} color="var(--success)" />
    if (status === 'failed') return <CircleX size={15} strokeWidth={1.5} color="var(--error)" />
    return <Circle size={15} strokeWidth={1.5} color="var(--text-dim)" />
  }

  const LevelIcon = ({ level }: { level: string }) => {
    if (level === 'error') return <AlertOctagon size={13} strokeWidth={1.5} color="var(--error)" />
    if (level === 'warning') return <AlertTriangle size={13} strokeWidth={1.5} color="var(--warning)" />
    return <Info size={13} strokeWidth={1.5} color="var(--text-dim)" />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', minWidth: 0, marginTop: isMobile ? '52px' : 0, height: isMobile ? 'calc(100vh - 52px)' : '100vh', overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px', padding: isMobile ? '0 16px' : '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>System Health</h1>
        </div>

        <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>
          {!isMobile && <AdminSideNav active="/admin/system-health" />}

          <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>

            {/* CRON JOBS */}
            <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 14px' }}>Background jobs</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {jobs.map(j => (
                  <div key={j.job_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)' }}>
                    <StatusIcon status={j.last_status} />
                    <span className="mono" style={{ fontSize: '12.5px', color: 'var(--text)', flex: 1 }}>{j.job_id}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {j.last_ran_at ? `last: ${new Date(j.last_ran_at).toLocaleString()}` : 'never run'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {j.next_run_time ? `next: ${new Date(j.next_run_time).toLocaleString()}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* BACKUP + EXCHANGE RATE */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 10px' }}>Backups</h2>
                {latestBackup ? (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                    Latest: <span className="mono">{latestBackup.filename}</span> — {latestBackup.size_kb} KB — {new Date(latestBackup.created_at).toLocaleString()}
                  </p>
                ) : (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '0 0 12px' }}>No backups yet.</p>
                )}
                <button onClick={runBackup} disabled={backing}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: backing ? 0.6 : 1 }}>
                  <DatabaseBackup size={15} strokeWidth={1.5} /> {backing ? 'Backing up…' : 'Run backup now'}
                </button>
                {backMsg && <div style={{ marginTop: '8px' }}><InlineStatus text={backMsg} size={11.5} /></div>}
              </div>

              <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Exchange rate</h2>
                  {!editingRate && (
                    <button onClick={openRateEditor} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      <Pencil size={12} strokeWidth={1.5} /> Edit
                    </button>
                  )}
                </div>

                {editingRate ? (
                  <div>
                    <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px', marginBottom: '10px', width: 'fit-content' }}>
                      {(['auto', 'manual'] as const).map(m => (
                        <button key={m} onClick={() => setRateMode(m)}
                          style={{ padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', textTransform: 'capitalize', background: rateMode === m ? 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' : 'transparent', color: rateMode === m ? 'white' : 'var(--text-muted)' }}>
                          {m}
                        </button>
                      ))}
                    </div>
                    {rateMode === 'auto' ? (
                      <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '0 0 12px', lineHeight: 1.5 }}>Always reads the live rate from tgju.org (falls back to a second source, then the last cached value).</p>
                    ) : (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>Fixed rate (Toman per $1)</label>
                        <input value={manualRateInput} onChange={e => setManualRateInput(e.target.value)} placeholder="e.g. 202000"
                          style={{ width: '160px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: 'var(--text)', outline: 'none' }} />
                        <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '6px 0 0' }}>While manual, this number is used everywhere — it will not auto-update.</p>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={saveRateSettings} disabled={savingRate || (rateMode === 'manual' && !manualRateInput.trim())}
                        style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: savingRate ? 0.6 : 1 }}>
                        {savingRate ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingRate(false)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '12.5px', color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : exchangeRate?.rate ? (
                  <>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                      <span className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{exchangeRate.rate.toLocaleString('en-US')}</span> Toman / $1
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }}>
                      {exchangeRate.mode === 'manual' ? 'Manual — ' : 'Auto — '}source: {exchangeRate.source}
                      {exchangeRate.fetched_at ? ` · fetched ${new Date(exchangeRate.fetched_at).toLocaleString()}` : ''}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: 0 }}>Unavailable.</p>
                )}
              </div>
            </div>

            {/* PLATFORM DIAGNOSTICS LOG */}
            <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Platform diagnostics</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select value={logLevel} onChange={e => setLogLevel(e.target.value)}
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', color: 'var(--text)', outline: 'none' }}>
                    <option value="">All levels</option>
                    <option value="error">Errors</option>
                    <option value="warning">Warnings</option>
                    <option value="info">Info</option>
                  </select>
                  <button onClick={clearLog} disabled={clearing}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '11.5px', fontWeight: 600, color: 'var(--error)', background: 'rgba(198,69,69,0.1)', border: '1px solid rgba(198,69,69,0.25)', cursor: 'pointer', opacity: clearing ? 0.6 : 1 }}>
                    <Trash2 size={12} strokeWidth={1.5} /> Clear
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '0 0 14px' }}>
                Server-side errors and warnings across the whole platform — not personal user activity. Entries older than {retentionDays} days are trimmed automatically every night.
              </p>
              {logEntries.length === 0 ? (
                <p style={{ fontSize: '12.5px', color: 'var(--success)' }}>✓ Nothing logged — no errors or warnings recently.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
                  {logEntries.map(l => (
                    <div key={l.id} onClick={() => setExpandedLog(expandedLog === l.id ? null : l.id)}
                      style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', fontSize: '12px', cursor: l.detail ? 'pointer' : 'default' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                        <LevelIcon level={l.level} />
                        <span style={{ color: 'var(--text-dim)', flexShrink: 0, width: '140px' }} className="mono">{new Date(l.created_at).toLocaleString()}</span>
                        <span className="mono" style={{ color: 'var(--accent)', flexShrink: 0 }}>{l.source}</span>
                        <span style={{ color: 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.message}</span>
                      </div>
                      {expandedLog === l.id && l.detail && (
                        <pre style={{ margin: '8px 0 0', padding: '10px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '10.5px', color: 'var(--text-dim)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{l.detail}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ADMIN ACTIVITY LOG */}
            <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 14px' }}>Recent admin activity</h2>
              {activity.length === 0 ? (
                <p style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>No admin actions logged yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
                  {activity.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-dim)', flexShrink: 0, width: '140px' }} className="mono">{new Date(a.created_at).toLocaleString()}</span>
                      <span style={{ color: 'var(--text)', fontWeight: 600, flexShrink: 0 }}>{a.admin_name}</span>
                      <span className="mono" style={{ color: 'var(--accent)', flexShrink: 0 }}>{a.action}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{a.target}{a.detail ? ` — ${a.detail}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
