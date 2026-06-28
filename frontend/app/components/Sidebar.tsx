'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

interface User { name: string; email: string; role: string; plan: string }
const PLAN_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  basic:  { label: 'Basic',  color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
  pro:    { label: 'Pro',    color: '#60A5FA', bg: 'rgba(79,123,247,0.15)' },
  agency: { label: 'Agency', color: '#A78BFA', bg: 'rgba(139,92,246,0.15)' },
}

// SVG Icons — proper icons for each page
const ICONS: Record<string, JSX.Element> = {
  home: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  tasks: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  analytics: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  map: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  admin: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg>,
  report: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
}

export default function Sidebar() {
  const path = usePathname()
  const [dark, setDark] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [avatar, setAvatar] = useState<string>('')

  useEffect(() => {
    const saved = localStorage.getItem('archon-theme')
    setDark(saved !== 'light')
    const stored = localStorage.getItem('archon-user')
    if (stored) { try { setUser(JSON.parse(stored)) } catch {} }
    // Load avatar from profile
    const prof = localStorage.getItem('archon-profile')
    if (prof) { try { const p = JSON.parse(prof); if (p.avatar) setAvatar(p.avatar) } catch {} }
    setMounted(true)

    // Listen for profile updates
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'archon-profile' && e.newValue) {
        try { const p = JSON.parse(e.newValue); if (p.avatar !== undefined) setAvatar(p.avatar) } catch {}
      }
      if (e.key === 'archon-user' && e.newValue) {
        try { setUser(JSON.parse(e.newValue)) } catch {}
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (dark) { document.documentElement.classList.remove('light-theme'); localStorage.setItem('archon-theme', 'dark') }
    else { document.documentElement.classList.add('light-theme'); localStorage.setItem('archon-theme', 'light') }
  }, [dark, mounted])

  const logout = () => { localStorage.removeItem('archon-token'); localStorage.removeItem('archon-user'); window.location.href = '/login' }

  const b   = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const tm  = dark ? '#E2E8F0' : '#1A1A2E'
  const ts  = dark ? 'rgba(255,255,255,0.5)' : '#6B7280'
  const td  = dark ? 'rgba(255,255,255,0.22)' : '#9CA3AF'
  const sbg = dark ? '#161B27' : '#FFFFFF'

  const workspaceItems = [
    { label: 'Home',       iconKey: 'home',      href: '/' },
    { label: 'Tasks',      iconKey: 'tasks',     href: '/tasks' },
    { label: 'Analytics',  iconKey: 'analytics', href: '/analytics' },
    { label: 'Market Map', iconKey: 'map',       href: '/map' },
  ]
  const adminItems = [
    { label: 'Admin Panel',   iconKey: 'admin',  href: '/admin' },
    { label: 'Weekly Report', iconKey: 'report', href: '/report' },
    ...(user?.role === 'admin' ? [{ label: 'Users', iconKey: 'users', href: '/users' }] : []),
  ]

  const NavItem = ({ item, accentColor = '#60A5FA', activeBg = 'rgba(79,123,247,0.12)' }: {
    item: { label: string; iconKey: string; href: string }
    accentColor?: string; activeBg?: string
  }) => {
    const active = path === item.href
    return (
      <a href={item.href} style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
        fontWeight: 500, textDecoration: 'none', marginBottom: '2px',
        background: active ? activeBg : 'transparent',
        color: active ? accentColor : ts, transition: 'all 0.18s',
      }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6'; e.currentTarget.style.color = tm } }}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ts } }}>
        <span style={{ color: active ? accentColor : td, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {ICONS[item.iconKey]}
        </span>
        <span>{item.label}</span>
        {active && <span style={{ marginLeft: 'auto', width: '3px', height: '14px', borderRadius: '2px', background: accentColor, opacity: 0.9 }} />}
      </a>
    )
  }

  const planBadge = user ? PLAN_BADGE[user.plan] || PLAN_BADGE.basic : null

  return (
    <>
      {/* Page transition overlay */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .page-fade { animation: fadeIn 0.3s ease forwards; }
      `}</style>

      <aside style={{
        position: 'fixed', left: 0, top: 0, height: '100vh', width: '224px',
        display: 'flex', flexDirection: 'column', zIndex: 30,
        background: sbg, borderRight: `1px solid ${b}`,
        transition: 'background 0.25s ease, border-color 0.25s ease',
      }}>

        {/* LOGO */}
        <div style={{ padding: '20px 16px', borderBottom: `1px solid ${b}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', boxShadow: '0 2px 8px rgba(79,123,247,0.35)' }}>A</div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: tm, margin: 0, letterSpacing: '-0.01em' }}>Archon</p>
              <p style={{ fontSize: '10px', color: td, margin: 0 }}>by Armila Design</p>
            </div>
          </div>
        </div>

        {/* NAV */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: td, padding: '0 4px', marginBottom: '6px', marginTop: 0 }}>Workspace</p>
          {workspaceItems.map(item => <NavItem key={item.href} item={item} />)}

          <div style={{ paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${b}` }}>
            <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: td, padding: '0 4px', marginBottom: '6px', marginTop: 0 }}>Admin</p>
            {adminItems.map(item => (
              <NavItem key={item.href} item={item} accentColor='#A78BFA' activeBg='rgba(139,92,246,0.12)' />
            ))}
          </div>
        </nav>

        {/* FOOTER */}
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${b}` }}>
          {/* THEME */}
          <button onClick={() => setDark(!dark)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '8px', marginBottom: '10px', background: dark ? 'rgba(255,255,255,0.04)' : '#F3F4F6', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: ts }}>{dark ? '🌙 Dark' : '☀️ Light'}</span>
            <div style={{ width: '30px', height: '15px', borderRadius: '8px', position: 'relative', background: dark ? 'rgba(79,123,247,0.4)' : '#D1D5DB', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: '1.5px', left: dark ? '15px' : '1.5px', width: '12px', height: '12px', borderRadius: '50%', background: dark ? '#60A5FA' : 'white', transition: 'left 0.2s' }} />
            </div>
          </button>

          {/* USER */}
          {user && (
            <div onClick={() => window.location.href = '/profile'}
              style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', padding: '6px 8px', borderRadius: '10px', margin: '-2px -4px', transition: 'background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>

              {/* AVATAR — shows photo if uploaded */}
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '2px solid rgba(79,123,247,0.3)' }}>
                {avatar ? (
                  <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)' }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: tm, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
                <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                  {planBadge && <span style={{ fontSize: '9px', fontWeight: 700, color: planBadge.color, background: planBadge.bg, padding: '1px 5px', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{planBadge.label}</span>}
                  {user.role === 'admin' && <span style={{ fontSize: '9px', fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '1px 5px', borderRadius: '999px' }}>Admin</span>}
                </div>
              </div>

              <button onClick={e => { e.stopPropagation(); logout() }}
                style={{ fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', color: td, padding: '3px', borderRadius: '5px', transition: 'color 0.15s', flexShrink: 0 }}
                title="Logout"
                onMouseEnter={e => { e.currentTarget.style.color = '#F87171' }}
                onMouseLeave={e => { e.currentTarget.style.color = td }}>⏻</button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
