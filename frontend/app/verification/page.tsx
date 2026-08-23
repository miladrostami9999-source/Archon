'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { BetaTag } from '../components/MarketplaceBeta'
import { useIsMobile } from '../hooks/useIsMobile'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Verification {
  status: 'unverified' | 'pending' | 'verified' | 'rejected'
  legal_name: string; national_id: string; phone: string
  address: string; city: string; country: string; postal_code: string
  id_document_url: string
  bank_name: string; account_holder: string; card_number: string; iban: string
  admin_note: string
  missing_fields: string[]
  is_complete: boolean
}

const STATUS_META: Record<string, { color: string; bg: string; label: string; blurb: string }> = {
  unverified: { color: 'var(--text-muted)', bg: 'var(--bg-input)', label: 'Not verified',
                blurb: 'Fill these in and submit them — we check them once, then payouts can go out without further back-and-forth.' },
  pending:    { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', label: 'In review',
                blurb: "We're checking your details. You'll get a notification either way." },
  verified:   { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Verified',
                blurb: "You're all set — payouts can be sent to the account below." },
  rejected:   { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Needs a change',
                blurb: 'Something needs correcting before we can verify you.' },
}

export default function VerificationPage() {
  const isMobile = useIsMobile()
  const [v, setV] = useState<Verification | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    axios.get(`${API}/marketplace/verification/me`)
      .then(r => setV(r.data))
      .catch(() => { window.location.href = '/dashboard' })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const set = (field: keyof Verification, value: string) =>
    setV(prev => (prev ? { ...prev, [field]: value } : prev))

  const save = async () => {
    if (!v) return
    setSaving(true); setMsg('')
    try {
      const r = await axios.put(`${API}/marketplace/verification/me`, {
        legal_name: v.legal_name, national_id: v.national_id, phone: v.phone,
        address: v.address, city: v.city, country: v.country, postal_code: v.postal_code,
        id_document_url: v.id_document_url, bank_name: v.bank_name,
        account_holder: v.account_holder, card_number: v.card_number, iban: v.iban,
      })
      setV(r.data)
      setMsg('✓ Saved')
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not save'}`) }
    setSaving(false)
  }

  const submit = async () => {
    setSaving(true); setMsg('')
    try {
      await axios.put(`${API}/marketplace/verification/me`, v)
      const r = await axios.post(`${API}/marketplace/verification/me/submit`)
      setMsg(`✓ ${r.data.message}`)
      load()
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Could not submit'}`) }
    setSaving(false)
  }

  const uploadDoc = async (file: File) => {
    setUploading(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await axios.post(`${API}/auth/upload/receipt`, fd)
      set('id_document_url', r.data.url)
    } catch (e: any) { setMsg(`✗ ${e.response?.data?.detail || 'Upload failed'}`) }
    setUploading(false)
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px',
    fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  }
  const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }
  const locked = v?.status === 'pending'

  const Field = ({ name, field, placeholder, wide = false }: {
    name: string; field: keyof Verification; placeholder?: string; wide?: boolean
  }) => (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <label style={label}>{name}</label>
      <input value={(v?.[field] as string) || ''} disabled={locked}
        onChange={e => set(field, e.target.value)} placeholder={placeholder}
        style={{ ...input, opacity: locked ? 0.6 : 1 }} />
    </div>
  )

  const sm = v ? STATUS_META[v.status] : null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', height: '100vh', overflowY: 'auto', padding: isMobile ? '72px 16px 32px' : '32px 40px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Identity &amp; payout details</h1>
            <BetaTag />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.6 }}>
            Money leaves Archon by hand, so a payout needs a real name, a real account, and a way to reach you if a
            transfer bounces. Only you and an admin can ever see this — none of it appears on your public profile.
          </p>

          {loading || !v || !sm ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
          ) : (
            <>
              <div style={{ borderRadius: '12px', border: `1px solid ${sm.color}33`, background: sm.bg, padding: '13px 15px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: sm.color }}>{sm.label}</span>
                  {!v.is_complete && v.status !== 'pending' && (
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      · {v.missing_fields.length} field{v.missing_fields.length === 1 ? '' : 's'} left
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>{sm.blurb}</p>
                {v.admin_note && (
                  <p style={{ fontSize: '12px', color: '#F87171', margin: '6px 0 0' }}>“{v.admin_note}”</p>
                )}
              </div>

              {msg && <p style={{ fontSize: '12.5px', color: msg.startsWith('✓') ? '#34D399' : '#F87171', marginBottom: '14px' }}>{msg}</p>}

              <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: '14px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '14px' }}>Who you are</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                  <Field name="Legal name" field="legal_name" placeholder="As written on your ID" />
                  <Field name="National ID (کد ملی)" field="national_id" placeholder="0012345678" />
                  <Field name="Phone" field="phone" placeholder="+98…" />
                  <Field name="City" field="city" />
                  <Field name="Country" field="country" />
                  <Field name="Postal code" field="postal_code" />
                  <Field name="Address" field="address" wide />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={label}>ID document <span style={{ color: 'var(--text-dim)' }}>(optional — speeds up review)</span></label>
                    {v.id_document_url ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <a href={v.id_document_url} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: '#34D399', textDecoration: 'none' }}>📎 Uploaded</a>
                        {!locked && <button onClick={() => set('id_document_url', '')} style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>}
                      </div>
                    ) : (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px dashed var(--border)', cursor: locked ? 'not-allowed' : 'pointer', fontSize: '12px', color: 'var(--text-muted)', opacity: locked ? 0.6 : 1 }}>
                        📎 {uploading ? 'Uploading…' : 'Attach a photo or scan'}
                        <input type="file" accept="image/*,application/pdf" disabled={locked} style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = '' }} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '4px' }}>Where to pay you</p>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 14px' }}>
                  The account must be in your own name — we can&apos;t send a payout to a third party.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                  <Field name="Bank" field="bank_name" placeholder="e.g. Mellat" />
                  <Field name="Account holder" field="account_holder" />
                  <Field name="Card number (شماره کارت)" field="card_number" placeholder="6104…" />
                  <Field name="IBAN / Sheba (شماره شبا)" field="iban" placeholder="IR…" />
                </div>
              </div>

              {!locked && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingBottom: '32px' }}>
                  <button onClick={save} disabled={saving}
                    style={{ padding: '9px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    {saving ? 'Saving…' : 'Save draft'}
                  </button>
                  <button onClick={submit} disabled={saving || v.status === 'verified'}
                    style={{ padding: '9px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#4F7BF7,#7C3AED)', border: 'none', cursor: 'pointer', opacity: (saving || v.status === 'verified') ? 0.5 : 1 }}>
                    {v.status === 'verified' ? 'Verified' : 'Submit for review'}
                  </button>
                  {v.status === 'verified' && (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>Editing these details sends them back for review.</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
