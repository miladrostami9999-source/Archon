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
    setRecalculating(true)
    setRecalcMsg('')
    try {
      const res = await axios.post(`${API}/companies/recalculate-scores`)
      setRecalcMsg(res.data.message)
    } catch { setRecalcMsg('Error recalculating scores') }
    setRecalculating(false)
  }

  return (
    <div className="flex min-h-screen bg-[#0F1117]">
      <Sidebar />
      <div className="flex-1 ml-56">

        {/* HEADER */}
        <div className="px-8 py-6 border-b border-white/5">
          <h1 className="text-xl font-semibold text-white/85">Admin Panel</h1>
          <p className="text-sm text-white/30 mt-0.5">System management and tools</p>
        </div>

        <div className="px-8 py-6 grid grid-cols-2 gap-4 max-w-4xl">

          {/* IMPORT */}
          <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📥</span>
              <div>
                <p className="text-sm font-medium text-white/80">Import CSV</p>
                <p className="text-xs text-white/30">Bulk import companies</p>
              </div>
            </div>
            <button onClick={() => window.location.href = '/import'}
              className="w-full py-2 rounded-lg text-sm font-medium text-blue-400 border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/15 transition">
              Open Import
            </button>
          </div>

          {/* EXPORT */}
          <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📤</span>
              <div>
                <p className="text-sm font-medium text-white/80">Export CSV</p>
                <p className="text-xs text-white/30">Download all companies</p>
              </div>
            </div>
            <button onClick={() => window.open(`${API}/companies/export/csv`, '_blank')}
              className="w-full py-2 rounded-lg text-sm font-medium text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 transition">
              Download CSV
            </button>
          </div>

          {/* RECALCULATE SCORES */}
          <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🔄</span>
              <div>
                <p className="text-sm font-medium text-white/80">Recalculate Scores</p>
                <p className="text-xs text-white/30">Update opportunity scores</p>
              </div>
            </div>
            <button onClick={recalcScores} disabled={recalculating}
              className="w-full py-2 rounded-lg text-sm font-medium text-amber-400 border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/15 transition disabled:opacity-40">
              {recalculating ? 'Recalculating...' : 'Recalculate All'}
            </button>
            {recalcMsg && <p className="text-xs text-emerald-400 mt-2">{recalcMsg}</p>}
          </div>

          {/* BACKUP */}
          <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">💾</span>
              <div>
                <p className="text-sm font-medium text-white/80">Manual Backup</p>
                <p className="text-xs text-white/30">Auto backup runs daily at 10:00</p>
              </div>
            </div>
            <button
              onClick={() => { setBacking(true); setTimeout(() => { setBackMsg('Run backup.py manually from terminal'); setBacking(false) }, 1000) }}
              disabled={backing}
              className="w-full py-2 rounded-lg text-sm font-medium text-violet-400 border border-violet-500/20 bg-violet-500/10 hover:bg-violet-500/15 transition disabled:opacity-40">
              {backing ? 'Running...' : 'Run Backup'}
            </button>
            {backMsg && <p className="text-xs text-white/40 mt-2">{backMsg}</p>}
          </div>

          {/* API DOCS */}
          <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📖</span>
              <div>
                <p className="text-sm font-medium text-white/80">API Documentation</p>
                <p className="text-xs text-white/30">FastAPI Swagger UI</p>
              </div>
            </div>
            <button onClick={() => window.open('http://localhost:8000/docs', '_blank')}
              className="w-full py-2 rounded-lg text-sm font-medium text-gray-400 border border-white/10 bg-white/5 hover:bg-white/8 transition">
              Open Docs
            </button>
          </div>

          {/* ANALYTICS */}
          <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(30,36,54,0.6)' }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📊</span>
              <div>
                <p className="text-sm font-medium text-white/80">Analytics</p>
                <p className="text-xs text-white/30">Full performance report</p>
              </div>
            </div>
            <button onClick={() => window.location.href = '/analytics'}
              className="w-full py-2 rounded-lg text-sm font-medium text-blue-400 border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/15 transition">
              View Analytics
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}