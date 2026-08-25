'use client'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Users, DollarSign, HeartPulse, Settings, Search } from 'lucide-react'
import AdminCommandPalette from './AdminCommandPalette'

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', Icon: LayoutDashboard },
  { href: '/users', label: 'Users', Icon: Users },
  { href: '/admin/revenue', label: 'Revenue', Icon: DollarSign },
  { href: '/admin/system-health', label: 'System Health', Icon: HeartPulse },
  { href: '/admin/settings', label: 'Settings', Icon: Settings },
]

export default function AdminSideNav({ active }: { active: string }) {
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
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = active === href
          return (
            <a key={href} href={href} style={{
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
