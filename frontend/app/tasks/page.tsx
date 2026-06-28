'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'

const API = 'http://localhost:8000'

const TYPE_META: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  email:    { color: '#60A5FA', bg: 'rgba(79,123,247,0.06)',  border: 'rgba(79,123,247,0.15)',  icon: '✉', label: 'Email' },
  review:   { color: '#A78BFA', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.15)', icon: '👁', label: 'Review' },
  followup: { color: '#FBBF24', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)', icon: '🔄', label: 'Follow-up' },
  research: { color: '#34D399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.15)', icon: '🔍', label: 'Research' },
  update:   { color: '#9CA3AF', bg: 'var(--bg-input)',        border: 'var(--border)',          icon: '✏', label: 'Update' },
  personal: { color: '#F472B6', bg: 'rgba(244,114,182,0.06)',border: 'rgba(244,114,182,0.15)',icon: '⭐', label: 'Personal' },
}

interface Task {
  id: number; task_type: string; description: string
  priority: number; is_done: boolean; date: string; title?: string
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [taskLang, setTaskLang] = useState<'en' | 'fa'>('en')
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const fetchTasks = async () => {
    try { const res = await axios.get(`${API}/companies/tasks/today`); setTasks(Array.isArray(res.data) ? res.data : []) }
    catch { setTasks([]) }
    setLoading(false)
  }
  useEffect(() => { fetchTasks() }, [])

  const alreadyGenerated = tasks.some(t => t.task_type !== 'personal')

  const generateTasks = async () => {
    if (alreadyGenerated) return
    setGenerating(true)
    try { const res = await axios.post(`${API}/companies/tasks/generate`, { lang: taskLang }); setTasks(prev => [...prev, ...(Array.isArray(res.data) ? res.data : [])]) }
    catch { alert('Error generating tasks.') }
    setGenerating(false)
  }

  const addPersonal = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    try { const res = await axios.post(`${API}/companies/tasks/personal`, { title: newTitle, description: newDesc }); setTasks(prev => [...prev, res.data]); setNewTitle(''); setNewDesc(''); setShowAdd(false) }
    catch { alert('Error.') }
    setSaving(false)
  }

  const toggleDone = async (id: number) => {
    await axios.patch(`${API}/companies/tasks/${id}/done`)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_done: !t.is_done } : t))
  }

  const deleteTask = async (id: number) => {
    await axios.delete(`${API}/companies/tasks/${id}`)
    setTasks(prev => prev.filter(t => t.id !== id))
    setDeleteConfirm(null)
  }

  const done = tasks.filter(t => t.is_done).length
  const total = tasks.length
  const pct = total > 0 ? Math.round((done/total)*100) : 0

  const getTitle = (t: Task) => t.title || t.description?.split('.')[0] || t.task_type

  const aiTasks = tasks.filter(t => t.task_type !== 'personal').sort((a,b) => (a.priority||0)-(b.priority||0))
  const personalTasks = tasks.filter(t => t.task_type === 'personal')

  const TaskCard = ({ task, idx }: { task: Task; idx?: number }) => {
    const meta = TYPE_META[task.task_type] || TYPE_META.update
    return (
      <div style={{
        borderRadius: '12px',
        border: `1px solid ${task.is_done ? 'var(--border)' : meta.border}`,
        background: task.is_done ? 'transparent' : meta.bg,
        padding: '14px 16px',
        opacity: task.is_done ? 0.45 : 1,
        transition: 'all 0.2s',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {/* CHECKBOX */}
          <button onClick={() => toggleDone(task.id)}
            style={{ width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, marginTop: '1px', cursor: 'pointer', border: `2px solid ${task.is_done ? '#34D399' : meta.color}`, background: task.is_done ? '#34D399' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
            {task.is_done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </button>

          {/* CONTENT */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <span style={{ fontSize: '12px', opacity: 0.5 }}>{meta.icon}</span>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: 0, textDecoration: task.is_done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getTitle(task)}
              </p>
              {idx !== undefined && (
                <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: 'auto', flexShrink: 0 }}>#{idx+1}</span>
              )}
            </div>
            {task.description && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, direction: /[\u0600-\u06FF]/.test(task.description) ? 'rtl' : 'ltr' }}>
                {task.description}
              </p>
            )}
          </div>

          {/* TYPE BADGE + DELETE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, padding: '2px 7px', borderRadius: '999px' }}>{meta.label}</span>
            <button onClick={() => setDeleteConfirm(task.id)}
              style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px', transition: 'color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F87171' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}>✕</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      {/* DELETE MODAL */}
      {deleteConfirm !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px', width: '300px', textAlign: 'center' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '20px' }}>🗑</div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Delete task?</p>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 20px' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={() => deleteTask(deleteConfirm)} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: 'none', background: 'rgba(239,68,68,0.8)', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, marginLeft: '224px', display: 'flex', flexDirection: 'column' }}>

        {/* HEADER */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', transition: 'background 0.25s' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Daily Tasks</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {alreadyGenerated && (
              <span style={{ fontSize: '11px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34D399', padding: '5px 10px', borderRadius: '8px', fontWeight: 600 }}>
                ✦ AI Generated
              </span>
            )}
            <button onClick={() => setShowAdd(!showAdd)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'rgba(79,123,247,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
              + Add Task
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '24px 28px', maxWidth: '720px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

          {/* PROGRESS WIDGET */}
          {total > 0 && (
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Circle progress */}
              <div style={{ width: '52px', height: '52px', position: 'relative', flexShrink: 0 }}>
                <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="26" cy="26" r="22" fill="none" stroke="var(--border)" strokeWidth="4" />
                  <circle cx="26" cy="26" r="22" fill="none"
                    stroke={pct === 100 ? '#34D399' : pct >= 60 ? '#4F7BF7' : '#FBBF24'}
                    strokeWidth="4" strokeDasharray={`${pct * 1.38} 200`} strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                </svg>
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: pct === 100 ? '#34D399' : '#4F7BF7' }}>{pct}%</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Today's Progress</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{done} / {total} done</p>
                </div>
                <div style={{ height: '5px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: '999px', background: pct === 100 ? '#34D399' : pct >= 60 ? '#4F7BF7' : '#FBBF24', transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                </div>
              </div>
              {pct === 100 && <span style={{ fontSize: '24px' }}>🎉</span>}
            </div>
          )}

          {/* ADD TASK */}
          {showAdd && (
            <div style={{ borderRadius: '12px', border: '1px solid rgba(244,114,182,0.2)', background: 'rgba(244,114,182,0.04)', padding: '16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>⭐ New Personal Task</p>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title *"
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: 'var(--text)', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" rows={2}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: 'var(--text)', outline: 'none', resize: 'none', marginBottom: '12px', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAdd(false)} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)', background: 'var(--bg-input)', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                <button onClick={addPersonal} disabled={saving || !newTitle.trim()} style={{ padding: '6px 16px', borderRadius: '8px', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', opacity: (saving || !newTitle.trim()) ? 0.4 : 1, fontSize: '12px' }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* TASKS LIST */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div className="spinner" />
              <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontSize: '48px', opacity: 0.1, marginBottom: '12px' }}>☀️</p>
              <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-muted)', margin: '0 0 6px' }}>No tasks yet</p>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: '0 0 28px' }}>Generate AI tasks or add your own</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                {(['en','fa'] as const).map(l => (
                  <button key={l} onClick={() => setTaskLang(l)}
                    style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '13px', border: taskLang === l ? 'none' : '1px solid var(--border)', background: taskLang === l ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'var(--bg-input)', color: taskLang === l ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s', fontWeight: taskLang === l ? 600 : 400 }}>
                    {l === 'en' ? '🇬🇧 English' : '🇮🇷 فارسی'}
                  </button>
                ))}
              </div>
              <button onClick={generateTasks} disabled={generating}
                style={{ padding: '10px 28px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', opacity: generating ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {generating ? <><div className="spinner-sm" /> Generating...</> : '✦ Generate AI Tasks'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {aiTasks.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>✦ AI Generated</p>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{aiTasks.filter(t => t.is_done).length}/{aiTasks.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {aiTasks.map((task, i) => <TaskCard key={task.id} task={task} idx={i} />)}
                  </div>
                </div>
              )}

              {personalTasks.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>⭐ Personal</p>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{personalTasks.filter(t => t.is_done).length}/{personalTasks.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {personalTasks.map(task => <TaskCard key={task.id} task={task} />)}
                  </div>
                </div>
              )}

              {!alreadyGenerated && (
                <div style={{ textAlign: 'center', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                    {(['en','fa'] as const).map(l => (
                      <button key={l} onClick={() => setTaskLang(l)}
                        style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '12px', border: taskLang === l ? 'none' : '1px solid var(--border)', background: taskLang === l ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'var(--bg-input)', color: taskLang === l ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {l === 'en' ? 'English' : 'فارسی'}
                      </button>
                    ))}
                  </div>
                  <button onClick={generateTasks} disabled={generating}
                    style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'white', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', opacity: generating ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    {generating ? <><div className="spinner-sm" /> Generating...</> : '✦ Generate AI Tasks'}
                  </button>
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
