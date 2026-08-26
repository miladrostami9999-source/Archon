'use client'
import { useState } from 'react'
import { X, Plus, Trash2, CheckCircle2 } from 'lucide-react'

interface MilestoneDraft {
  title: string
  description: string
  amount: string
  due_date: string
}

const emptyDraft: MilestoneDraft = { title: '', description: '', amount: '', due_date: '' }

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '9px 11px',
  fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
}
const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }

/** The step before a proposal becomes a real, funded contract: the client
 * decides whether the work is one payment or several milestones, and — if
 * several — builds that list here, one at a time, until it adds up to the
 * agreed amount. Nothing is created until "Accept & create contract". */
export default function AcceptProposalModal({
  freelancerName, proposedAmount, proposedDays, currency, busy, error, onAccept, onClose,
}: {
  freelancerName: string
  proposedAmount: number
  proposedDays: number | null
  currency: string
  busy: boolean
  error: string
  onAccept: (milestones: { title: string; description?: string; amount: number; due_date?: string }[] | null) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'single' | 'split'>('single')
  const [milestones, setMilestones] = useState<{ title: string; description: string; amount: number; due_date: string }[]>([])
  const [draft, setDraft] = useState<MilestoneDraft>(emptyDraft)
  const [draftError, setDraftError] = useState('')

  const allocated = milestones.reduce((a, m) => a + m.amount, 0)
  const remaining = Math.round((proposedAmount - allocated) * 100) / 100
  const balanced = mode === 'single' || (milestones.length > 0 && Math.abs(remaining) < 0.01)

  const addMilestone = () => {
    const amount = Number(draft.amount)
    if (!draft.title.trim()) { setDraftError('Give this milestone a title'); return }
    if (!amount || amount <= 0) { setDraftError('Enter an amount above zero'); return }
    if (amount > remaining + 0.01) { setDraftError(`That's more than the ${remaining.toLocaleString('en-US')} ${currency} left to allocate`); return }
    setMilestones(ms => [...ms, { title: draft.title.trim(), description: draft.description.trim(), amount, due_date: draft.due_date }])
    setDraft(emptyDraft)
    setDraftError('')
  }
  const removeMilestone = (i: number) => setMilestones(ms => ms.filter((_, idx) => idx !== i))

  const submit = () => {
    if (mode === 'single') { onAccept(null); return }
    onAccept(milestones.map(m => ({
      title: m.title,
      description: m.description || undefined,
      amount: m.amount,
      due_date: m.due_date ? new Date(m.due_date).toISOString() : undefined,
    })))
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: '520px', maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Accept proposal</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', borderRadius: 'var(--radius-sm)' }}>
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              {freelancerName} proposed <strong style={{ color: 'var(--text)' }}>{proposedAmount.toLocaleString('en-US')} {currency}</strong>
              {proposedDays ? `, ${proposedDays} days` : ''}. Decide how the payment is split before the contract opens.
            </p>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
              {(['single', 'split'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid ' + (mode === m ? 'var(--accent)' : 'var(--border)'),
                    background: mode === m ? 'var(--accent-dim)' : 'transparent',
                    color: mode === m ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {m === 'single' ? 'One payment for the full amount' : 'Split into milestones'}
                </button>
              ))}
            </div>

            {mode === 'split' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Allocated</span>
                  <span className="mono" style={{ fontSize: '13px', fontWeight: 600, color: Math.abs(remaining) < 0.01 ? 'var(--success)' : 'var(--text)' }}>
                    {allocated.toLocaleString('en-US')} / {proposedAmount.toLocaleString('en-US')} {currency}
                  </span>
                </div>

                {milestones.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                    {milestones.map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                        <CheckCircle2 size={15} strokeWidth={1.75} color="var(--success)" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12.5px', color: 'var(--text)', fontWeight: 600 }}>{m.title}</div>
                          {m.due_date && <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Due {new Date(m.due_date).toLocaleDateString()}</div>}
                        </div>
                        <span className="mono" style={{ fontSize: '12.5px', color: 'var(--text-muted)', flexShrink: 0 }}>{m.amount.toLocaleString('en-US')}</span>
                        <button onClick={() => removeMilestone(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 0 }}><Trash2 size={14} strokeWidth={1.75} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {remaining > 0.01 && (
                  <div style={{ borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', padding: '14px' }}>
                    <p style={{ ...label, marginBottom: '10px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Add a milestone</p>
                    <div style={{ marginBottom: '8px' }}>
                      <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Concept sketches" style={input} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <input type="number" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} placeholder={`Amount (up to ${remaining.toLocaleString('en-US')})`} style={input} />
                      <input type="date" value={draft.due_date} onChange={e => setDraft(d => ({ ...d, due_date: e.target.value }))} style={input} />
                    </div>
                    <textarea rows={2} value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Notes (optional)" style={{ ...input, resize: 'vertical', marginBottom: '10px' }} />
                    {draftError && <p style={{ fontSize: '12px', color: 'var(--error)', margin: '0 0 8px' }}>{draftError}</p>}
                    <button onClick={addMilestone}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-dim)', cursor: 'pointer' }}>
                      <Plus size={13} strokeWidth={2} /> Add milestone
                    </button>
                  </div>
                )}
                {!balanced && milestones.length > 0 && remaining <= 0.01 && (
                  <p style={{ fontSize: '12px', color: 'var(--error)', margin: '10px 0 0' }}>Milestones don't add up to the agreed amount yet.</p>
                )}
              </>
            )}

            {error && <p style={{ fontSize: '12.5px', color: 'var(--error)', margin: '14px 0 0' }}>{error}</p>}
          </div>

          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: '10px' }}>
            <button onClick={onClose}
              style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={submit} disabled={busy || !balanced}
              style={{ flex: 1, padding: '10px 18px', borderRadius: 'var(--radius-md)', fontSize: '13.5px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: (busy || !balanced) ? 0.6 : 1 }}>
              {busy ? 'Creating contract…' : 'Accept & create contract'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
