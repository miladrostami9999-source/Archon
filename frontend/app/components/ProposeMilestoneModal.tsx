'use client'
import { useState } from 'react'
import axios from 'axios'
import { X } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '9px 11px',
  fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
}
const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }

/** Propose adding a new milestone to a contract already underway — from the
 * contract page or from chat, both call this. The other party has to accept
 * it before it counts toward the contract total or can be funded. */
export default function ProposeMilestoneModal({
  contractId, currency, onClose, onProposed,
}: { contractId: number; currency: string; onClose: () => void; onProposed: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!title.trim()) { setError('Give this milestone a title'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { setError('Enter an amount above zero'); return }
    setBusy(true); setError('')
    try {
      await axios.post(`${API}/marketplace/contracts/${contractId}/milestones`, {
        title: title.trim(),
        description: description.trim() || null,
        amount: amt,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      })
      onProposed()
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Could not propose milestone')
    }
    setBusy(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '440px', maxWidth: '100%', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
        background: 'var(--bg-card)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Propose a milestone</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', borderRadius: 'var(--radius-sm)' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
            Adds scope beyond the original agreement. The other party has to accept it before it's added to the contract total or can be funded.
          </p>
          <div style={{ marginBottom: '10px' }}>
            <label style={label}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. 2 additional revision rounds" style={input} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={label}>Amount ({currency})</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={input} />
            </div>
            <div>
              <label style={label}>Due date <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={input} />
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={label}>Notes <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} style={{ ...input, resize: 'vertical' }} />
          </div>
          {error && <p style={{ fontSize: '12.5px', color: 'var(--error)', margin: '0 0 12px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose}
              style={{ padding: '9px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={submit} disabled={busy}
              style={{ flex: 1, padding: '9px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Sending…' : 'Propose milestone'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
