'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import AdminSideNav from '../../components/AdminSideNav'
import { useIsMobile } from '../../hooks/useIsMobile'
import { DatabaseBackup, CircleCheck, CircleX, Circle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface JobStatus { job_id: string; last_status: string | null; last_ran_at: string | null; last_detail: string | null; next_run_time: string | null }
interface Backup { filename: string; size_kb: number; created_at: string }
interface ActivityRow { id: number; admin_name: string; action: string; target: string; detail: string; created_at: string }

export default function SystemHealthPage() {
  const isMobile = useIsMobile()
  const [jobs, setJobs] = useState<JobStatus[]>([])
  const [latestBackup, setLatestBackup] = useState<Backup | null>(null)
  const [exchangeRate, setExchangeRate] = useState<{ rate: number; source: string; fetched_at: string } | null>(null)
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [backing, setBacking] = useState(false)
  const [backMsg, setBackMsg] = useState('')

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
    }).catch(() => {})
  }

  useEffect(() => {
    loadHealth()
    axios.get(`${API}/auth/admin/activity-log`, { headers: headers(), params: { limit: 50 } }).then(res => setActivity(res.data || [])).catch(() => {})
  }, [])

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

  const StatusIcon = ({ status }: { status: string | null }) => {
    if (status === 'success') return <CircleCheck size={15} strokeWidth={1.5} color="var(--success)" />
    if (status === 'failed') return <CircleX size={15} strokeWidth={1.5} color="var(--error)" />
    return <Circle size={15} strokeWidth={1.5} color="var(--text-dim)" />
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
                {backMsg && <p style={{ fontSize: '11.5px', color: backMsg.startsWith('✓') ? 'var(--success)' : 'var(--error)', margin: '8px 0 0' }}>{backMsg}</p>}
              </div>

              <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 10px' }}>Exchange rate</h2>
                {exchangeRate ? (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                    <span className="mono">{exchangeRate.rate?.toLocaleString('en-US')}</span> Toman / $1 — source: {exchangeRate.source} — fetched {new Date(exchangeRate.fetched_at).toLocaleString()}
                  </p>
                ) : (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: 0 }}>Unavailable.</p>
                )}
              </div>
            </div>

            {/* ACTIVITY LOG */}
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
