'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import axios from 'axios'
import { Suspense } from 'react'

const API = 'http://localhost:8000'

interface Company {
  id: number
  name: string
  domain: string
  website: string
  email: string
  country: string
  city: string
  industry: string
  company_size: string
  instagram: string
  linkedin: string
  tags: string
  heat_level: string
  opportunity_score: number
  status: string
}

function EditForm() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('id')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    domain: '',
    website: '',
    email: '',
    country: '',
    city: '',
    industry: '',
    company_size: '',
    instagram: '',
    linkedin: '',
    tags: '',
    heat_level: 'cold',
    opportunity_score: 0,
  })

  useEffect(() => {
    if (!companyId) { window.location.href = '/'; return }
    axios.get(`${API}/companies/${companyId}`)
      .then(res => {
        const c = res.data
        setForm({
          name: c.name || '',
          domain: c.domain || '',
          website: c.website || '',
          email: c.email || '',
          country: c.country || '',
          city: c.city || '',
          industry: c.industry || '',
          company_size: c.company_size || '',
          instagram: c.instagram || '',
          linkedin: c.linkedin || '',
          tags: c.tags || '',
          heat_level: c.heat_level || 'cold',
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
    setSaving(true)
    setError('')
    try {
      await axios.patch(`${API}/companies/${companyId}`, form)
      window.location.href = `/company/${companyId}`
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Something went wrong')
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => window.location.href = `/company/${companyId}`} className="text-gray-400 hover:text-gray-600 transition">
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Edit Company</h1>
          <p className="text-xs text-gray-400">Archon · by Armila Design</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name <span className="text-red-500">*</span></label>
            <input name="name" value={form.name} onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
              <input name="domain" value={form.domain} onChange={handleChange} placeholder="e.g. big.dk"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input name="website" value={form.website} onChange={handleChange} placeholder="https://..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" value={form.email} onChange={handleChange} placeholder="info@studio.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input name="country" value={form.country} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input name="city" value={form.city} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <select name="industry" value={form.industry} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Size</label>
              <select name="company_size" value={form.company_size} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select size</option>
                <option value="solo">Solo (1)</option>
                <option value="small">Small (2–20)</option>
                <option value="medium">Medium (21–100)</option>
                <option value="large">Large (100+)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
              <input name="linkedin" value={form.linkedin} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
              <input name="instagram" value={form.instagram} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input name="tags" value={form.tags} onChange={handleChange} placeholder="luxury, hospitality, outsources"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">جدا شده با کاما — مثال: luxury, hospitality</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heat Level</label>
              <select name="heat_level" value={form.heat_level} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="hot">🔥 Hot</option>
                <option value="warm">🌤 Warm</option>
                <option value="cold">❄️ Cold</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opportunity Score (0–100)</label>
              <input name="opportunity_score" type="number" min="0" max="100"
                value={form.opportunity_score} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button onClick={() => window.location.href = `/company/${companyId}`}
              className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-lg hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

export default function EditCompany() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>}>
      <EditForm />
    </Suspense>
  )
}