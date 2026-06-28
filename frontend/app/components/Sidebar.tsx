'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

interface User {
  name: string
  email: string
  role: string
  plan: string
}

const PLAN_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  basic:  { label: 'Basic',  color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
  pro:    { label: 'Pro',    color: '#60A5FA', bg: 'rgba(79,123,247,0.15)' },
  agency: { label: 'Agency', color: '#A78BFA', bg: 'rgba(139,92,246,0.15)' },
}

export default function Sidebar() {
  const path = usePathname()
  const [dark, setDark] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('archon-theme')
    const isDark = saved !== 'light'
    setDark(isDark)

    const stored = localStorage.getItem('archon-user')
    if (stored) { try { setUser(JSON.parse(stored)) } catch {} }

    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (dark) {
      document.documentElement.classList.remove('light-theme')
      localStorage.setItem('archon-theme', 'dark')
    } else {
      document.documentElement.classList.add('light-theme')
      localStorage.setItem('archon-theme', 'light')
    }
  }, [dark, mounted])

  const logout = () => {
    localStorage.removeItem('archon-token')
    localStorage.removeItem('archon-user')
    window.location.href = '/login'
  }

  const b   = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const tm  = dark ? '#E2E8F0' : '#1A1A2E'
  const ts  = dark ? 'rgba(255,255,255,0.5)' : '#6B7280'
  const td  = dark ? 'rgba(255,255,255,0.25)' : '#9CA3AF'
  const sbg = dark ? '#161B27' : '#FFFFFF'

  const workspaceItems = [
    { label: 'Home',        icon: '⬡', href: '/' },
    { label: 'Tasks',       icon: '✦', href: '/tasks' },
    { label: 'Analytics',   icon: '◈', href: '/analytics' },
    { label: 'Market Map',  icon: '🗺', href: '/map' },
  ]

  const adminItems = [
    { label: 'Admin Panel',   icon: '⚙',  href: '/admin' },
    { label: 'Weekly Report', icon: '📊', href: '/report' },
    ...(user?.role === 'admin' ? [{ label: 'Users', icon: '👥', href: '/users' }] : []),
  ]

  const NavItem = ({ item, accentColor = '#60A5FA', activeBg = 'rgba(79,123,247,0.15)' }: {
    item: { label: string; icon: string; href: string }
    accentColor?: string
    activeBg?: string
  }) => {
    const active = path === item.href
    return (
      <a href={item.href} style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 12px', borderRadius: '8px', fontSize: '14px',
        fontWeight: 500, textDecoration: 'none', marginBottom: '2px',
        background: active ? activeBg : 'transparent',
        color: active ? accentColor : ts, transition: 'all 0.15s',
      }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6'; e.currentTarget.style.color = tm } }}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ts } }}
      >
        <span style={{ fontSize: '15px', color: active ? accentColor : td }}>{item.icon}</span>
        <span>{item.label}</span>
        {active && <span style={{ marginLeft: 'auto', width: '4px', height: '16px', borderRadius: '2px', background: accentColor, opacity: 0.8 }} />}
      </a>
    )
  }

  const planBadge = user ? PLAN_BADGE[user.plan] || PLAN_BADGE.basic : null

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100vh', width: '224px',
      display: 'flex', flexDirection: 'column', zIndex: 30,
      background: sbg, borderRight: `1px solid ${b}`,
      transition: 'background 0.25s ease, border-color 0.25s ease',
    }}>

      {/* LOGO */}
      <div style={{ padding: '24px 20px', borderBottom: `1px solid ${b}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)' }}>A</div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: tm, margin: 0 }}>Archon</p>
            <p style={{ fontSize: '10px', color: td, margin: 0 }}>by Armila Design</p>
          </div>
        </div>
      </div>

      {/* NAV */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        <p style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: td, padding: '0 4px', marginBottom: '8px', marginTop: 0 }}>Workspace</p>
        {workspaceItems.map(item => <NavItem key={item.href} item={item} />)}

        <div style={{ paddingTop: '16px', marginTop: '16px', borderTop: `1px solid ${b}` }}>
          <p style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: td, padding: '0 4px', marginBottom: '8px', marginTop: 0 }}>Admin</p>
          {adminItems.map(item => (
            <NavItem key={item.href} item={item} accentColor='#A78BFA' activeBg='rgba(139,92,246,0.15)' />
          ))}
        </div>
      </nav>

      {/* FOOTER */}
      <div style={{ padding: '16px', borderTop: `1px solid ${b}` }}>
        {/* THEME */}
        <button onClick={() => setDark(!dark)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', background: dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: ts }}>{dark ? '🌙 Dark' : '☀️ Light'}</span>
          <div style={{ width: '32px', height: '16px', borderRadius: '8px', position: 'relative', background: dark ? 'rgba(79,123,247,0.4)' : '#D1D5DB', transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: '2px', left: dark ? '16px' : '2px', width: '12px', height: '12px', borderRadius: '50%', background: dark ? '#60A5FA' : 'white', transition: 'left 0.2s' }} />
          </div>
        </button>

        {/* USER */}
        {user && (
          <div onClick={() => window.location.href = '/profile'} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 8px', borderRadius: '10px', margin: '-6px -8px', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)' }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '12px', fontWeight: 500, color: tm, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                {planBadge && (
                  <span style={{ fontSize: '9px', fontWeight: 600, color: planBadge.color, background: planBadge.bg, padding: '1px 6px', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {planBadge.label}
                  </span>
                )}
                {user.role === 'admin' && (
                  <span style={{ fontSize: '9px', fontWeight: 600, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '1px 6px', borderRadius: '999px' }}>Admin</span>
                )}
              </div>
            </div>
            <button onClick={logout}
              style={{ fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', color: td, padding: '4px', borderRadius: '6px', transition: 'color 0.15s' }}
              title="Logout"
              onMouseEnter={e => { e.currentTarget.style.color = '#F87171' }}
              onMouseLeave={e => { e.currentTarget.style.color = td }}>
              ⏻
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
