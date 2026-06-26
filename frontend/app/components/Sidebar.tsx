'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function Sidebar() {
  const path = usePathname()
  const [dark, setDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('archon-theme')
    if (saved === 'light') {
      setDark(false)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('archon-theme', dark ? 'dark' : 'light')
    if (dark) {
      document.body.style.background = '#0F1117'
      document.body.style.color = '#E2E8F0'
    } else {
      document.body.style.background = '#F4F6FA'
      document.body.style.color = '#1A1A2E'
    }
  }, [dark, mounted])

  const borderColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const sidebarBg = dark ? '#161B27' : '#FFFFFF'
  const textMain = dark ? '#E2E8F0' : '#1A1A2E'
  const textMuted = dark ? 'rgba(255,255,255,0.5)' : '#6B7280'
  const textDim = dark ? 'rgba(255,255,255,0.25)' : '#9CA3AF'

  const navItems = [
    { label: 'Home', icon: '⬡', href: '/' },
    { label: 'Tasks', icon: '✦', href: '/tasks' },
    { label: 'Analytics', icon: '◈', href: '/analytics' },
  ]

  const adminItems = [
    { label: 'Admin Panel', icon: '⚙', href: '/admin' },
  ]

  const NavLink = ({ href, label, icon, isAdmin }: { href: string; label: string; icon: string; isAdmin?: boolean }) => {
    const active = path === href
    const activeColor = isAdmin ? '#A78BFA' : '#60A5FA'
    const activeBg = isAdmin ? 'rgba(139,92,246,0.15)' : 'rgba(79,123,247,0.15)'
    const activeBarColor = isAdmin ? '#A78BFA' : '#60A5FA'

    return (
      
        href={href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 12px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500,
          textDecoration: 'none',
          background: active ? activeBg : 'transparent',
          color: active ? activeColor : textMuted,
          transition: 'all 0.15s',
          marginBottom: '2px',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6'
            e.currentTarget.style.color = dark ? 'rgba(255,255,255,0.8)' : '#1A1A2E'
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = textMuted
          }
        }}
      >
        <span style={{ color: active ? activeColor : textDim, fontSize: '16px' }}>{icon}</span>
        <span>{label}</span>
        {active && (
          <span style={{
            marginLeft: 'auto',
            width: '4px',
            height: '16px',
            borderRadius: '2px',
            background: activeBarColor,
            opacity: 0.8,
          }} />
        )}
      </a>
    )
  }

  return (
    <aside style={{
      position: 'fixed',
      left: 0,
      top: 0,
      height: '100vh',
      width: '224px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 30,
      background: sidebarBg,
      borderRight: `1px solid ${borderColor}`,
    }}>

      {/* LOGO */}
      <div style={{ padding: '24px 20px', borderBottom: `1px solid ${borderColor}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, color: 'white',
            background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)',
          }}>
            A
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: textMain, letterSpacing: '0.02em', margin: 0 }}>Archon</p>
            <p style={{ fontSize: '10px', color: textDim, margin: 0 }}>by Armila Design</p>
          </div>
        </div>
      </div>

      {/* NAV */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        <p style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: textDim, padding: '0 4px', marginBottom: '8px' }}>
          Workspace
        </p>

        {navItems.map(item => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}

        <div style={{ paddingTop: '16px', marginTop: '16px', borderTop: `1px solid ${borderColor}` }}>
          <p style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: textDim, padding: '0 4px', marginBottom: '8px' }}>
            Admin
          </p>
          {adminItems.map(item => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} isAdmin />
          ))}
        </div>
      </nav>

      {/* BOTTOM */}
      <div style={{ padding: '16px', borderTop: `1px solid ${borderColor}` }}>

        {/* THEME TOGGLE */}
        <button
          onClick={() => setDark(!dark)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '8px',
            marginBottom: '12px',
            background: dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 500, color: textMuted }}>
            {dark ? '🌙 Dark' : '☀️ Light'}
          </span>
          <div style={{
            width: '32px', height: '16px', borderRadius: '8px', position: 'relative',
            background: dark ? 'rgba(79,123,247,0.4)' : '#D1D5DB',
            transition: 'background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: '2px',
              left: dark ? '16px' : '2px',
              width: '12px', height: '12px',
              borderRadius: '50%',
              background: dark ? '#60A5FA' : 'white',
              transition: 'left 0.2s',
            }} />
          </div>
        </button>

        {/* USER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, color: 'white',
            background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)',
          }}>
            M
          </div>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 500, color: textMain, margin: 0 }}>Milad Rostami</p>
            <p style={{ fontSize: '10px', color: textDim, margin: 0 }}>Admin</p>
          </div>
        </div>
      </div>
    </aside>
  )
}