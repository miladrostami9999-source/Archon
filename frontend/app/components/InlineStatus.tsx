'use client'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

/** Renders a status message that follows the app's existing "✓ ..." / "✗ ..."
 * string convention (setMsg('✓ Saved') / setMsg('✗ Failed')) as a real icon +
 * colored text instead of the raw glyph — a presentation-only swap, so every
 * call site keeps its existing string state untouched, just renders through
 * this instead of a plain <p>. A message with neither prefix renders as a
 * neutral note (Info icon, muted text). Returns null for an empty string, so
 * `{msg && <InlineStatus text={msg} />}` still works without a change. */
export default function InlineStatus({ text, size = 12.5 }: { text: string; size?: number }) {
  if (!text) return null
  const isOk = text.startsWith('✓')
  const isErr = text.startsWith('✗')
  const clean = isOk || isErr ? text.slice(1).trim() : text
  const Icon = isOk ? CheckCircle2 : isErr ? XCircle : Info
  const color = isOk ? 'var(--success)' : isErr ? 'var(--error)' : 'var(--text-muted)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: `${size}px`, color }}>
      <Icon size={size + 1.5} strokeWidth={1.75} />
      {clean}
    </span>
  )
}
