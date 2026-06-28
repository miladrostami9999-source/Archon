'use client'
import { useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'

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

export default function AddCompany() {
  const router = useRouter()
  const isMobile = useIsMobile()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', domain: '', website: '', email: '',
    country: '', city: '', industry: '', company_size: '',
    instagram: '', linkedin: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!form.name) { setError('Company name is required'); return }
    setLoading(true); setError('')
    try {
      await axios.post(`${API}/companies/`, form)
      router.push('/')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', display: 'flex', flexDirection: 'column', paddingTop: isMobile ? '52px' : 0 }}>

        {/* HEADER */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: '16px',
          padding: isMobile ? '0 16px' : '0 24px', height: '56px',
          background: 'var(--bg-main)', borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)', transition: 'background 0.25s, border-color 0.25s',
        }}>
          <button onClick={() => router.push('/')}
            style={{ fontSize: '14px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
            ← Back
          </button>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Add Company</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>Archon · by Armila Design</p>
          </div>
        </div>

        {/* FORM */}
        <div style={{ flex: 1, padding: isMobile ? '16px' : '32px 24px', display: 'flex', justifyContent: 'center' }}>
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
                placeholder="e.g. BIG - Bjarke Ingels Group"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
            </div>

            {/* Domain + Website */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Domain</label>
                <input name="domain" value={form.domain} onChange={handleChange} placeholder="e.g. big.dk"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
              <div>
                <label style={labelStyle}>Website</label>
                <input name="website" value={form.website} onChange={handleChange} placeholder="https://big.dk"
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
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Country</label>
                <input name="country" value={form.country} onChange={handleChange} placeholder="e.g. Denmark"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input name="city" value={form.city} onChange={handleChange} placeholder="e.g. Copenhagen"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
            </div>

            {/* Industry + Size */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Industry</label>
                <select name="industry" value={form.industry} onChange={handleChange}
                  style={inputStyle}>
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
                <select name="company_size" value={form.company_size} onChange={handleChange}
                  style={inputStyle}>
                  <option value="">Select size</option>
                  <option value="solo">Solo (1)</option>
                  <option value="small">Small (2–20)</option>
                  <option value="medium">Medium (21–100)</option>
                  <option value="large">Large (100+)</option>
                </select>
              </div>
            </div>

            {/* LinkedIn + Instagram */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>LinkedIn</label>
                <input name="linkedin" value={form.linkedin} onChange={handleChange} placeholder="linkedin.com/company/..."
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
              <div>
                <label style={labelStyle}>Instagram</label>
                <input name="instagram" value={form.instagram} onChange={handleChange} placeholder="instagram.com/..."
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
              </div>
            </div>

            {/* BUTTONS */}
            <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
              <button onClick={() => router.push('/')}
                style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '14px', borderRadius: '8px', background: 'var(--bg-input)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={loading}
                style={{ flex: 1, padding: '10px', fontSize: '14px', fontWeight: 500, color: 'white', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                {loading ? 'Saving...' : 'Add Company'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
