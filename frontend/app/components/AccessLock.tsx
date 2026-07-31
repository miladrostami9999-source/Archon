'use client'
import { ReactNode } from 'react'
import type { AccessState, LockReason } from '../hooks/useAccess'

/**
 * The visual half of the access rules.
 *
 * These components never decide anything — the server has already stripped the
 * values before they reach the browser. Blurring is there so the shape of what
 * you're missing is visible and the upgrade path is obvious; it is not what
 * keeps the data safe.
 */

const REASON_TITLE: Record<string, string> = {
  pending_payment: 'Waiting on payment confirmation',
  expired: 'Your plan has expired',
  quota_exhausted: 'Your plan is fully used',
  not_unlocked: 'Locked',
}

/** Blur a value the account can't read yet. */
export function Blurred({ children, width = 110 }: { children?: ReactNode; width?: number }) {
  return (
    <span
      aria-hidden
      title="Locked — upgrade to reveal"
      style={{
        display: 'inline-block',
        minWidth: `${width}px`,
        filter: 'blur(5px)',
        opacity: 0.65,
        userSelect: 'none',
        pointerEvents: 'none',
        verticalAlign: 'middle',
        color: 'var(--text-muted)',
      }}
    >
      {children ?? 'company@example.com'}
    </span>
  )
}

/** A locked field: blurred placeholder plus a small padlock. */
export function LockedField({ label, placeholder, width }: { label?: string; placeholder?: string; width?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <Blurred width={width}>{placeholder}</Blurred>
      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }} title={label ? `${label} is locked` : 'Locked'}>🔒</span>
    </span>
  )
}

/** Page-level banner explaining why the account is cut off. */
export function LockBanner({ access, compact = false }: { access: AccessState; compact?: boolean }) {
  if (!access?.locked) return null
  const isExpired = access.reason === 'expired'
  const accent = isExpired ? '#F87171' : access.reason === 'quota_exhausted' ? '#FB923C' : '#FBBF24'
  const tint = isExpired ? 'rgba(248,113,113,0.08)' : access.reason === 'quota_exhausted' ? 'rgba(251,146,60,0.08)' : 'rgba(251,191,36,0.08)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
      padding: compact ? '10px 16px' : '14px 24px',
      background: tint, borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '18px' }}>{isExpired ? '⏳' : '🔒'}</span>
      <div style={{ flex: 1, minWidth: '220px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: accent, margin: 0 }}>
          {REASON_TITLE[access.reason || ''] || 'Locked'}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.6 }}>
          {access.message}
        </p>
      </div>
      <a href="/upgrade" style={{
        padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600,
        color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)',
        textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        {isExpired ? 'Renew plan' : 'Complete payment'}
      </a>
    </div>
  )
}

/** Notice that this plan only covers part of the catalog. */
export function CountryScopeNotice({ access }: { access: AccessState }) {
  if (!access?.countries?.length) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      padding: '9px 24px', background: 'rgba(79,123,247,0.06)',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '13px' }}>🌍</span>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, flex: 1, minWidth: '200px' }}>
        Your plan covers <strong style={{ color: 'var(--text)' }}>{access.countries.join(', ')}</strong>.
        Other countries are hidden until you upgrade.
      </p>
      <a href="/upgrade" style={{ fontSize: '12px', fontWeight: 600, color: '#60A5FA', textDecoration: 'none', whiteSpace: 'nowrap' }}>
        See all countries →
      </a>
    </div>
  )
}

/** Button that spends one company credit to reveal a company's details. */
export function UnlockButton({ onUnlock, busy, reason, size = 'md' }: {
  onUnlock: () => void
  busy?: boolean
  reason?: LockReason
  size?: 'sm' | 'md'
}) {
  // Account-level locks aren't fixed by spending a credit — send them to billing.
  if (reason && reason !== 'not_unlocked') {
    return (
      <a href="/upgrade" onClick={e => e.stopPropagation()} style={{
        padding: size === 'sm' ? '5px 11px' : '8px 16px',
        borderRadius: '8px', fontSize: size === 'sm' ? '11.5px' : '12.5px', fontWeight: 600,
        color: '#FBBF24', background: 'rgba(251,191,36,0.12)',
        border: '1px solid rgba(251,191,36,0.25)', textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        🔒 Upgrade
      </a>
    )
  }
  return (
    <button
      onClick={e => { e.stopPropagation(); onUnlock() }}
      disabled={busy}
      style={{
        padding: size === 'sm' ? '5px 11px' : '8px 16px',
        borderRadius: '8px', fontSize: size === 'sm' ? '11.5px' : '12.5px', fontWeight: 600,
        color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)',
        border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {busy ? 'Unlocking…' : '🔓 Unlock'}
    </button>
  )
}

/** Full-page stand-in for a feature the current plan doesn't include. */
export function FeatureLocked({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '48px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '420px' }}>
        <p style={{ fontSize: '34px', margin: '0 0 14px', opacity: 0.5 }}>🔒</p>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>{title}</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.7, margin: '0 0 20px' }}>{blurb}</p>
        <a href="/upgrade" style={{
          display: 'inline-block', padding: '10px 22px', borderRadius: '9px',
          fontSize: '13px', fontWeight: 600, color: 'white',
          background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', textDecoration: 'none',
        }}>
          Upgrade plan
        </a>
      </div>
    </div>
  )
}
