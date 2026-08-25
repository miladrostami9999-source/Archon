'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import ContractChat from '../components/ContractChat'
import MarketplaceBeta, { BetaTag } from '../components/MarketplaceBeta'
import VerifiedBadge from '../components/VerifiedBadge'
import { useIsMobile } from '../hooks/useIsMobile'
import { ArrowLeft, ArrowRight } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const POLL_MS = 10000

interface Conversation {
  conversation_id: number
  contract_id: number | null
  project_title: string
  contract_status: string
  other_party_id: number
  other_party_name: string | null
  other_party_verified: boolean
  other_party_avatar: string
  viewer_role: 'client' | 'freelancer' | 'peer'
  other_party_username: string | null
  last_message: string | null
  last_message_at: string | null
  last_message_mine: boolean | null
  unread: number
}

const relative = (iso: string | null) => {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function MessagesPage() {
  const isMobile = useIsMobile()
  const [convos, setConvos] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('archon-user')
      if (stored) setCurrentUserId(JSON.parse(stored).id)
    } catch {}
  }, [])

  const load = (firstTime = false) => {
    axios.get(`${API}/marketplace/conversations`)
      .then(r => {
        setConvos(r.data)
        // Open the newest thread on a desktop first load so the pane isn't
        // empty; on mobile the list *is* the page, so leave it alone.
        // Measured from the window rather than the isMobile hook: that hook
        // is still false on the first render, which made the mobile layout
        // jump straight into a thread instead of showing the inbox.
        const wideEnough = typeof window !== 'undefined' && window.innerWidth >= 768
        if (firstTime && r.data.length && wideEnough) setSelected(r.data[0].conversation_id)
      })
      .catch((e) => { if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard' })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(true)
    const timer = setInterval(() => load(), POLL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shown = filter === 'unread' ? convos.filter(c => c.unread > 0) : convos
  const totalUnread = convos.reduce((a, c) => a + c.unread, 0)
  const active = convos.find(c => c.conversation_id === selected) || null

  const ConversationList = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Messages</h1>
          {totalUnread > 0 && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'white', background: '#EF4444', padding: '1px 7px', borderRadius: '999px' }}>{totalUnread}</span>
          )}
          <BetaTag />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '4px 12px', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                border: '1px solid ' + (filter === f ? 'rgba(61,79,224,0.4)' : 'var(--border)'),
                background: filter === f ? 'rgba(61,79,224,0.15)' : 'transparent',
                color: filter === f ? '#60A5FA' : 'var(--text-muted)' }}>
              {f}{f === 'unread' && totalUnread > 0 ? ` (${totalUnread})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '20px 16px' }}>Loading…</p>
        ) : shown.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', padding: '24px 16px', textAlign: 'center', lineHeight: 1.6 }}>
            {filter === 'unread'
              ? 'Nothing unread.'
              : 'No conversations yet. A thread opens automatically once a proposal is accepted and a contract starts.'}
          </p>
        ) : shown.map(c => {
          const on = c.conversation_id === selected
          const initials = (c.other_party_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
          return (
            <button key={c.conversation_id} onClick={() => setSelected(c.conversation_id)}
              style={{
                width: '100%', display: 'flex', gap: '10px', alignItems: 'center', textAlign: 'left',
                padding: '12px 16px', border: 'none', cursor: 'pointer',
                borderLeft: `3px solid ${on ? '#3D4FE0' : 'transparent'}`,
                background: on ? 'rgba(61,79,224,0.08)' : 'transparent',
                borderBottom: '1px solid var(--border)',
              }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)' }}>
                {c.other_party_avatar
                  ? <img src={c.other_party_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{initials}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: c.unread > 0 ? 700 : 600, color: 'var(--text)', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.other_party_name || 'Unknown'}</span>
                    {c.other_party_verified && <VerifiedBadge size={12} />}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: 'auto', flexShrink: 0 }}>{relative(c.last_message_at)}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.project_title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11.5px', color: c.unread > 0 ? 'var(--text)' : 'var(--text-dim)', fontWeight: c.unread > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {c.last_message ? `${c.last_message_mine ? 'You: ' : ''}${c.last_message}` : 'No messages yet'}
                  </span>
                  {c.unread > 0 && (
                    <span style={{ flexShrink: 0, minWidth: '17px', height: '17px', padding: '0 5px', borderRadius: '999px', background: '#EF4444', color: 'white', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const Thread = active && currentUserId ? (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {isMobile && (
          <button onClick={() => setSelected(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}><ArrowLeft size={16} strokeWidth={1.75} /></button>
        )}
        <div style={{ minWidth: 0 }}>
          <a href={`/members/${active.other_party_id}`}
            style={{ fontSize: '14px', fontWeight: 600, color: '#60A5FA', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            {active.other_party_name}{active.other_party_verified && <VerifiedBadge size={13} />}
          </a>
          <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
            {active.contract_id ? `${active.project_title} · you're the ${active.viewer_role}` : 'Direct message'}
          </p>
        </div>
        {active.contract_id && (
          <a href={`/contracts/${active.contract_id}`}
            style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: '#60A5FA', textDecoration: 'none', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            Open contract <ArrowRight size={13} strokeWidth={1.75} />
          </a>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Keyed so switching threads remounts with fresh state instead of
            briefly showing the previous conversation's messages. */}
        <ContractChat key={active.conversation_id} conversationId={active.conversation_id} currentUserId={currentUserId} fill />
      </div>
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: '13.5px' }}>
      Pick a conversation to read it.
    </div>
  )

  return (
    // 100dvh rather than 100vh: this is a full-height chat, and on mobile the
    // difference is the message box sitting under the browser's own bar.
    <div style={{ display: 'flex', height: '100dvh', maxHeight: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{
        flex: 1, marginLeft: isMobile ? 0 : '224px', height: '100%',
        paddingTop: isMobile ? '52px' : 0, display: 'flex', minWidth: 0, minHeight: 0, overflow: 'hidden',
      }}>
        {isMobile ? (
          <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>{selected ? Thread : ConversationList}</div>
        ) : (
          <>
            <div style={{ width: '320px', flexShrink: 0, minHeight: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              {ConversationList}
            </div>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>{Thread}</div>
          </>
        )}
      </main>
    </div>
  )
}
