'use client'
import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

/** Standard "nothing here yet" block — same neutral card language everywhere
 * in the app, so every page's empty state looks and feels the same instead
 * of each screen inventing its own padding/icon/copy treatment. */
export default function EmptyState({ icon: Icon, title, description, action, compact = false }: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div style={{
      borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)',
      textAlign: 'center', padding: compact ? '32px 20px' : '56px 24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px', opacity: 0.5 }}>
        <Icon size={compact ? 28 : 36} strokeWidth={1.25} color="var(--text-dim)" />
      </div>
      <p style={{ fontSize: compact ? '13px' : '14px', fontWeight: 600, color: 'var(--text-muted)', margin: description ? '0 0 6px' : 0 }}>{title}</p>
      {description && <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '0 auto', maxWidth: '360px', lineHeight: 1.6 }}>{description}</p>}
      {action && <div style={{ marginTop: '18px' }}>{action}</div>}
    </div>
  )
}
