'use client'
import { useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'

const API = 'http://localhost:8000'

export default function AdminPanel() {
  const [recalculating, setRecalculating] = useState(false)
  const [recalcMsg, setRecalcMsg] = useState('')
  const [backing, setBacking] = useState(false)
  const [backMsg, setBackMsg] = useState('')

  const recalcScores = async () => {
    setRecalculating(true); setRecalcMsg('')
    try {
      const res = await axios.post(`${API}/companies/recalculate-scores`)
      setRecalcMsg(res.data.message)
    } catch { setRecalcMsg('Error recalculating scores') }
    setRecalculating(false)
  }

  const card: React.CSSProperties = {
    borderRadius: '12px', border: '1px solid var(--border)',
    background: 'var(--bg-card)', padding: '20px',
    transition: 'background 0.25s, border-color 0.25s',
  }

  const tools = [
    {
      icon: '📥', title: 'Import CSV', desc: 'Bulk import companies',
      button: { label: 'Open Import', color: '#60A5FA', bg: 'rgba(79,123,247,0.1)', border: 'rgba(79,123,247,0.2)', action: () => window.location.href = '/import' },
    },
    {
      icon: '📤', title: 'Export CSV', desc: 'Download all companies',
      button: { label: 'Download CSV', color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)', action: () => window.open(`${API}/companies/export/csv`, '_blank') },
    },
    {
      icon: '🔄', title: 'Recalculate Scores', desc: 'Update opportunity scores',
      button: { label: recalculating ? 'Recalculating...' : 'Recalculate All', color: '#FBBF24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', action: recalcScores },
      msg: recalcMsg, msgColor: '#34D399',
    },
    {
      icon: '💾', title: 'Manual Backup', desc: 'Auto backup runs daily at 10:00',
      button: {
        label: backing ? 'Running...' : 'Run Backup', color: '#A78BFA', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)',
        action: () => { setBacking(true); setTimeout(() => { setBackMsg('Run backup.py manually from terminal'); setBacking(false) }, 1000) }
      },
      msg: backMsg, msgColor: 'var(--text-muted)',
    },
    {
      icon: '📊', title: 'Weekly AI Report', desc: 'AI-powered weekly business summary',
      button: { label: 'Generate Report', color: '#60A5FA', bg: 'rgba(79,123,247,0.1)', border: 'rgba(79,123,247,0.2)', action: () => window.location.href = '/report' },
    },
    {
      icon: '📖', title: 'API Documentation', desc: 'FastAPI Swagger UI',
      button: { label: 'Open Docs', color: 'var(--text-muted)', bg: 'var(--bg-input)', border: 'var(--border)', action: () => window.open('http://localhost:8000/docs', '_blank') },
    },
    {
      icon: '📈', title: 'Analytics', desc: 'Full performance report',
      button: { label: 'View Analytics', color: '#60A5FA', bg: 'rgba(79,123,247,0.1)', border: 'rgba(79,123,247,0.2)', action: () => window.location.href = '/analytics' },
    },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '224px' }}>

        {/* HEADER */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', transition: 'border-color 0.25s' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Admin Panel</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-dim)', margin: '4px 0 0' }}>System management and tools</p>
        </div>

        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '900px' }}>
          {tools.map((tool) => (
            <div key={tool.title} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px' }}>{tool.icon}</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', margin: 0 }}>{tool.title}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{tool.desc}</p>
                </div>
              </div>
              <button
                onClick={tool.button.action}
                disabled={
                  (tool.title === 'Recalculate Scores' && recalculating) ||
                  (tool.title === 'Manual Backup' && backing)
                }
                style={{
                  width: '100%', padding: '8px', borderRadius: '8px',
                  fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                  color: tool.button.color, background: tool.button.bg,
                  border: `1px solid ${tool.button.border}`,
                  transition: 'all 0.15s',
                  opacity: ((tool.title === 'Recalculate Scores' && recalculating) || (tool.title === 'Manual Backup' && backing)) ? 0.5 : 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                {tool.button.label}
              </button>
              {'msg' in tool && tool.msg && (
                <p style={{ fontSize: '12px', color: tool.msgColor, marginTop: '8px', marginBottom: 0 }}>{tool.msg}</p>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
