'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'

const API = 'http://localhost:8000'

const TASK_COLORS: Record<string, string> = {
  email:    'border-blue-500/20 bg-blue-500/5',
  review:   'border-violet-500/20 bg-violet-500/5',
  followup: 'border-amber-500/20 bg-amber-500/5',
  research: 'border-emerald-500/20 bg-emerald-500/5',
  update:   'border-white/8 bg-white/3',
  personal: 'border-pink-500/20 bg-pink-500/5',
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
    <div className="flex min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar />

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/10 p-6 w-80 shadow-2xl" style={{ background: '#1E2436' }}>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🗑</span>
              </div>
              <p className="text-sm font-medium text-white/80">Delete this task?</p>
              <p className="text-xs text-white/35 mt-1">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-xl text-sm text-white/50 border border-white/8 hover:bg-white/5 transition">
                Cancel
              </button>
              <button onClick={() => deleteTask(deleteConfirm)}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 transition">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 ml-56 flex flex-col">

        {/* HEADER */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-8 py-4 border-b border-white/5"
          style={{ background: 'rgba(15,17,23,0.85)', backdropFilter: 'blur(12px)' }}>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Daily Tasks</h1>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddTask(!showAddTask)}
              className="px-3 py-2 rounded-lg text-sm border border-white/10 text-white/50 hover:text-white/70 hover:bg-white/5 transition">
              + Add Task
            </button>
            {alreadyGenerated && (
              <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg">
                ✅ Generated
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 px-8 py-6 max-w-3xl w-full mx-auto">

          {/* ADD TASK */}
          {showAddTask && (
            <div className="rounded-xl border border-pink-500/20 p-4 mb-4" style={{ background: 'rgba(236,72,153,0.05)' }}>
              <p className="text-sm font-medium text-white/70 mb-3">⭐ New Personal Task</p>
              <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="Task title *"
                className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/25 mb-2 focus:outline-none focus:border-blue-500/40" />
              <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)}
                placeholder="Description (optional)" rows={2}
                className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/25 mb-3 resize-none focus:outline-none focus:border-blue-500/40" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddTask(false)}
                  className="text-xs px-3 py-1.5 border border-white/8 rounded-lg text-white/40 hover:text-white/60">
                  Cancel
                </button>
                <button onClick={addPersonalTask} disabled={savingTask || !newTaskTitle.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)' }}>
                  {savingTask ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* PROGRESS */}
          {totalTasks > 0 && (
            <div className="rounded-xl border border-white/8 p-4 mb-5" style={{ background: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white/60">Today's Progress</p>
                <p className="text-sm font-medium text-white/80">{doneTasks}/{totalTasks} · {progress}%</p>
              </div>
              <div className="w-full bg-white/8 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${progress}%`,
                    background: progress === 100 ? '#34D399' : progress >= 60 ? '#4F7BF7' : '#FBBF24'
                  }} />
              </div>
              {progress === 100 && <p className="text-xs text-emerald-400 mt-2 text-center">🎉 All done!</p>}
            </div>
          )}

          {/* TASKS */}
          {loading ? (
            <div className="text-center py-20 text-white/25">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-3xl mb-3 opacity-20">☀️</p>
              <p className="text-sm text-white/40 mb-6">No tasks for today</p>
              <div className="flex justify-center gap-2 mb-4">
                {(['en', 'fa'] as const).map(l => (
                  <button key={l} onClick={() => setTaskLang(l)}
                    className={`text-sm px-5 py-2 rounded-lg border transition ${
                      taskLang === l ? 'border-blue-500/40 bg-blue-500/15 text-blue-400' : 'border-white/8 text-white/40'
                    }`}>
                    {l === 'en' ? 'English' : 'فارسی'}
                  </button>
                ))}
              </div>
              <button onClick={generateTasks} disabled={generating}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)' }}>
                {generating ? '⏳ Generating...' : '✦ Generate Tasks'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {aiTasks.length > 0 && (
                <>
                  <p className="text-[10px] text-white/25 uppercase tracking-widest px-1 mb-3">✦ AI Generated</p>
                  {aiTasks.map((task, i) => (
                    <div key={task.id}
                      className={`rounded-xl border p-4 transition ${task.is_done ? 'opacity-40 border-white/5' : TASK_COLORS[task.task_type] || 'border-white/8'}`}
                      style={{ background: task.is_done ? 'rgba(255,255,255,0.02)' : undefined }}>
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggleDone(task.id)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                            task.is_done ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 hover:border-blue-400'
                          }`}>
                          {task.is_done && <span className="text-[10px] text-white">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs opacity-40">{TASK_ICONS[task.task_type]}</span>
                            <p className={`text-sm font-medium flex-1 ${task.is_done ? 'line-through text-white/25' : 'text-white/80'}`}>
                              {getTitle(task)}
                            </p>
                            <span className="text-[10px] text-white/20 flex-shrink-0">#{i + 1}</span>
                          </div>
                          {task.description && (
                            <p className={`text-xs leading-relaxed ${task.is_done ? 'text-white/20' : 'text-white/40'} ${/[\u0600-\u06FF]/.test(task.description) ? 'text-right' : ''}`}>
                              {task.description}
                            </p>
                          )}
                        </div>
                        <button onClick={() => setDeleteConfirm(task.id)}
                          className="text-white/15 hover:text-red-400 transition text-xs flex-shrink-0 ml-1 p-1">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {personalTasks.length > 0 && (
                <>
                  <p className="text-[10px] text-white/25 uppercase tracking-widest px-1 mt-5 mb-3">⭐ Personal</p>
                  {personalTasks.map(task => (
                    <div key={task.id}
                      className={`rounded-xl border p-4 transition ${task.is_done ? 'opacity-40 border-white/5' : 'border-pink-500/20 bg-pink-500/5'}`}>
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggleDone(task.id)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                            task.is_done ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 hover:border-pink-400'
                          }`}>
                          {task.is_done && <span className="text-[10px] text-white">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${task.is_done ? 'line-through text-white/25' : 'text-white/80'}`}>
                            {getTitle(task)}
                          </p>
                          {task.description && <p className="text-xs text-white/35 mt-1">{task.description}</p>}
                        </div>
                        <button onClick={() => setDeleteConfirm(task.id)}
                          className="text-white/15 hover:text-red-400 transition text-xs p-1">✕</button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {!alreadyGenerated && (
                <div className="text-center pt-6">
                  <div className="flex justify-center gap-2 mb-3">
                    {(['en', 'fa'] as const).map(l => (
                      <button key={l} onClick={() => setTaskLang(l)}
                        className={`text-xs px-4 py-1.5 rounded-lg border transition ${
                          taskLang === l ? 'border-blue-500/40 bg-blue-500/15 text-blue-400' : 'border-white/8 text-white/40'
                        }`}>
                        {l === 'en' ? 'English' : 'فارسی'}
                      </button>
                    ))}
                  </div>
                  <button onClick={generateTasks} disabled={generating}
                    className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)' }}>
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