'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect, type ReactElement } from 'react'
import {
  Home, CheckSquare, BarChart3, Map, FileText, Briefcase, FileCheck2,
  MessageCircle, Rss, Search, ShieldCheck, Users, ArrowUpCircle, CreditCard, UserPlus,
  Clock, IdCard,
} from 'lucide-react'
import NotificationBell from './NotificationBell'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface User { name: string; email: string; role: string; plan: string; is_verified?: boolean }
const PLAN_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  trial:  { label: 'Trial',  color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  basic:  { label: 'Basic',  color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
  pro:    { label: 'Pro',    color: '#60A5FA', bg: 'rgba(61,79,224,0.15)' },
  agency: { label: 'Agency', color: '#A78BFA', bg: 'rgba(139,92,246,0.15)' },
}

// Lucide icons, 1.5px stroke — replaces the hand-drawn SVGs so every icon
// in the sidebar shares one consistent weight and geometry.
const ICON_SIZE = 16
const ICON_STROKE = 1.5
const ICONS: Record<string, ReactElement> = {
  home:      <Home size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  tasks:     <CheckSquare size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  analytics: <BarChart3 size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  map:       <Map size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  admin:     <ShieldCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  projects:  <Briefcase size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  contracts: <FileCheck2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  messages:  <MessageCircle size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  feed:      <Rss size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  hunt:      <Search size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  report:    <FileText size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  users:     <Users size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  upgrade:   <ArrowUpCircle size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  payments:  <CreditCard size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  waitlist:  <UserPlus size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
}

// Hamburger icon
const HamburgerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

export default function Sidebar() {
  const path = usePathname()
  const [dark, setDark] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [avatar, setAvatar] = useState<string>('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [waitlistCount, setWaitlistCount] = useState(0)
  const [accountOpen, setAccountOpen] = useState(false)
  const [paymentCount, setPaymentCount] = useState(0)
  // Not in the login response (only /auth/me has it) and can change any time
  // an admin flips it for this account, so it's fetched fresh rather than
  // read from the cached archon-user snapshot.
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(false)
  const [mpPaymentCount, setMpPaymentCount] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [pendingProposals, setPendingProposals] = useState(0)
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null)
  const [pendingVerifications, setPendingVerifications] = useState(0)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close sidebar on route change (mobile)
  useEffect(() => { setMobileOpen(false); setAccountOpen(false) }, [path])

  useEffect(() => {
    const saved = localStorage.getItem('archon-theme')
    setDark(saved !== 'light')
    const stored = localStorage.getItem('archon-user')
    if (stored) { try { setUser(JSON.parse(stored)) } catch {} }
    const prof = localStorage.getItem('archon-profile')
    if (prof) { try { const p = JSON.parse(prof); if (p.avatar) setAvatar(p.avatar) } catch {} }
    // Marketplace-gated nav items (Projects, Feed, ...) used to always start
    // hidden and pop in once /auth/me resolved, flashing on every reload.
    // Seed from the last known value so they render in their final state
    // immediately; the effect below still fetches the live value right after.
    const cachedMarketplace = localStorage.getItem('archon-marketplace-enabled')
    if (cachedMarketplace !== null) setMarketplaceEnabled(cachedMarketplace === 'true')
    setMounted(true)

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'archon-profile' && e.newValue) {
        try { const p = JSON.parse(e.newValue); if (p.avatar !== undefined) setAvatar(p.avatar) } catch {}
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

  useEffect(() => {
    if (!user) return
    const token = localStorage.getItem('archon-token') || ''
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const enabled = !!d.marketplace_beta_enabled
        setMarketplaceEnabled(enabled)
        localStorage.setItem('archon-marketplace-enabled', String(enabled))
      })
      .catch(() => {})
  }, [user])

  // Marketplace notification badges — unread messages, and proposals waiting
  // on a decision. Polled on the same cadence as the admin badges.
  useEffect(() => {
    if (!marketplaceEnabled) return
    const token = localStorage.getItem('archon-token') || ''
    const h = { Authorization: `Bearer ${token}` }
    const load = () => {
      fetch(`${API}/marketplace/messages/unread-count`, { headers: h })
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => setUnreadMessages(d.count || 0))
        .catch(() => {})
      fetch(`${API}/marketplace/proposals/pending-count`, { headers: h })
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => setPendingProposals(d.count || 0))
        .catch(() => {})
      fetch(`${API}/marketplace/verification/me`, { headers: h })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setVerifyStatus(d.status) })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [marketplaceEnabled, path])

  // Poll pending waitlist count for the admin notification badge
  useEffect(() => {
    if (user?.role !== 'admin') return
    const token = localStorage.getItem('archon-token') || ''
    const load = () => {
      fetch(`${API}/auth/waitlist/pending-count`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => setWaitlistCount(d.count || 0))
        .catch(() => {})
      fetch(`${API}/auth/billing/requests/pending-count`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => setPaymentCount(d.count || 0))
        .catch(() => {})
      fetch(`${API}/marketplace/admin/pending-count`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => setMpPaymentCount(d.count || 0))
        .catch(() => {})
      fetch(`${API}/marketplace/verification/admin/pending-count`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => setPendingVerifications(d.count || 0))
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60000)  // refresh every minute
    return () => clearInterval(id)
  }, [user])

  // Prevent body scroll when mobile sidebar open
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const logout = () => { localStorage.removeItem('archon-token'); localStorage.removeItem('archon-user'); window.location.href = '/login' }

  // Sourced from the CSS custom properties in globals.css, not recomputed
  // from the `dark` flag here — that duplication used to mean the sidebar's
  // own colors never moved when the design tokens changed.
  const b   = 'var(--border)'
  const tm  = 'var(--text)'
  const ts  = 'var(--text-muted)'
  const td  = 'var(--text-dim)'
  const sbg = 'var(--bg-sidebar)'

  const isAdmin = user?.role === 'admin'
  const workspaceItems = [
    { label: 'Home',       iconKey: 'home',      href: '/dashboard' },
    { label: 'Tasks',      iconKey: 'tasks',     href: '/tasks' },
    { label: 'Analytics',  iconKey: 'analytics', href: '/analytics' },
    { label: 'Market Map', iconKey: 'map',       href: '/map' },
    { label: 'Weekly Report', iconKey: 'report', href: '/report' },
    // Marketplace is in private beta — hidden until an admin flips the flag
    // for this account (admins always see it).
    ...(marketplaceEnabled ? [
      { label: 'Projects', iconKey: 'projects', href: '/projects', badge: pendingProposals },
      { label: 'My Contracts', iconKey: 'contracts', href: '/contracts' },
      { label: 'Messages', iconKey: 'messages', href: '/messages', badge: unreadMessages },
      { label: 'Feed', iconKey: 'feed', href: '/feed' },
    ] : []),
    // Admins are on an unlimited plan, so an upgrade page would be noise
    ...(isAdmin ? [] : [{ label: 'Upgrade', iconKey: 'upgrade', href: '/upgrade' }]),
  ]
  // Admin-only tools — hidden entirely for regular members
  const adminItems = isAdmin ? [
    { label: 'Lead Hunter', iconKey: 'hunt',     href: '/discovery' },
    { label: 'Admin Panel', iconKey: 'admin',    href: '/admin' },
    { label: 'Waitlist',    iconKey: 'waitlist', href: '/waitlist', badge: waitlistCount },
    { label: 'Payments',    iconKey: 'payments', href: '/payments', badge: paymentCount },
    { label: 'Marketplace Admin', iconKey: 'contracts', href: '/marketplace-admin', badge: mpPaymentCount + pendingVerifications },
  ] : []

  const NavItem = ({ item, accentColor = '#60A5FA', activeBg = 'rgba(61,79,224,0.12)' }: {
    item: { label: string; iconKey: string; href: string; badge?: number }
    accentColor?: string; activeBg?: string
  }) => {
    const active = path === item.href
    const showBadge = !!item.badge && item.badge > 0
    return (
      <a href={item.href}
        data-tour={item.href === '/tasks' ? 'nav-tasks' : item.href === '/analytics' ? 'nav-analytics' : undefined}
        onClick={() => setMobileOpen(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: isMobile ? '12px 14px' : '9px 12px',
          borderRadius: 'var(--radius-md)', fontSize: '13px',
          fontWeight: 500, textDecoration: 'none', marginBottom: '2px',
          background: active ? activeBg : 'transparent',
          color: active ? accentColor : ts, transition: 'all 0.18s',
        }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = tm } }}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ts } }}>
        <span style={{ color: active ? accentColor : td, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {ICONS[item.iconKey]}
        </span>
        <span>{item.label}</span>
        {showBadge && (
          <span style={{ marginLeft: 'auto', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px', background: '#EF4444', color: 'white', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.badge}
          </span>
        )}
        {active && !showBadge && <span style={{ marginLeft: 'auto', width: '3px', height: '14px', borderRadius: '2px', background: accentColor, opacity: 0.9 }} />}
      </a>
    )
  }

  const planBadge = user ? PLAN_BADGE[user.plan] || PLAN_BADGE.basic : null

  const SidebarContent = () => (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100dvh', maxHeight: '100vh', width: '224px',
      display: 'flex', flexDirection: 'column', zIndex: 50,
      background: sbg, borderRight: `1px solid ${b}`,
      transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), background 0.25s ease',
      transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
    }}>
      {/* LOGO */}
      <div style={{ padding: '20px 16px', borderBottom: `1px solid ${b}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/dashboard" onClick={() => setMobileOpen(false)}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'white', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', boxShadow: '0 2px 8px rgba(61,79,224,0.35)', flexShrink: 0 }}>A</div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: tm, margin: 0 }}>Archon</p>
            <p style={{ fontSize: '10px', color: td, margin: 0 }}>by Armila Design</p>
          </div>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {user && <NotificationBell dark={dark} />}
          {/* Close button on mobile */}
          {isMobile && (
            <button onClick={() => setMobileOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: td, padding: '4px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center' }}>
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {/* NAV */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: td, padding: '0 4px', marginBottom: '6px', marginTop: 0 }}>Workspace</p>
        {workspaceItems.map(item => <NavItem key={item.href} item={item} />)}

        {adminItems.length > 0 && (
          <div style={{ paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${b}` }}>
            <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: td, padding: '0 4px', marginBottom: '6px', marginTop: 0 }}>Admin</p>
            {adminItems.map(item => (
              <NavItem key={item.href} item={item} accentColor='#A78BFA' activeBg='rgba(139,92,246,0.12)' />
            ))}
          </div>
        )}
      </nav>

      {/* FOOTER */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${b}`, flexShrink: 0, maxHeight: '48vh', overflowY: 'auto' }}>
        {/* Verification is what makes a payout possible, so it's prompted
            here rather than left to be discovered. Hidden once verified. */}
        {marketplaceEnabled && verifyStatus && verifyStatus !== 'verified' && (
          <a href="/verification"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none',
              padding: '9px 10px', borderRadius: 'var(--radius-md)', marginBottom: '10px',
              border: `1px solid ${verifyStatus === 'pending' ? 'rgba(251,191,36,0.3)' : 'rgba(61,79,224,0.3)'}`,
              background: verifyStatus === 'pending' ? 'rgba(251,191,36,0.08)' : 'rgba(61,79,224,0.08)',
            }}>
            <span style={{ flexShrink: 0, display: 'flex' }}>
              {verifyStatus === 'pending'
                ? <Clock size={14} strokeWidth={1.75} color="#FBBF24" />
                : <IdCard size={14} strokeWidth={1.75} color="#60A5FA" />}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: verifyStatus === 'pending' ? '#FBBF24' : '#60A5FA' }}>
                {verifyStatus === 'pending' ? 'Verification in review' : 'Verify your identity'}
              </span>
              <span style={{ display: 'block', fontSize: '10.5px', color: td, lineHeight: 1.4, marginTop: '1px' }}>
                {verifyStatus === 'pending' ? "We'll let you know shortly" : 'Needed before you can be paid'}
              </span>
            </span>
          </a>
        )}

        {/* Quiet utility row — plain text/icon, background only on hover,
            rather than two permanently-filled pills sitting in the footer. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '10px' }}>
          <button onClick={() => setDark(!dark)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 8px', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', color: ts, fontSize: '12px', fontWeight: 500 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <div style={{ width: '26px', height: '14px', borderRadius: 'var(--radius-md)', position: 'relative', flexShrink: 0, background: dark ? 'var(--accent-dim)' : 'var(--border-mid)' }}>
              <div style={{ position: 'absolute', top: '1.5px', left: dark ? '13px' : '1.5px', width: '11px', height: '11px', borderRadius: '50%', background: dark ? 'var(--accent)' : 'white', transition: 'left 0.2s' }} />
            </div>
            {dark ? 'Dark' : 'Light'}
          </button>
          <button onClick={() => window.dispatchEvent(new Event('archon:open-onboarding'))}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 8px', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', color: ts, fontSize: '12px', fontWeight: 500 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            Help &amp; Tour
          </button>
        </div>

        {user && (
          <div data-tour="profile-link" onClick={() => { window.location.href = '/profile'; setMobileOpen(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', padding: '6px 8px', borderRadius: 'var(--radius-lg)', margin: '-2px -4px', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '2px solid rgba(61,79,224,0.3)' }}>
              {avatar ? (
                <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)' }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: tm, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
              <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                {planBadge && <span style={{ fontSize: '9px', fontWeight: 700, color: planBadge.color, background: planBadge.bg, padding: '1px 5px', borderRadius: '999px', textTransform: 'uppercase' }}>{planBadge.label}</span>}
                {user.role === 'admin' && <span style={{ fontSize: '9px', fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '1px 5px', borderRadius: '999px' }}>Admin</span>}
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); logout() }}
              style={{ fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', color: td, padding: '3px', borderRadius: 'var(--radius-xs)', transition: 'color 0.15s', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F87171' }}
              onMouseLeave={e => { e.currentTarget.style.color = td }}>⏻</button>
          </div>
        )}

        {/* Explicit, always-visible logout — especially important on mobile */}
        {user && (
          <button onClick={logout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '9px 10px', borderRadius: 'var(--radius-md)', marginTop: '10px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', cursor: 'pointer', color: '#F87171', fontSize: '12.5px', fontWeight: 600 }}>
            <span>⏻</span> Log out
          </button>
        )}
      </div>
    </aside>
  )

  return (
    <>
      {/* MOBILE TOP BAR */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '52px',
          background: sbg, borderBottom: `1px solid ${b}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', zIndex: 40,
        }}>
          <button onClick={() => setMobileOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: tm, padding: '6px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
            <HamburgerIcon />
          </button>
          <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: 'white' }}>A</div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: tm }}>Archon</span>
          </a>
          {/* Account menu — logout used to live only at the bottom of the drawer,
              which was easy to miss on a phone. */}
          <div style={{ position: 'relative' }}>
            <div data-tour="profile-link" onClick={() => setAccountOpen(o => !o)}
              style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', border: '2px solid rgba(61,79,224,0.3)' }}>
              {avatar ? (
                <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)' }}>
                  {user?.name.charAt(0).toUpperCase() || 'A'}
                </div>
              )}
            </div>

            {accountOpen && (
              <>
                <div onClick={() => setAccountOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 25 }} />
                <div style={{
                  position: 'absolute', top: '40px', right: 0, zIndex: 26, minWidth: '190px',
                  background: sbg, border: `1px solid ${b}`, borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.28)', overflow: 'hidden',
                }}>
                  {user && (
                    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${b}` }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: tm, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
                      <p style={{ fontSize: '11px', color: td, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
                    </div>
                  )}
                  <button onClick={() => { window.location.href = '/profile' }}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: ts }}>
                    Profile &amp; settings
                  </button>
                  <button onClick={() => { window.location.href = '/upgrade' }}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: ts, borderTop: `1px solid ${b}` }}>
                    Upgrade plan
                  </button>
                  <button onClick={logout}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'rgba(248,113,113,0.08)', border: 'none', borderTop: `1px solid ${b}`, cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#F87171' }}>
                    ⏻ Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* OVERLAY */}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 45 }} />
      )}

      {/* SIDEBAR */}
      <SidebarContent />
    </>
  )
}
