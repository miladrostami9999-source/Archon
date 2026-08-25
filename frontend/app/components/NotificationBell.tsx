'use client'
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import {
  Bell, Mail, PartyPopper, MessageCircle, CreditCard, CheckCircle2,
  Package, Wallet, Landmark, Star, IdCard, Heart, Megaphone,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const POLL_MS = 20000

interface Item {
  id: number
  kind: string
  title: string
  body: string
  link: string
  read: boolean
  created_at: string
}

// One icon per event so a full list is scannable without reading every line.
const ICON: Record<string, any> = {
  proposal_received: Mail,
  proposal_accepted: PartyPopper,
  proposal_rejected: MessageCircle,
  message_received: MessageCircle,
  payment_submitted: CreditCard,
  milestone_funded: CheckCircle2,
  milestone_delivered: Package,
  milestone_approved: Wallet,
  milestone_released: Landmark,
  review_received: Star,
  verification_submitted: IdCard,
  verification_reviewed: IdCard,
  post_liked: Heart,
  post_commented: MessageCircle,
  broadcast: Megaphone,
  gmail_connected: Mail,
}

const relative = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const PANEL_WIDTH = 320
const PANEL_MARGIN = 12  // keep clear of the viewport edge

export default function NotificationBell({ dark = true }: { dark?: boolean }) {
  const [items, setItems] = useState<Item[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const load = () => {
    axios.get(`${API}/marketplace/notifications`, { params: { limit: 20 } })
      .then(r => { setItems(r.data.items); setUnread(r.data.unread) })
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [])

  // Close on an outside click, the way every other dropdown behaves.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const openList = () => {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen) {
      // Anchor to the button's actual on-screen position rather than the
      // narrow sidebar it sits in — `right: 0` on a relative ancestor near
      // the sidebar's left edge pushed most of a 320px panel off-screen.
      const rect = btnRef.current?.getBoundingClientRect()
      if (rect) {
        const left = Math.min(
          Math.max(PANEL_MARGIN, rect.right - PANEL_WIDTH),
          window.innerWidth - PANEL_WIDTH - PANEL_MARGIN,
        )
        setPos({ top: rect.bottom + 6, left })
      }
      // Opening the list counts as having seen them — otherwise the badge
      // sits there forever unless every single item happens to get clicked.
      // Mark-read first, then reload, so the fetch doesn't race the local
      // "read" update and briefly restore the unread state.
      readAll().then(load)
    }
  }

  const readAll = async () => {
    await axios.post(`${API}/marketplace/notifications/read-all`).catch(() => {})
    setUnread(0)
    setItems(list => list.map(i => ({ ...i, read: true })))
  }

  const go = async (n: Item) => {
    if (!n.read) {
      axios.post(`${API}/marketplace/notifications/${n.id}/read`).catch(() => {})
      setUnread(u => Math.max(0, u - 1))
    }
    if (n.link) window.location.href = n.link
    else setOpen(false)
  }

  const border = 'var(--border)'
  const surface = 'var(--bg-sidebar)'
  const text = 'var(--text)'
  const dim = 'var(--text-muted)'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button ref={btnRef} onClick={openList} aria-label="Notifications"
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: dim, padding: '5px', display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-md)' }}>
        <Bell size={17} strokeWidth={1.75} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: '-1px', right: '-2px', minWidth: '15px', height: '15px',
            padding: '0 4px', borderRadius: '999px', background: 'var(--error)', color: 'white',
            fontSize: '9.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 60, width: `${PANEL_WIDTH}px`,
          maxHeight: '420px', display: 'flex', flexDirection: 'column',
          background: surface, border: `1px solid ${border}`, borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-pop)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: text }}>Notifications</span>
            {unread > 0 && (
              <button onClick={readAll}
                style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            {items.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: dim, textAlign: 'center', padding: '28px 16px', margin: 0 }}>
                Nothing yet.
              </p>
            ) : items.map(n => (
              <button key={n.id} onClick={() => go(n)}
                style={{
                  width: '100%', display: 'flex', gap: '9px', textAlign: 'left', cursor: 'pointer',
                  padding: '11px 14px', border: 'none', borderBottom: `1px solid ${border}`,
                  background: n.read ? 'transparent' : 'var(--accent-dim)',
                }}>
                <span style={{ flexShrink: 0, paddingTop: '1px' }}>
                  {(() => { const Icon = ICON[n.kind] || Bell; return <Icon size={15} strokeWidth={1.5} color="var(--text-muted)" /> })()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: n.read ? 500 : 700, color: text, minWidth: 0, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{n.title}</span>
                    <span style={{ fontSize: '10px', color: dim, marginLeft: 'auto', flexShrink: 0, whiteSpace: 'nowrap' }}>{relative(n.created_at)}</span>
                  </span>
                  {n.body && (
                    <span style={{ display: 'block', fontSize: '11.5px', color: dim, marginTop: '2px', lineHeight: 1.5, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{n.body}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
