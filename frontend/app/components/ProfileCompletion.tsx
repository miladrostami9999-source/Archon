'use client'
import { CheckCircle2, Circle } from 'lucide-react'

export interface CompletionSignals {
  isVerified: boolean
  hasPost: boolean
  hasSentEmail: boolean
  isPublic: boolean
  hasPortfolio: boolean
  hasAvatar: boolean
}

interface ChecklistItem {
  key: keyof CompletionSignals
  label: string
  action: { label: string; href?: string; onClick?: () => void }
}

interface ProfileCompletionProps {
  signals: CompletionSignals
  onNavigateTab: (tab: 'info' | 'portfolio' | 'security') => void
}

export default function ProfileCompletion({ signals, onNavigateTab }: ProfileCompletionProps) {
  const items: ChecklistItem[] = [
    { key: 'hasAvatar', label: 'Add a profile photo', action: { label: 'Add photo', onClick: () => onNavigateTab('info') } },
    { key: 'isVerified', label: 'Verify your identity', action: { label: 'Verify', href: '/verification' } },
    { key: 'hasPortfolio', label: 'Add a portfolio project', action: { label: 'Add project', onClick: () => onNavigateTab('portfolio') } },
    { key: 'isPublic', label: 'Make your profile public', action: { label: 'Publish', onClick: () => onNavigateTab('security') } },
    { key: 'hasPost', label: 'Share your first post', action: { label: 'Go to Feed', href: '/feed' } },
    { key: 'hasSentEmail', label: 'Send your first email to a company', action: { label: 'Go to Dashboard', href: '/dashboard' } },
  ]

  const done = items.filter(i => signals[i.key]).length
  const percent = Math.round((done / items.length) * 100)
  const complete = percent === 100
  const barColor = complete ? 'var(--success)' : 'var(--accent)'

  return (
    <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px 22px', marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Profile completion</h3>
        <span className="mono" style={{ fontSize: '15px', fontWeight: 700, color: barColor }}>{percent}%</span>
      </div>

      <div style={{ height: '6px', borderRadius: '999px', background: 'var(--bg-input)', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ height: '100%', width: `${percent}%`, background: barColor, borderRadius: '999px', transition: 'width 0.3s ease, background 0.3s ease' }} />
      </div>

      {!complete && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {items.filter(i => !signals[i.key]).map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <Circle size={15} strokeWidth={1.75} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.label}</span>
              </div>
              {item.action.href ? (
                <a href={item.action.href} style={{ fontSize: '12px', fontWeight: 600, color: '#60A5FA', textDecoration: 'none', flexShrink: 0 }}>
                  {item.action.label} →
                </a>
              ) : (
                <button onClick={item.action.onClick}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#60A5FA', flexShrink: 0 }}>
                  {item.action.label} →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {complete && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} strokeWidth={2} style={{ color: 'var(--success)' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Your profile is complete.</span>
        </div>
      )}
    </div>
  )
}
