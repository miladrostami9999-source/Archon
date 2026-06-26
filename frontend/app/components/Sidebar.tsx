'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const NAV = [
  { label: 'Home', icon: '⬡', href: '/' },
  { label: 'Tasks', icon: '✦', href: '/tasks' },
  { label: 'Analytics', icon: '◈', href: '/analytics' },
]

const ADMIN = [
  { label: 'Admin Panel', icon: '⚙', href: '/admin' },
]

export default function Sidebar() {
  const path = usePathname()
  const [dark, setDark] = useState(true)

  useEffect(() => {
    document.documentElement.style.setProperty('--bg-main', dark ? '#0F1117' : '#F4F6FA')
    document.documentElement.style.setProperty('--bg-sidebar', dark ? '#161B27' : '#FFFFFF')
    document.documentElement.style.setProperty('--text-main', dark ? '#E2E8F0' : '#1A1A2E')
  }, [dark])

  return (
    <>
      <aside className="fixed left-0 top-0 h-screen w-56 flex flex-col z-30"
        style={{
          background: dark
            ? 'linear-gradient(180deg, #161B27 0%, #131720 100%)'
            : 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
          borderRight: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)'
        }}>

        {/* LOGO */}
        <div className="px-5 py-6" style={{ borderBottom: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)' }}>
              A
            </div>
            <div>
              <p className={`text-sm font-semibold tracking-wide ${dark ? 'text-white' : 'text-gray-900'}`}>Archon</p>
              <p className={`text-[10px] ${dark ? 'text-white/30' : 'text-gray-400'}`}>by Armila Design</p>
            </div>
          </div>
        </div>

        {/* MAIN NAV */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className={`text-[10px] font-medium tracking-widest uppercase px-2 mb-2 ${dark ? 'text-white/25' : 'text-gray-400'}`}>
            Workspace
          </p>
          {NAV.map(item => {
            const active = path === item.href
            return (
              <a key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                  active
                    ? 'bg-blue-500/15 text-blue-400'
                    : dark
                      ? 'text-white/50 hover:text-white/80 hover:bg-white/5'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}>
                <span className={`text-base transition-all ${active ? 'text-blue-400' : dark ? 'text-white/30 group-hover:text-white/60' : 'text-gray-400 group-hover:text-gray-600'}`}>
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
                {active && <span className="ml-auto w-1 h-4 rounded-full bg-blue-400 opacity-80" />}
              </a>
            )
          })}

          <div className="pt-4 mt-4" style={{ borderTop: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)' }}>
            <p className={`text-[10px] font-medium tracking-widest uppercase px-2 mb-2 ${dark ? 'text-white/25' : 'text-gray-400'}`}>
              Admin
            </p>
            {ADMIN.map(item => {
              const active = path === item.href
              return (
                <a key={item.href} href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                    active
                      ? 'bg-purple-500/15 text-purple-400'
                      : dark
                        ? 'text-white/50 hover:text-white/80 hover:bg-white/5'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                  }`}>
                  <span className={`text-base ${active ? 'text-purple-400' : dark ? 'text-white/30 group-hover:text-white/60' : 'text-gray-400'}`}>
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                  {active && <span className="ml-auto w-1 h-4 rounded-full bg-purple-400 opacity-80" />}
                </a>
              )
            })}
          </div>
        </nav>

        {/* BOTTOM */}
        <div className="px-4 py-4" style={{ borderTop: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)' }}>
          {/* THEME TOGGLE */}
          <button
            onClick={() => setDark(!dark)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg mb-3 transition-all ${
              dark ? 'bg-white/5 hover:bg-white/8' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <span className={`text-xs font-medium ${dark ? 'text-white/50' : 'text-gray-500'}`}>
              {dark ? '🌙 Dark' : '☀️ Light'}
            </span>
            <div className={`w-8 h-4 rounded-full relative transition-all ${dark ? 'bg-blue-500/40' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${dark ? 'left-4 bg-blue-400' : 'left-0.5 bg-white'}`} />
            </div>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)' }}>
              M
            </div>
            <div>
              <p className={`text-xs font-medium ${dark ? 'text-white/70' : 'text-gray-700'}`}>Milad Rostami</p>
              <p className={`text-[10px] ${dark ? 'text-white/30' : 'text-gray-400'}`}>Admin</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}