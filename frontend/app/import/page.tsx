'use client'
import { useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ImportPage() {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => window.location.href = '/'} className="text-gray-400 hover:text-gray-600 transition">
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Import Companies</h1>
          <p className="text-xs text-gray-400">Archon · by Armila Design</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">

        {/* Template Download */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-800">CSV Template</p>
            <p className="text-xs text-blue-600 mt-0.5">دانلود فایل نمونه برای پر کردن</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            📥 Download Template
          </button>
        </div>

        {/* Upload */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-700 mb-4">فایل CSV را انتخاب کن</p>

          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 transition cursor-pointer"
            onClick={() => document.getElementById('csv-input')?.click()}
          >
            <p className="text-3xl mb-2">📄</p>
            <p className="text-sm text-gray-500">
              {file ? file.name : 'Click to select CSV file'}
            </p>
            <p className="text-xs text-gray-400 mt-1">فقط فایل .csv</p>
            <input
              id="csv-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-medium text-green-800 mb-2">{result.message}</p>
              <div className="flex gap-4 text-xs text-green-700">
                <span>✅ Added: {result.added}</span>
                <span>⏭ Skipped: {result.skipped}</span>
                {result.errors?.length > 0 && <span>❌ Errors: {result.errors.length}</span>}
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? '⏳ Importing...' : '📤 Import'}
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">راهنما</p>
          <div className="space-y-2 text-xs text-gray-500">
            <p>۱. فایل template را دانلود کن</p>
            <p>۲. اطلاعات شرکت‌ها را در Excel یا Google Sheets پر کن</p>
            <p>۳. به فرمت CSV ذخیره کن</p>
            <p>۴. فایل را اینجا upload کن</p>
            <p className="text-blue-500">💡 ستون <strong>name</strong> اجباری است — بقیه اختیاری</p>
            <p className="text-blue-500">💡 شرکت‌های تکراری (بر اساس domain) skip می‌شوند</p>
          </div>
        </div>

      </div>
    </div>
  )
}