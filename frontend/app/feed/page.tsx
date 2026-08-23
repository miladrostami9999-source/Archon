'use client'
import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import MarketplaceBeta, { BetaTag } from '../components/MarketplaceBeta'
import VerifiedBadge from '../components/VerifiedBadge'
import { useIsMobile } from '../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

const readAsDataURL = (file: File) => new Promise<string>((resolve) => {
  const reader = new FileReader()
  reader.onload = ev => resolve(ev.target?.result as string)
  reader.readAsDataURL(file)
})

const uploadImage = async (file: File): Promise<string> => {
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await axios.post(`${API}/auth/upload`, form, { headers: headers() })
    return res.data.url as string
  } catch {
    return readAsDataURL(file)
  }
}

interface Post {
  id: number
  user_id: number
  author_name: string | null
  author_avatar: string | null
  author_verified: boolean
  text: string
  image_url: string | null
  created_at: string
  updated_at: string
  is_owner: boolean
  like_count: number
  comment_count: number
  liked_by_me: boolean
}

interface Comment {
  id: number
  post_id: number
  user_id: number
  author_name: string | null
  author_verified: boolean
  text: string
  created_at: string
}

export default function FeedPage() {
  const isMobile = useIsMobile()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postMsg, setPostMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  const [openComments, setOpenComments] = useState<Record<number, Comment[]>>({})
  const [commentDraft, setCommentDraft] = useState<Record<number, string>>({})

  const loadPage = (offset: number, replace: boolean) => {
    const setBusy = replace ? setLoading : setLoadingMore
    setBusy(true)
    axios.get(`${API}/marketplace/feed/posts`, { headers: headers(), params: { limit: 20, offset } })
      .then(r => {
        setPosts(prev => replace ? r.data.items : [...prev, ...r.data.items])
        setNextOffset(r.data.has_more ? r.data.next_offset : null)
      })
      .catch((e) => { if ([401, 403].includes(e.response?.status)) window.location.href = '/dashboard' })
      .finally(() => setBusy(false))
  }

  useEffect(() => { loadPage(0, true) }, [])

  const handleFile = async (file: File) => {
    setUploading(true)
    try { setImageUrl(await uploadImage(file)) } finally { setUploading(false) }
  }

  const submitPost = async () => {
    if (!text.trim()) { setPostMsg('✗ Write something first'); return }
    setPosting(true); setPostMsg('')
    try {
      const res = await axios.post(`${API}/marketplace/feed/posts`, { text: text.trim(), image_url: imageUrl }, { headers: headers() })
      setPosts(prev => [res.data, ...prev])
      setText(''); setImageUrl(null)
    } catch (e: any) {
      setPostMsg(`✗ ${e.response?.data?.detail || 'Could not post'}`)
    }
    setPosting(false)
  }

  const startEdit = (p: Post) => { setEditingId(p.id); setEditText(p.text) }

  const saveEdit = async (id: number) => {
    if (!editText.trim()) return
    try {
      const res = await axios.patch(`${API}/marketplace/feed/posts/${id}`, { text: editText.trim() }, { headers: headers() })
      setPosts(prev => prev.map(p => p.id === id ? { ...p, ...res.data } : p))
      setEditingId(null)
    } catch {}
  }

  const deletePost = async (id: number) => {
    if (!window.confirm('Delete this post?')) return
    try {
      await axios.delete(`${API}/marketplace/feed/posts/${id}`, { headers: headers() })
      setPosts(prev => prev.filter(p => p.id !== id))
    } catch {}
  }

  const reportPost = async (id: number) => {
    const reason = window.prompt('What\'s wrong with this post? (optional)') || undefined
    try {
      await axios.post(`${API}/marketplace/feed/posts/${id}/report`, { reason }, { headers: headers() })
      alert('Reported — an admin will review it.')
    } catch {}
  }

  const toggleLike = async (p: Post) => {
    try {
      const method = p.liked_by_me ? 'delete' : 'post'
      const res = await axios.request({ method, url: `${API}/marketplace/feed/posts/${p.id}/like`, headers: headers() })
      setPosts(prev => prev.map(x => x.id === p.id ? { ...x, ...res.data } : x))
    } catch {}
  }

  const toggleComments = async (postId: number) => {
    if (openComments[postId]) {
      setOpenComments(prev => { const n = { ...prev }; delete n[postId]; return n })
      return
    }
    try {
      const res = await axios.get(`${API}/marketplace/feed/posts/${postId}/comments`, { headers: headers() })
      setOpenComments(prev => ({ ...prev, [postId]: res.data }))
    } catch {}
  }

  const submitComment = async (postId: number) => {
    const text = (commentDraft[postId] || '').trim()
    if (!text) return
    try {
      const res = await axios.post(`${API}/marketplace/feed/posts/${postId}/comments`, { text }, { headers: headers() })
      setOpenComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), res.data] }))
      setCommentDraft(prev => ({ ...prev, [postId]: '' }))
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p))
    } catch {}
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px',
    fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', height: '100vh', overflowY: 'auto', padding: isMobile ? '72px 16px 32px' : '32px 40px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Feed</h1>
            <BetaTag />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px' }}>
            Share work, wins, and updates with everyone on the marketplace.
          </p>

          <MarketplaceBeta />

          {/* Composer */}
          <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px', marginBottom: '20px' }}>
            <textarea rows={3} value={text} onChange={e => setText(e.target.value)}
              placeholder="Share something with the community…" style={{ ...input, resize: 'vertical', marginBottom: '10px' }} />
            {imageUrl && (
              <div style={{ position: 'relative', marginBottom: '10px', display: 'inline-block' }}>
                <img src={imageUrl} alt="" style={{ maxHeight: '160px', borderRadius: '10px', display: 'block' }} />
                <button onClick={() => setImageUrl(null)}
                  style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: 'white', cursor: 'pointer', fontSize: '12px' }}>✕</button>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: '#60A5FA', background: 'rgba(79,123,247,0.1)', border: '1px solid rgba(79,123,247,0.25)', cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
                {uploading ? 'Uploading…' : '📷 Add image'}
              </button>
              <button onClick={submitPost} disabled={posting || !text.trim()}
                style={{ marginLeft: 'auto', padding: '9px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer', opacity: (posting || !text.trim()) ? 0.5 : 1 }}>
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
            {postMsg && <p style={{ fontSize: '12.5px', color: '#F87171', margin: '10px 0 0' }}>{postMsg}</p>}
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
          ) : posts.length === 0 ? (
            <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
              No posts yet — be the first to share something.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '24px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <a href={`/members/${p.user_id}`} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
                      <span style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)' }}>
                        {p.author_avatar
                          ? <img src={p.author_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '12px', fontWeight: 800, color: 'white' }}>{(p.author_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>}
                      </span>
                      {p.author_name || 'Someone'}
                      {p.author_verified && <VerifiedBadge />}
                    </a>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                      {p.is_owner ? (
                        <>
                          <button onClick={() => startEdit(p)} style={{ fontSize: '11px', color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                          <button onClick={() => deletePost(p.id)} style={{ fontSize: '11px', color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
                        </>
                      ) : (
                        <button onClick={() => reportPost(p.id)} style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Report</button>
                      )}
                    </div>
                  </div>

                  {editingId === p.id ? (
                    <div style={{ marginBottom: '10px' }}>
                      <textarea rows={3} value={editText} onChange={e => setEditText(e.target.value)} style={{ ...input, resize: 'vertical', marginBottom: '8px' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => saveEdit(p.id)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer' }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '13.5px', color: 'var(--text)', margin: '0 0 10px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{p.text}</p>
                  )}

                  {p.image_url && (
                    <img src={p.image_url} alt="" style={{ maxWidth: '100%', borderRadius: '10px', marginBottom: '10px', display: 'block' }} />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => toggleLike(p)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', fontWeight: 600, color: p.liked_by_me ? '#F472B6' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {p.liked_by_me ? '♥' : '♡'} {p.like_count > 0 ? p.like_count : ''} Like
                    </button>
                    <button onClick={() => toggleComments(p.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      💬 {p.comment_count > 0 ? p.comment_count : ''} Comment
                    </button>
                  </div>

                  {openComments[p.id] && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {openComments[p.id].map(c => (
                        <div key={c.id} style={{ fontSize: '12.5px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>{c.author_name || 'Someone'}{c.author_verified && <VerifiedBadge size={11} />}</span>{' '}
                          <span style={{ color: 'var(--text-muted)' }}>{c.text}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <input value={commentDraft[p.id] || ''} onChange={e => setCommentDraft(prev => ({ ...prev, [p.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') submitComment(p.id) }}
                          placeholder="Write a comment…" style={{ ...input, flex: 1 }} />
                        <button onClick={() => submitComment(p.id)}
                          style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#60A5FA', background: 'rgba(79,123,247,0.1)', border: '1px solid rgba(79,123,247,0.25)', cursor: 'pointer' }}>
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {nextOffset !== null && (
                <button onClick={() => loadPage(nextOffset, false)} disabled={loadingMore}
                  style={{ padding: '10px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', opacity: loadingMore ? 0.6 : 1 }}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
