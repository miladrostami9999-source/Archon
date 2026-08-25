'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  Search, LayoutDashboard, Users, DollarSign, HeartPulse, Settings,
  Upload, Download, RefreshCw, Flame, DatabaseBackup, BookOpen,
} from 'lucide-react'

interface Item { label: string; hint: string; Icon: any; action: () => void }

function buildItems(close: () => void): Item[] {
  const go = (href: string) => () => { window.location.href = href }
  return [
    { label: 'Overview', hint: 'Admin', Icon: LayoutDashboard, action: go('/admin') },
    { label: 'Users', hint: 'Admin', Icon: Users, action: go('/admin?tab=users') },
    { label: 'Revenue', hint: 'Admin', Icon: DollarSign, action: go('/admin/revenue') },
    { label: 'System Health', hint: 'Admin', Icon: HeartPulse, action: go('/admin/system-health') },
    { label: 'Settings', hint: 'Admin', Icon: Settings, action: go('/admin/settings') },
    { label: 'Import CSV', hint: 'Tool', Icon: Upload, action: go('/admin') },
    { label: 'Export CSV', hint: 'Tool', Icon: Download, action: go('/admin') },
    { label: 'Recalculate Scores', hint: 'Tool', Icon: RefreshCw, action: go('/admin') },
    { label: 'Recalculate Heat', hint: 'Tool', Icon: Flame, action: go('/admin') },
    { label: 'Manual Backup', hint: 'Tool', Icon: DatabaseBackup, action: go('/admin/system-health') },
    { label: 'API Documentation', hint: 'Tool', Icon: BookOpen, action: go('/admin') },
  ]
}

export default function AdminCommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const items = useMemo(() => buildItems(onClose), [onClose])
  const filtered = useMemo(
    () => items.filter(i => i.label.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  )

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHighlighted(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
      if (e.key === 'Enter' && filtered[highlighted]) { filtered[highlighted].action(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, filtered, highlighted])

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 80 }} />
      <div style={{
        position: 'fixed', top: '18vh', left: '50%', transform: 'translateX(-50%)',
        width: '520px', maxWidth: 'calc(100vw - 32px)', maxHeight: '60vh',
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        zIndex: 81, boxShadow: 'var(--shadow-pop)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={16} strokeWidth={1.5} color="var(--text-dim)" />
          <input
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlighted(0) }}
            placeholder="Jump to a section or tool…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: '14px' }}
          />
        </div>
        <div style={{ overflowY: 'auto', padding: '6px' }}>
          {filtered.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', padding: '16px', textAlign: 'center' }}>No matches</p>
          ) : filtered.map((item, i) => (
            <button
              key={item.label}
              onClick={() => { item.action(); onClose() }}
              onMouseEnter={() => setHighlighted(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left',
                padding: '9px 10px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                background: highlighted === i ? 'var(--bg-hover)' : 'transparent', color: 'var(--text)', fontSize: '13.5px',
              }}
            >
              <item.Icon size={15} strokeWidth={1.5} color="var(--text-muted)" />
              <span style={{ flex: 1 }}>{item.label}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{item.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
