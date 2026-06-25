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
}

const TASK_COLORS: Record<string, string> = {
  email: 'bg-blue-50 border-blue-200',
  review: 'bg-purple-50 border-purple-200',
  followup: 'bg-amber-50 border-amber-200',
  research: 'bg-green-50 border-green-200',
  update: 'bg-gray-50 border-gray-200',
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

  const alreadyGenerated = tasks.length > 0

  const generateTasks = async () => {
    if (alreadyGenerated) return
    setGenerating(true)
    try {
      const res = await axios.post(`${API}/companies/tasks/generate`, { lang: taskLang })
      const data = res.data
      setTasks(Array.isArray(data) ? data : [])
    } catch {
      alert('Error generating tasks. Check API key.')
    }
    setGenerating(false)
  }

  const toggleDone = async (taskId: number) => {
    try {
      await axios.patch(`${API}/companies/tasks/${taskId}/done`)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_done: !t.is_done } : t))
    } catch {}
  }

  const doneTasks = tasks.filter(t => t.is_done).length
  const totalTasks = tasks.length

  const getTaskTitle = (task: Task) => {
    if (task.title) return task.title
    if (task.description) {
      const firstLine = task.description.split('.')[0]
      if (firstLine.length < 80) return firstLine
    }
    return task.task_type
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.location.href = '/'}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Daily Tasks</h1>
            <p className="text-xs text-gray-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        {alreadyGenerated && (
          <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
            ✅ Tasks generated today
          </span>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">

        {/* PROGRESS */}
        {totalTasks > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Today's Progress</p>
              <p className="text-sm font-medium text-gray-900">{doneTasks}/{totalTasks}</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%` }}
              />
            </div>
            {doneTasks === totalTasks && totalTasks > 0 && (
              <p className="text-xs text-green-600 mt-2 text-center font-medium">
                🎉 All tasks completed for today!
              </p>
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
              <button
                onClick={() => setTaskLang('en')}
                className={`text-sm px-5 py-2 rounded-lg border transition font-medium ${
                  taskLang === 'en'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setTaskLang('fa')}
                className={`text-sm px-5 py-2 rounded-lg border transition font-medium ${
                  taskLang === 'fa'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                فارسی
              </button>
            </div>
            <button
              onClick={generateTasks}
              disabled={generating}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {generating ? '⏳ Generating...' : '✨ Generate Tasks'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {[...tasks]
              .sort((a, b) => (a.priority || 0) - (b.priority || 0))
              .map((task, index) => (
                <div
                  key={task.id}
                  className={`rounded-xl border p-4 transition ${
                    task.is_done
                      ? 'opacity-50 bg-gray-50 border-gray-200'
                      : TASK_COLORS[task.task_type] || 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleDone(task.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                        task.is_done
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-blue-500'
                      }`}
                    >
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
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}