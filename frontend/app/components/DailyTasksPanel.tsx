'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { CheckCircle2, Circle, ListChecks } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Task {
  id: number
  task_type: string
  description: string
  priority: number
  is_done: boolean
  date: string
  title?: string
}

const getTitle = (task: Task) => {
  if (task.title) return task.title
  if (task.description) {
    const first = task.description.split('.')[0]
    if (first.length < 80) return first
  }
  return task.task_type
}

const MAX_VISIBLE = 8

export default function DailyTasksPanel() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API}/companies/tasks/today`)
      .then(res => setTasks(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [])

  const toggleDone = async (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_done: !t.is_done } : t))
    try { await axios.patch(`${API}/companies/tasks/${id}/done`) } catch {}
  }

  const done = tasks.filter(t => t.is_done).length
  const total = tasks.length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const sorted = [...tasks].sort((a, b) => (a.priority || 0) - (b.priority || 0))
  const visible = sorted.slice(0, MAX_VISIBLE)
  const overflow = sorted.length - visible.length

  return (
    <div style={{
      width: '290px', flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: '72px',
      borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)',
      padding: '18px 18px', marginRight: '24px', marginTop: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Today's Tasks</h3>
        {total > 0 && <span className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)' }}>{done}/{total}</span>}
      </div>

      {total > 0 && (
        <div style={{ height: '5px', borderRadius: '999px', background: 'var(--bg-input)', overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{ height: '100%', width: `${percent}%`, background: 'var(--accent)', borderRadius: '999px', transition: 'width 0.3s ease' }} />
        </div>
      )}

      {!loading && total === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 8px' }}>
          <ListChecks size={26} strokeWidth={1.25} style={{ color: 'var(--text-dim)', marginBottom: '8px' }} />
          <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: 0 }}>No tasks for today</p>
        </div>
      )}

      {visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {visible.map(task => (
            <div key={task.id} onClick={() => toggleDone(task.id)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
              {task.is_done
                ? <CheckCircle2 size={15} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
                : <Circle size={15} strokeWidth={1.75} style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: '1px' }} />}
              <span style={{
                fontSize: '12.5px', lineHeight: 1.45,
                color: task.is_done ? 'var(--text-dim)' : 'var(--text-muted)',
                textDecoration: task.is_done ? 'line-through' : 'none',
              }}>
                {getTitle(task)}
              </span>
            </div>
          ))}
        </div>
      )}

      {overflow > 0 && (
        <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '10px 0 0' }}>+{overflow} more</p>
      )}

      {total > 0 && (
        <a href="/tasks" style={{ display: 'block', marginTop: '14px', fontSize: '12px', fontWeight: 600, color: '#60A5FA', textDecoration: 'none' }}>
          View all tasks →
        </a>
      )}
    </div>
  )
}
