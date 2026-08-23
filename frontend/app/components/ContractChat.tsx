'use client'
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const POLL_MS = 5000

interface ChatMessage {
  id: number
  contract_id: number
  sender_id: number
  sender_name: string | null
  body: string | null
  attachment_url: string | null
  created_at: string
}

/**
 * Chat between the two parties on a contract. Polling rather than
 * websockets — simpler to run correctly, and a 5s delay is fine for a
 * negotiation/status thread that isn't the primary interaction surface.
 *
 * `fill` switches from the boxed card used on the contract page (where the
 * thread is one section among several in a scrolling column, so it needs a
 * ceiling) to filling whatever height it's given — which is what the
 * Messages page wants, since there the thread *is* the page.
 */
export default function ContractChat({ contractId, currentUserId, fill = false }: {
  contractId: number
  currentUserId: number
  fill?: boolean
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const firstLoad = useRef(true)

  const load = () => {
    axios.get(`${API}/marketplace/contracts/${contractId}/messages`)
      .then(r => {
        setMessages(r.data)
        if (firstLoad.current) {
          firstLoad.current = false
          setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'nearest' }), 0)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId])

  const uploadAttachment = async (file: File) => {
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await axios.post(`${API}/auth/upload/receipt`, fd)
      setAttachment({ url: r.data.url, name: file.name })
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Upload failed')
    }
    setUploading(false)
  }

  const send = async () => {
    if (!text.trim() && !attachment) return
    setSending(true); setError('')
    try {
      const r = await axios.post(`${API}/marketplace/contracts/${contractId}/messages`, {
        body: text.trim() || null,
        attachment_url: attachment?.url || null,
      })
      setMessages(m => [...m, r.data])
      setText(''); setAttachment(null)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Could not send message')
    }
    setSending(false)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', background: 'var(--bg-card)',
      ...(fill
        // Fills the pane it's given; the page around it already supplies the
        // frame and the "who am I talking to" header.
        ? { height: '100%', minHeight: 0 }
        : { borderRadius: '14px', border: '1px solid var(--border)', maxHeight: '480px' }),
    }}>
      {!fill && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Messages</p>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: fill ? 0 : '160px' }}>
        {messages.length === 0 ? (
          <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', textAlign: 'center', margin: 'auto 0' }}>No messages yet. Say hello.</p>
        ) : messages.map(m => {
          const mine = m.sender_id === currentUserId
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginBottom: '2px' }}>{mine ? 'You' : m.sender_name || 'Them'}</span>
              <div style={{
                maxWidth: '78%', borderRadius: '12px', padding: '8px 12px', fontSize: '13px', lineHeight: 1.5,
                background: mine ? 'linear-gradient(135deg,#4F7BF7,#7C3AED)' : 'var(--bg-input)',
                color: mine ? 'white' : 'var(--text)',
                borderBottomRightRadius: mine ? '3px' : '12px',
                borderBottomLeftRadius: mine ? '12px' : '3px',
              }}>
                {m.body && <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>}
                {m.attachment_url && (
                  <a href={m.attachment_url} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-block', marginTop: m.body ? '6px' : 0, fontSize: '12px', color: mine ? 'white' : '#60A5FA', textDecoration: 'underline' }}>
                    📎 Attachment
                  </a>
                )}
              </div>
              <span style={{ fontSize: '9.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                {new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {error && <p style={{ fontSize: '11.5px', color: '#F87171', margin: '0 0 6px' }}>{error}</p>}
        {attachment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#34D399' }}>📎 {attachment.name}</span>
            <button onClick={() => setAttachment(null)} style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <label style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}>
            📎
            <input type="file" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); e.target.value = '' }} />
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={uploading ? 'Uploading attachment…' : 'Type a message…'}
            rows={1}
            style={{
              flex: 1, resize: 'none', boxSizing: 'border-box', background: 'var(--bg-input)',
              border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px',
              fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button onClick={send} disabled={sending || uploading || (!text.trim() && !attachment)}
            style={{
              flexShrink: 0, padding: '9px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600,
              color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none',
              cursor: 'pointer', opacity: (sending || uploading || (!text.trim() && !attachment)) ? 0.5 : 1,
            }}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
