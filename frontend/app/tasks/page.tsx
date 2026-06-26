'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

const TASK_ICONS: Record<string, string> = {
  email: '✉️',
  review: '👁',
  followup: '🔄',
  research: '🔍',
  update: '✏️',
  personal: '⭐',
}

const TASK_COLORS: Record<string, string> = {
  email: 'bg-blue-50 border-blue-200',
  review: 'bg-purple-50 border-purple-200',
  followup: 'bg-amber-50 border-amber-200',
  research: 'bg-green-50 border-green-200',
  update: 'bg-gray-50 border-gray-200',
  personal: 'bg-pink-50 border-pink-200',
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

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API}/companies/tasks/today`)
      const data = res.data
      setTasks(Array.isArray(data) ? data : [])
    } catch {
      setTasks([])
    }
    setLoading(false)
  }

  useEffect(() => { fetchTasks() }, [])

  const alreadyGenerated = tasks.some(t => t.task_type !== 'personal')

  const generateTasks = async () => {
    if (alreadyGenerated) return
    setGenerating(true)
    try {
      const res = await axios.post(`${API}/companies/tasks/generate`, { lang: taskLang })
      const data = res.data
      setTasks(prev => [...prev, ...(Array.isArray(data) ? data : [])])
    } catch {
      alert('Error generating tasks. Check API key.')
    }
    setGenerating(false)
  }

  const addPersonalTask = async () => {
    if (!newTaskTitle.trim()) return
    setSavingTask(true)
    try {
      const res = await axios.post(`${API}/companies/tasks/personal`, {
        title: newTaskTitle,
        description: newTaskDesc,
      })
      setTasks(prev => [...prev, res.data])
      setNewTaskTitle('')
      setNewTaskDesc('')
      setShowAddTask(false)
    } catch {
      alert('Error adding task.')
    }
    setSavingTask(false)
  }

  const toggleDone = async (taskId: number) => {
    try {
      await axios.patch(`${API}/companies/tasks/${taskId}/done`)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_done: !t.is_done } : t))
    } catch {}
  }

  const deleteTask = async (taskId: number) => {
    try {
      await axios.delete(`${API}/companies/tasks/${taskId}`)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch {}
  }

  const doneTasks = tasks.filter(t => t.is_done).length
  const totalTasks = tasks.length
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const getTaskTitle = (task: Task) => {
    if (task.title) return task.title
    if (task.description) {
      const firstLine = task.description.split('.')[0]
      if (firstLine.length < 80) return firstLine
    }
    return task.task_type
  }

  const aiTasks = tasks.filter(t => t.task_type !== 'personal').sort((a, b) => (a.priority || 0) - (b.priority || 0))
  const personalTasks = tasks.filter(t => t.task_type === 'personal')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => window.location.href = '/'} className="text-gray-400 hover:text-gray-600 transition">
            ← Back
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Daily Tasks</h1>
            <p className="text-xs text-gray-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddTask(!showAddTask)}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            + Add Task
          </button>
          {alreadyGenerated && (
            <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
              ✅ AI tasks generated
            </span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">

        {/* ADD PERSONAL TASK */}
        {showAddTask && (
          <div className="bg-white rounded-xl border border-pink-200 p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">⭐ Add Personal Task</p>
            <input
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              placeholder="Task title *"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={newTaskDesc}
              onChange={e => setNewTaskDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddTask(false)}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={addPersonalTask} disabled={savingTask || !newTaskTitle.trim()}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
                {savingTask ? 'Saving...' : 'Save Task'}
              </button>
            </div>
          </div>
        )}

        {/* PROGRESS */}
        {totalTasks > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Today's Progress</p>
              <p className="text-sm font-medium text-gray-900">{doneTasks}/{totalTasks} · {progressPercent}%</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: `${progressPercent}%`,
                  background: progressPercent === 100 ? '#22c55e' : progressPercent >= 60 ? '#3b82f6' : '#f59e0b'
                }}
              />
            </div>
            {doneTasks === totalTasks && totalTasks > 0 && (
              <p className="text-xs text-green-600 mt-2 text-center font-medium">🎉 All tasks completed!</p>
            )}
          </div>
        )}

        {/* TASKS */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">☀️</p>
            <p className="text-gray-500 font-medium mb-2">No tasks for today</p>
            <p className="text-gray-400 text-sm mb-6">Select language and let Claude create today's priorities</p>
            <div className="flex justify-center gap-2 mb-6">
              <button onClick={() => setTaskLang('en')}
                className={`text-sm px-5 py-2 rounded-lg border transition font-medium ${
                  taskLang === 'en' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                English
              </button>
              <button onClick={() => setTaskLang('fa')}
                className={`text-sm px-5 py-2 rounded-lg border transition font-medium ${
                  taskLang === 'fa' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                فارسی
              </button>
            </div>
            <button onClick={generateTasks} disabled={generating}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {generating ? '⏳ Generating...' : '✨ Generate Tasks'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">

            {/* AI TASKS */}
            {aiTasks.length > 0 && (
              <>
                <p className="text-xs text-gray-400 font-medium px-1">✨ AI Generated</p>
                {aiTasks.map((task, index) => (
                  <div key={task.id}
                    className={`rounded-xl border p-4 transition ${
                      task.is_done ? 'opacity-50 bg-gray-50 border-gray-200' : TASK_COLORS[task.task_type] || 'bg-white border-gray-200'
                    }`}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggleDone(task.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                          task.is_done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-blue-500'
                        }`}>
                        {task.is_done && <span className="text-xs">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{TASK_ICONS[task.task_type] || '📌'}</span>
                          <p className={`text-sm font-medium flex-1 ${task.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {getTaskTitle(task)}
                          </p>
                          <span className="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                            #{index + 1}
                          </span>
                        </div>
                        <p className={`text-xs text-gray-500 leading-relaxed ${
                          task.description && /[\u0600-\u06FF]/.test(task.description) ? 'text-right' : ''
                        }`}>
                          {task.description}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-gray-300 hover:text-red-400 transition text-sm flex-shrink-0 ml-1"
                        title="Delete task"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* PERSONAL TASKS */}
            {personalTasks.length > 0 && (
              <>
                <p className="text-xs text-gray-400 font-medium px-1 mt-2">⭐ Personal</p>
                {personalTasks.map(task => (
                  <div key={task.id}
                    className={`rounded-xl border p-4 transition ${
                      task.is_done ? 'opacity-50 bg-gray-50 border-gray-200' : 'bg-pink-50 border-pink-200'
                    }`}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggleDone(task.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                          task.is_done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-blue-500'
                        }`}>
                        {task.is_done && <span className="text-xs">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          ⭐ {getTaskTitle(task)}
                        </p>
                        {task.description && (
                          <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-gray-300 hover:text-red-400 transition text-sm flex-shrink-0"
                        title="Delete task"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* GENERATE AI TASKS — اگر هنوز generate نشده */}
            {!alreadyGenerated && (
              <div className="text-center pt-4 pb-2">
                <div className="flex justify-center gap-2 mb-3">
                  <button onClick={() => setTaskLang('en')}
                    className={`text-xs px-4 py-1.5 rounded-lg border transition ${
                      taskLang === 'en' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'
                    }`}>
                    English
                  </button>
                  <button onClick={() => setTaskLang('fa')}
                    className={`text-xs px-4 py-1.5 rounded-lg border transition ${
                      taskLang === 'fa' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'
                    }`}>
                    فارسی
                  </button>
                </div>
                <button onClick={generateTasks} disabled={generating}
                  className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                  {generating ? '⏳ Generating...' : '✨ Generate AI Tasks'}
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}