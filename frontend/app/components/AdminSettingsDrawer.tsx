'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

/** Same slide-over pattern as MemberPreviewDrawer, generalized for admin
 * settings panels: a titled right-side drawer that just renders whatever
 * children it's given — each admin section keeps its own state/fetch logic
 * unchanged, only the "always visible on the page" wrapper becomes "opens on
 * demand" via this shell. */
export default function AdminSettingsDrawer({ title, open, onClose, children }: {
  title: string; open: boolean; onClose: () => void; children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: '460px', maxWidth: '100%',
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 61,
        display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        animation: 'adminDrawerSlideIn 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', borderRadius: 'var(--radius-sm)' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {children}
        </div>
      </div>

      <style>{`@keyframes adminDrawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  )
}
