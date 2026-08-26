'use client'
import { useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRequireFreelancerMode } from '../hooks/useRequireMode'
import { ArrowLeft, Download, FileText, CheckCircle2, SkipForward, XCircle, Upload, Loader2, Lightbulb } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ImportPage() {
  useRequireFreelancerMode()
  const isMobile = useIsMobile()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await axios.post(`${API}/companies/import/csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(res.data)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Import failed')
    }
    setLoading(false)
  }

  const downloadTemplate = () => {
    const csv = `name,domain,website,email,country,city,industry,company_size,linkedin,instagram,tags
BIG - Bjarke Ingels Group,big.dk,https://big.dk,info@big.dk,Denmark,Copenhagen,Architecture,large,https://linkedin.com/company/big,,
MIR Visualization,mir.no,https://mir.no,post@mir.no,Norway,Bergen,CGI,small,,,`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'archon_import_template.csv'
    a.click()
  }

  const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', paddingTop: isMobile ? '52px' : 0 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: isMobile ? '14px 16px' : '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => window.location.href = '/dashboard'}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '13px' }}>
            <ArrowLeft size={15} strokeWidth={1.75} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Import Companies</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>Archon · by Armila Design</p>
          </div>
        </div>

        <div style={{ maxWidth: '640px', margin: '0 auto', padding: isMobile ? '20px 16px' : '28px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* TEMPLATE DOWNLOAD */}
          <div style={{ ...card, background: 'var(--accent-dim)', border: '1px solid var(--accent)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', margin: 0 }}>CSV Template</p>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>دانلود فایل نمونه برای پر کردن</p>
            </div>
            <button onClick={downloadTemplate}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
              <Download size={13} strokeWidth={1.75} /> Download Template
            </button>
          </div>

          {/* UPLOAD */}
          <div style={{ ...card, padding: '20px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '0 0 14px' }}>فایل CSV را انتخاب کن</p>

            <div
              onClick={() => document.getElementById('csv-input')?.click()}
              style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: 'var(--text-dim)' }}><FileText size={30} strokeWidth={1.5} /></div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                {file ? file.name : 'Click to select CSV file'}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }}>فقط فایل .csv</p>
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>

            {error && (
              <div style={{ marginTop: '12px', background: 'rgba(228,114,111,0.1)', border: '1px solid rgba(228,114,111,0.25)', color: 'var(--error)', fontSize: '13px', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
                {error}
              </div>
            )}

            {result && (
              <div style={{ marginTop: '12px', background: 'rgba(63,185,131,0.1)', border: '1px solid rgba(63,185,131,0.25)', borderRadius: 'var(--radius-lg)', padding: '14px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)', margin: '0 0 8px' }}>{result.message}</p>
                <div style={{ display: 'flex', gap: '14px', fontSize: '11.5px', color: 'var(--success)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} strokeWidth={1.75} /> Added: {result.added}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}><SkipForward size={12} strokeWidth={1.75} /> Skipped: {result.skipped}</span>
                  {result.errors?.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--error)' }}><XCircle size={12} strokeWidth={1.75} /> Errors: {result.errors.length}</span>}
                </div>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || loading}
              style={{ width: '100%', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', color: 'white', padding: '11px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, border: 'none', cursor: (!file || loading) ? 'not-allowed' : 'pointer', opacity: (!file || loading) ? 0.5 : 1 }}
            >
              {loading ? <><Loader2 size={14} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> Importing...</> : <><Upload size={14} strokeWidth={1.75} /> Import</>}
            </button>
          </div>

          {/* INSTRUCTIONS */}
          <div style={{ ...card, padding: '18px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '0 0 10px' }}>راهنما</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0 }}>۱. فایل template را دانلود کن</p>
              <p style={{ margin: 0 }}>۲. اطلاعات شرکت‌ها را در Excel یا Google Sheets پر کن</p>
              <p style={{ margin: 0 }}>۳. به فرمت CSV ذخیره کن</p>
              <p style={{ margin: 0 }}>۴. فایل را اینجا upload کن</p>
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent)' }}><Lightbulb size={12} strokeWidth={1.75} /> ستون <strong>name</strong> اجباری است — بقیه اختیاری</p>
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent)' }}><Lightbulb size={12} strokeWidth={1.75} /> شرکت‌های تکراری (بر اساس domain) skip می‌شوند</p>
            </div>
          </div>

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
