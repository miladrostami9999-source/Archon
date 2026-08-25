'use client'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Users, DollarSign, HeartPulse, Settings, Search } from 'lucide-react'
import AdminCommandPalette from './AdminCommandPalette'

const NAV_ITEMS = [
  { key: 'overview', href: '/admin', label: 'Overview', Icon: LayoutDashboard },
  { key: 'users', href: '/admin', label: 'Users', Icon: Users },
  { key: 'revenue', href: '/admin/revenue', label: 'Revenue', Icon: DollarSign },
  { key: 'health', href: '/admin/system-health', label: 'System Health', Icon: HeartPulse },
  { key: 'settings', href: '/admin/settings', label: 'Settings', Icon: Settings },
]

export default function AdminSideNav({ active, usersView, onUsersClick }: {
  active: string
  /** True when the /admin page is currently showing the embedded Users view instead of Overview. */
  usersView?: boolean
  /** Present only on the /admin page itself — switches the Users view in place instead of navigating. */
  onUsersClick?: () => void
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <aside style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px 8px' }}>
          Admin
        </p>
        {NAV_ITEMS.map(({ key, href, label, Icon }) => {
          if (key === 'users') {
            const isActive = !!usersView
            const itemStyle: React.CSSProperties = {
              display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', width: '100%',
              borderRadius: 'var(--radius-md)', textDecoration: 'none', fontSize: '13.5px', fontWeight: 600,
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }
            return onUsersClick ? (
              <button key={key} onClick={onUsersClick} style={itemStyle}>
                <Icon size={16} strokeWidth={1.5} />
                {label}
              </button>
            ) : (
              <a key={key} href={href} style={itemStyle}>
                <Icon size={16} strokeWidth={1.5} />
                {label}
              </a>
            )
          }
          const isActive = active === href && !(key === 'overview' && usersView)
          return (
            <a key={key} href={href} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px',
              borderRadius: 'var(--radius-md)', textDecoration: 'none', fontSize: '13.5px', fontWeight: 600,
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
            }}>
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </a>
          )
        })}
        <button onClick={() => setPaletteOpen(true)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          padding: '9px 10px', borderRadius: 'var(--radius-md)', marginTop: '8px',
          border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)',
          fontSize: '12.5px', cursor: 'pointer',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} strokeWidth={1.5} /> Search
          </span>
          <span className="mono" style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Ctrl K</span>
        </button>
      </aside>
      <AdminCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}
