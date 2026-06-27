'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import axios from 'axios'
import Sidebar from '../components/Sidebar'

const API = 'http://localhost:8000'

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: '8px', padding: '9px 12px',
  fontSize: '14px', color: 'var(--text)', outline: 'none',
  transition: 'border-color 0.15s',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 500,
  color: 'var(--text-muted)', marginBottom: '6px',
}

function EditForm() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('id')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', domain: '', website: '', email: '',
    country: '', city: '', industry: '', company_size: '',
    instagram: '', linkedin: '', tags: '',
    heat_level: 'cold', opportunity_score: 0,
  })

  useEffect(() => {
    if (!companyId) { window.location.href = '/'; return }
    axios.get(`${API}/companies/${companyId}`)
      .then(res => {
        const c = res.data
        setForm({
          name: c.name || '', domain: c.domain || '', website: c.website || '',
          email: c.email || '', country: c.country || '', city: c.city || '',
          industry: c.industry || '', company_size: c.company_size || '',
          instagram: c.instagram || '', linkedin: c.linkedin || '',
          tags: c.tags || '', heat_level: c.heat_level || 'cold',
          opportunity_score: c.opportunity_score || 0,
        })
        setLoading(false)
      })
      .catch(() => window.location.href = '/')
  }, [companyId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!form.name) { setError('Company name is required'); return }
    setSaving(true); setError('')
    try {
      await axios.patch(`${API}/companies/${companyId}`, form)
      window.location.href = `/company/${companyId}`
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Something went wrong')
    }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '224px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid rgba(79,123,247,0.3)', borderTop: '2px solid #4F7BF7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      <div style={{ flex: 1, marginLeft: '224px', display: 'flex', flexDirection: 'column' }}>

        {/* HEADER */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: '16px',
          padding: '0 24px', height: '56px',
          background: 'var(--bg-main)', borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)', transition: 'background 0.25s, border-color 0.25s',
        }}>
          <button onClick={() => window.location.href = `/company/${companyId}`}
            style={{ fontSize: '14px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
            ← Back
          </button>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Edit Company</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>Archon · by Armila Design</p>
          </div>
        </div>

        {/* FORM */}
        <div style={{ flex: 1, padding: '32px 24px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '640px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '14px', padding: '12px 16px', borderRadius: '8px' }}>
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label style={labelStyle}>Company Name <span style={{ color: '#F87171' }}>*</span></label>
              <input name="name" value={form.name} onChange={handleChange}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
            </div>

            {/* Domain + Website */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Domain</label>
                <input name="domain" value={form.domain} onChange={handleChange} placeholder="e.g. big.dk"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
              <div>
                <label style={labelStyle}>Website</label>
                <input name="website" value={form.website} onChange={handleChange} placeholder="https://..."
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email</label>
              <input name="email" value={form.email} onChange={handleChange} placeholder="info@studio.com"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
            </div>

            {/* Country + City */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Country</label>
                <input name="country" value={form.country} onChange={handleChange}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input name="city" value={form.city} onChange={handleChange}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
            </div>

            {/* Industry + Size */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Industry</label>
                <select name="industry" value={form.industry} onChange={handleChange} style={inputStyle}>
                  <option value="">Select industry</option>
                  <option>Architecture</option>
                  <option>CGI</option>
                  <option>Visualization</option>
                  <option>Interior Design</option>
                  <option>Real Estate</option>
                  <option>Animation</option>
                  <option>Render Farm</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Company Size</label>
                <select name="company_size" value={form.company_size} onChange={handleChange} style={inputStyle}>
                  <option value="">Select size</option>
                  <option value="solo">Solo (1)</option>
                  <option value="small">Small (2–20)</option>
                  <option value="medium">Medium (21–100)</option>
                  <option value="large">Large (100+)</option>
                </select>
              </div>
            </div>

            {/* LinkedIn + Instagram */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>LinkedIn</label>
                <input name="linkedin" value={form.linkedin} onChange={handleChange}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
              <div>
                <label style={labelStyle}>Instagram</label>
                <input name="instagram" value={form.instagram} onChange={handleChange}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tags</label>
              <input name="tags" value={form.tags} onChange={handleChange}
                placeholder="luxury, hospitality, outsources"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }}>جدا شده با کاما — مثال: luxury, hospitality</p>
            </div>

            {/* Heat + Score */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Heat Level</label>
                <select name="heat_level" value={form.heat_level} onChange={handleChange} style={inputStyle}>
                  <option value="hot">🔥 Hot</option>
                  <option value="warm">🌤 Warm</option>
                  <option value="cold">❄️ Cold</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Opportunity Score (0–100)</label>
                <input name="opportunity_score" type="number" min="0" max="100"
                  value={form.opportunity_score} onChange={handleChange}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
            </div>

            {/* BUTTONS */}
            <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
              <button onClick={() => window.location.href = `/company/${companyId}`}
                style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '14px', borderRadius: '8px', background: 'var(--bg-input)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={saving}
                style={{ flex: 1, padding: '10px', fontSize: '14px', fontWeight: 500, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: saving ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default function EditCompany() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
        Loading...
      </div>
    }>
      <EditForm />
    </Suspense>
  )
}
