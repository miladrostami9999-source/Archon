'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'

const API = 'http://localhost:8000'

const TASK_COLORS: Record<string, { border: string; bg: string }> = {
  email:    { border: 'rgba(79,123,247,0.2)',  bg: 'rgba(79,123,247,0.05)' },
  review:   { border: 'rgba(139,92,246,0.2)',  bg: 'rgba(139,92,246,0.05)' },
  followup: { border: 'rgba(245,158,11,0.2)',  bg: 'rgba(245,158,11,0.05)' },
  research: { border: 'rgba(52,211,153,0.2)',  bg: 'rgba(52,211,153,0.05)' },
  update:   { border: 'var(--border)',          bg: 'transparent' },
  personal: { border: 'rgba(236,72,153,0.2)',  bg: 'rgba(236,72,153,0.05)' },
}

const TASK_ICONS: Record<string, string> = {
  email: '✉', review: '👁', followup: '🔄',
  research: '🔍', update: '✏', personal: '⭐',
}

interface Task {
  id: number
  task_type: string
  description: string
  priority: number
  is_done: boolean
  date: string
  title?: string
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [taskLang, setTaskLang] = useState<'en' | 'fa'>('en')
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [savingTask, setSavingTask] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API}/companies/tasks/today`)
      setTasks(Array.isArray(res.data) ? res.data : [])
    } catch { setTasks([]) }
    setLoading(false)
  }

  useEffect(() => { fetchTasks() }, [])

  const alreadyGenerated = tasks.some(t => t.task_type !== 'personal')

  const generateTasks = async () => {
    if (alreadyGenerated) return
    setGenerating(true)
    try {
      const res = await axios.post(`${API}/companies/tasks/generate`, { lang: taskLang })
      setTasks(prev => [...prev, ...(Array.isArray(res.data) ? res.data : [])])
    } catch { alert('Error generating tasks.') }
    setGenerating(false)
  }

  const addPersonalTask = async () => {
    if (!newTaskTitle.trim()) return
    setSavingTask(true)
    try {
      const res = await axios.post(`${API}/companies/tasks/personal`, { title: newTaskTitle, description: newTaskDesc })
      setTasks(prev => [...prev, res.data])
      setNewTaskTitle(''); setNewTaskDesc(''); setShowAddTask(false)
    } catch { alert('Error adding task.') }
    setSavingTask(false)
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

  const doneTasks = tasks.filter(t => t.is_done).length
  const totalTasks = tasks.length
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const getTitle = (task: Task) => {
    if (task.title) return task.title
    if (task.description) {
      const f = task.description.split('.')[0]
      if (f.length < 80) return f
    }
    return task.task_type
  }

  const aiTasks = tasks.filter(t => t.task_type !== 'personal').sort((a, b) => (a.priority || 0) - (b.priority || 0))
  const personalTasks = tasks.filter(t => t.task_type === 'personal')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirm !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px', width: '320px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <span style={{ fontSize: '24px' }}>🗑</span>
              </div>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', margin: 0 }}>Delete this task?</p>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '4px 0 0' }}>This action cannot be undone.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, padding: '8px', borderRadius: '10px', fontSize: '14px', color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => deleteTask(deleteConfirm)}
                style={{ flex: 1, padding: '8px', borderRadius: '10px', fontSize: '14px', fontWeight: 500, color: 'white', background: 'rgba(239,68,68,0.8)', border: 'none', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, marginLeft: '224px', display: 'flex', flexDirection: 'column' }}>

        {/* HEADER */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 32px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-main)', backdropFilter: 'blur(12px)',
          transition: 'background 0.25s, border-color 0.25s',
        }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Daily Tasks</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '2px 0 0' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setShowAddTask(!showAddTask)}
              style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '14px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
              + Add Task
            </button>
            {alreadyGenerated && (
              <span style={{ fontSize: '12px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34D399', padding: '6px 12px', borderRadius: '8px' }}>
                ✅ Generated
              </span>
            )}
          </div>
        </div>

        <div style={{ flex: 1, padding: '24px 32px', maxWidth: '768px', width: '100%', margin: '0 auto' }}>

          {/* ADD TASK */}
          {showAddTask && (
            <div style={{ borderRadius: '12px', border: '1px solid rgba(236,72,153,0.2)', background: 'rgba(236,72,153,0.04)', padding: '16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '12px', marginTop: 0 }}>⭐ New Personal Task</p>
              <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="Task title *"
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: 'var(--text)', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }} />
              <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)}
                placeholder="Description (optional)" rows={2}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: 'var(--text)', outline: 'none', marginBottom: '12px', resize: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAddTask(false)}
                  style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)', background: 'var(--bg-input)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={addPersonalTask} disabled={savingTask || !newTaskTitle.trim()}
                  style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', color: 'white', fontWeight: 500, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', opacity: (savingTask || !newTaskTitle.trim()) ? 0.4 : 1 }}>
                  {savingTask ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* PROGRESS */}
          {totalTasks > 0 && (
            <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)', margin: 0 }}>Today's Progress</p>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', margin: 0 }}>{doneTasks}/{totalTasks} · {progress}%</p>
              </div>
              <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '6px' }}>
                <div style={{ height: '6px', borderRadius: '999px', transition: 'width 0.5s', width: `${progress}%`, background: progress === 100 ? '#34D399' : progress >= 60 ? '#4F7BF7' : '#FBBF24' }} />
              </div>
              {progress === 100 && <p style={{ fontSize: '12px', color: '#34D399', marginTop: '8px', marginBottom: 0, textAlign: 'center' }}>🎉 All done!</p>}
            </div>
          )}

          {/* TASKS */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-dim)' }}>Loading...</div>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.2 }}>☀️</p>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>No tasks for today</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                {(['en', 'fa'] as const).map(l => (
                  <button key={l} onClick={() => setTaskLang(l)}
                    style={{
                      fontSize: '14px', padding: '8px 20px', borderRadius: '8px',
                      border: taskLang === l ? '1px solid rgba(79,123,247,0.4)' : '1px solid var(--border)',
                      background: taskLang === l ? 'rgba(79,123,247,0.15)' : 'var(--bg-input)',
                      color: taskLang === l ? '#60A5FA' : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {l === 'en' ? 'English' : 'فارسی'}
                  </button>
                ))}
              </div>
              <button onClick={generateTasks} disabled={generating}
                style={{ padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 500, color: 'white', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', opacity: generating ? 0.4 : 1 }}>
                {generating ? '⏳ Generating...' : '✦ Generate Tasks'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {aiTasks.length > 0 && (
                <>
                  <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 4px', marginBottom: '8px', marginTop: 0 }}>✦ AI Generated</p>
                  {aiTasks.map((task, i) => {
                    const colors = TASK_COLORS[task.task_type] || TASK_COLORS.update
                    return (
                      <div key={task.id} style={{
                        borderRadius: '12px', border: `1px solid ${task.is_done ? 'var(--border)' : colors.border}`,
                        background: task.is_done ? 'transparent' : colors.bg,
                        padding: '16px', opacity: task.is_done ? 0.5 : 1, transition: 'all 0.15s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <button onClick={() => toggleDone(task.id)}
                            style={{
                              width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${task.is_done ? '#34D399' : 'var(--border-mid)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                              background: task.is_done ? '#34D399' : 'transparent', cursor: 'pointer', transition: 'all 0.15s',
                            }}>
                            {task.is_done && <span style={{ fontSize: '10px', color: 'white' }}>✓</span>}
                          </button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', opacity: 0.4 }}>{TASK_ICONS[task.task_type]}</span>
                              <p style={{ fontSize: '14px', fontWeight: 500, flex: 1, margin: 0, color: task.is_done ? 'var(--text-dim)' : 'var(--text)', textDecoration: task.is_done ? 'line-through' : 'none' }}>
                                {getTitle(task)}
                              </p>
                              <span style={{ fontSize: '10px', color: 'var(--text-dim)', flexShrink: 0 }}>#{i + 1}</span>
                            </div>
                            {task.description && (
                              <p style={{ fontSize: '12px', lineHeight: 1.5, color: task.is_done ? 'var(--text-dim)' : 'var(--text-muted)', margin: 0, textAlign: /[\u0600-\u06FF]/.test(task.description) ? 'right' : 'left' }}>
                                {task.description}
                              </p>
                            )}
                          </div>
                          <button onClick={() => setDeleteConfirm(task.id)}
                            style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', flexShrink: 0, padding: '4px', transition: 'color 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#F87171' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {personalTasks.length > 0 && (
                <>
                  <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 4px', marginTop: '16px', marginBottom: '8px' }}>⭐ Personal</p>
                  {personalTasks.map(task => (
                    <div key={task.id} style={{
                      borderRadius: '12px', border: `1px solid ${task.is_done ? 'var(--border)' : 'rgba(236,72,153,0.2)'}`,
                      background: task.is_done ? 'transparent' : 'rgba(236,72,153,0.05)',
                      padding: '16px', opacity: task.is_done ? 0.5 : 1, transition: 'all 0.15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <button onClick={() => toggleDone(task.id)}
                          style={{
                            width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${task.is_done ? '#34D399' : 'rgba(236,72,153,0.4)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                            background: task.is_done ? '#34D399' : 'transparent', cursor: 'pointer', transition: 'all 0.15s',
                          }}>
                          {task.is_done && <span style={{ fontSize: '10px', color: 'white' }}>✓</span>}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '14px', fontWeight: 500, margin: 0, color: task.is_done ? 'var(--text-dim)' : 'var(--text)', textDecoration: task.is_done ? 'line-through' : 'none' }}>
                            {getTitle(task)}
                          </p>
                          {task.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{task.description}</p>}
                        </div>
                        <button onClick={() => setDeleteConfirm(task.id)}
                          style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '4px', transition: 'color 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#F87171' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {!alreadyGenerated && (
                <div style={{ textAlign: 'center', paddingTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                    {(['en', 'fa'] as const).map(l => (
                      <button key={l} onClick={() => setTaskLang(l)}
                        style={{
                          fontSize: '12px', padding: '6px 16px', borderRadius: '8px',
                          border: taskLang === l ? '1px solid rgba(79,123,247,0.4)' : '1px solid var(--border)',
                          background: taskLang === l ? 'rgba(79,123,247,0.15)' : 'var(--bg-input)',
                          color: taskLang === l ? '#60A5FA' : 'var(--text-muted)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}>
                        {l === 'en' ? 'English' : 'فارسی'}
                      </button>
                    ))}
                  </div>
                  <button onClick={generateTasks} disabled={generating}
                    style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: 'white', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', opacity: generating ? 0.4 : 1 }}>
                    {generating ? '⏳...' : '✦ Generate AI Tasks'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
