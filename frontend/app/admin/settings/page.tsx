'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../../components/Sidebar'
import AdminSideNav from '../../components/AdminSideNav'
import { useIsMobile } from '../../hooks/useIsMobile'
import AdminSettingsDrawer from '../../components/AdminSettingsDrawer'
import InlineStatus from '../../components/InlineStatus'
import { BarChart3, Globe2, Trash2, Megaphone, CreditCard, Flag } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('archon-token') || '' : ''
const headers = () => ({ Authorization: `Bearer ${getToken()}` })

interface PlanLimit {
  plan: string
  max_companies: number
  max_emails_per_month: number
  period_days: number
  price_usd: number
  price_irr: number
  allowed_countries: string
}

interface FeatureFlag { key: string; label: string; value: string }

type DrawerKey = 'planLimits' | 'countries' | 'bulkDelete' | 'broadcast' | 'payment' | 'flags' | null

export default function AdminSettingsPage() {
  const isMobile = useIsMobile()
  const [planLimits, setPlanLimits] = useState<PlanLimit[]>([])
  const [catalogCountries, setCatalogCountries] = useState<{ name: string; count: number }[]>([])
  const [savingPlan, setSavingPlan] = useState<string | null>(null)
  const [limitMsg, setLimitMsg] = useState('')
  const [instr, setInstr] = useState({
    instructions_en: '', instructions_fa: '',
    card_number: '', card_holder: '', paypal_email: '',
    support_email: '', support_phone: '', manual_rate: '',
  })
  const [rate, setRate] = useState<{ rate: number | null; source: string } | null>(null)
  const [savingInstr, setSavingInstr] = useState(false)
  const [openDrawer, setOpenDrawer] = useState<DrawerKey>(null)
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [savingFlag, setSavingFlag] = useState<string | null>(null)

  const [bulkFilters, setBulkFilters] = useState({ country: '', industry: '', company_size: '', discovery_source: '', search: '' })
  const [bulkPreview, setBulkPreview] = useState<number | null>(null)
  const [bulkChecking, setBulkChecking] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')

  const [merging, setMerging] = useState<string | null>(null)
  const [mergeMsg, setMergeMsg] = useState('')
  const [manualMergeFrom, setManualMergeFrom] = useState('')
  const [manualMergeTo, setManualMergeTo] = useState('')

  const [bcFilters, setBcFilters] = useState<{ plan: string; marketplace_beta: string; active_since_days: string }>({ plan: '', marketplace_beta: '', active_since_days: '' })
  const [bcTitle, setBcTitle] = useState('')
  const [bcBody, setBcBody] = useState('')
  const [bcLink, setBcLink] = useState('')
  const [bcAlsoEmail, setBcAlsoEmail] = useState(false)
  const [bcPreview, setBcPreview] = useState<number | null>(null)
  const [bcChecking, setBcChecking] = useState(false)
  const [bcSending, setBcSending] = useState(false)
  const [bcMsg, setBcMsg] = useState('')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('archon-user')
      if (stored && JSON.parse(stored).role !== 'admin') window.location.href = '/dashboard'
    } catch {}
  }, [])

  useEffect(() => {
    axios.get(`${API}/auth/settings/payment`, { headers: headers() }).then(r => setInstr(s => ({ ...s, ...r.data }))).catch(() => {})
    axios.get(`${API}/auth/billing/exchange-rate`, { headers: headers() }).then(r => setRate(r.data)).catch(() => {})
    axios.get(`${API}/auth/catalog/countries`, { headers: headers() }).then(res => setCatalogCountries(res.data)).catch(() => {})
    axios.get(`${API}/auth/plan-limits`, { headers: headers() }).then(res => {
      setPlanLimits(res.data.sort((a: PlanLimit, b: PlanLimit) =>
        ['trial', 'basic', 'pro', 'agency'].indexOf(a.plan) - ['trial', 'basic', 'pro', 'agency'].indexOf(b.plan)))
    }).catch(() => {})
    axios.get(`${API}/auth/admin/feature-flags`, { headers: headers() }).then(res => setFlags(res.data)).catch(() => {})
  }, [])

  const saveInstructions = async () => {
    setSavingInstr(true); setLimitMsg('')
    try {
      await axios.put(`${API}/auth/settings/payment`, instr, { headers: headers() })
      setLimitMsg('✓ Payment settings saved')
    } catch { setLimitMsg('✗ Could not save payment settings') }
    setSavingInstr(false)
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px',
    fontSize: '12.5px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
    resize: 'vertical',
  }

  const savePlanLimit = async (pl: PlanLimit) => {
    setLimitMsg(''); setSavingPlan(pl.plan)
    try {
      await axios.put(`${API}/auth/plan-limits/${pl.plan}`, {
        max_companies: pl.max_companies,
        max_emails_per_month: pl.max_emails_per_month,
        period_days: pl.period_days,
        price_usd: pl.price_usd,
        price_irr: pl.price_irr,
        allowed_countries: pl.allowed_countries || '',
      }, { headers: headers() })
      setLimitMsg(`✓ ${pl.plan} limits saved`)
    } catch (e: any) {
      setLimitMsg(`✗ ${e.response?.data?.detail || 'Save failed'}`)
    }
    setSavingPlan(null)
  }

  const setPl = (plan: string, field: keyof PlanLimit, value: number | string) => {
    setPlanLimits(prev => prev.map(p => p.plan === plan ? { ...p, [field]: value } : p))
  }

  const toggleCountry = (plan: string, country: string) => {
    setPlanLimits(prev => prev.map(p => {
      if (p.plan !== plan) return p
      const list = (p.allowed_countries || '').split(',').map(s => s.trim()).filter(Boolean)
      const next = list.includes(country) ? list.filter(c => c !== country) : [...list, country]
      return { ...p, allowed_countries: next.join(', ') }
    }))
  }

  const COUNTRY_ALIASES: Record<string, string> = {
    usa: 'United States', us: 'United States', 'u.s.a.': 'United States', 'u.s.': 'United States',
    'united states of america': 'United States', uae: 'United Arab Emirates', 'u.a.e.': 'United Arab Emirates',
  }
  const canonicalCountry = (name: string) => COUNTRY_ALIASES[name.trim().toLowerCase()] || name.trim()

  const duplicateCountryGroups = (() => {
    const groups: Record<string, { name: string; count: number }[]> = {}
    catalogCountries.forEach(c => {
      const key = canonicalCountry(c.name).toLowerCase()
      ;(groups[key] ||= []).push(c)
    })
    return Object.values(groups).filter(g => g.length > 1).map(g => {
      const sorted = [...g].sort((a, b) => {
        const aCanon = canonicalCountry(a.name) === a.name.trim() ? 1 : 0
        const bCanon = canonicalCountry(b.name) === b.name.trim() ? 1 : 0
        if (aCanon !== bCanon) return bCanon - aCanon
        return b.count - a.count
      })
      return { target: sorted[0], extras: sorted.slice(1) }
    })
  })()

  const mergeCountries = async (from: string, to: string) => {
    const key = `${from}->${to}`
    setMerging(key); setMergeMsg('')
    try {
      const res = await axios.post(`${API}/companies/countries/merge`, { from_name: from, to_name: to }, { headers: headers() })
      setMergeMsg(`✓ ${res.data.message}`)
      const refreshed = await axios.get(`${API}/auth/catalog/countries`, { headers: headers() })
      setCatalogCountries(refreshed.data)
    } catch (e: any) {
      setMergeMsg(`✗ ${e.response?.data?.detail || 'Merge failed'}`)
    }
    setMerging(null)
  }

  const bulkFilterParams = () => {
    const p: Record<string, string> = {}
    Object.entries(bulkFilters).forEach(([k, v]) => { if (v.trim()) p[k] = v.trim() })
    return p
  }

  const checkBulkPreview = async () => {
    setBulkChecking(true); setBulkMsg(''); setBulkPreview(null)
    try {
      const res = await axios.get(`${API}/companies/`, { headers: headers(), params: { ...bulkFilterParams(), limit: 1 } })
      setBulkPreview(res.data.total)
    } catch (e: any) {
      setBulkMsg(`✗ ${e.response?.data?.detail || 'Could not check'}`)
    }
    setBulkChecking(false)
  }

  const runBulkDelete = async () => {
    const params = bulkFilterParams()
    if (Object.keys(params).length === 0) {
      if (!window.confirm('No filters are set — this would delete the ENTIRE catalog. Are you absolutely sure?')) return
    } else if (!window.confirm(`Delete ${bulkPreview ?? 'the matching'} companies? This can't be undone.`)) {
      return
    }
    setBulkDeleting(true); setBulkMsg('')
    try {
      const res = await axios.post(`${API}/companies/bulk-delete`,
        { ...params, confirm_all: Object.keys(params).length === 0 },
        { headers: headers() })
      setBulkMsg(`✓ ${res.data.message}`)
      setBulkPreview(0)
    } catch (e: any) {
      setBulkMsg(`✗ ${e.response?.data?.detail || 'Delete failed'}`)
    }
    setBulkDeleting(false)
  }

  const bcParams = () => {
    const p: Record<string, any> = {}
    if (bcFilters.plan) p.plan = bcFilters.plan
    if (bcFilters.marketplace_beta) p.marketplace_beta = bcFilters.marketplace_beta === 'true'
    if (bcFilters.active_since_days) p.active_since_days = Number(bcFilters.active_since_days)
    return p
  }

  const checkBcPreview = async () => {
    setBcChecking(true); setBcMsg(''); setBcPreview(null)
    try {
      const res = await axios.get(`${API}/marketplace/admin/broadcast/preview`, { headers: headers(), params: bcParams() })
      setBcPreview(res.data.count)
    } catch (e: any) {
      setBcMsg(`✗ ${e.response?.data?.detail || 'Could not check'}`)
    }
    setBcChecking(false)
  }

  const sendBroadcast = async () => {
    if (!bcTitle.trim()) { setBcMsg('✗ Title is required'); return }
    if (!window.confirm(`Send this to ${bcPreview ?? 'the matching'} user(s)?`)) return
    setBcSending(true); setBcMsg('')
    try {
      const res = await axios.post(`${API}/marketplace/admin/broadcast`,
        { ...bcParams(), title: bcTitle, body: bcBody, link: bcLink, also_email: bcAlsoEmail },
        { headers: headers() })
      setBcMsg(`✓ Sent to ${res.data.sent} user(s)`)
      setBcPreview(0)
    } catch (e: any) {
      setBcMsg(`✗ ${e.response?.data?.detail || 'Send failed'}`)
    }
    setBcSending(false)
  }

  const saveFlag = async (key: string, value: string) => {
    setSavingFlag(key)
    try {
      await axios.put(`${API}/auth/admin/feature-flags/${key}`, { value }, { headers: headers() })
      setFlags(prev => prev.map(f => f.key === key ? { ...f, value } : f))
    } catch {}
    setSavingFlag(null)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', minWidth: 0, marginTop: isMobile ? '52px' : 0, height: isMobile ? 'calc(100vh - 52px)' : '100vh', overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px', padding: isMobile ? '0 16px' : '0 32px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Settings</h1>
        </div>

        <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>
          {!isMobile && <AdminSideNav active="/admin/settings" />}

          <main style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {([
                ['planLimits', BarChart3, 'Plan Limits', 'Per-plan quotas, pricing and country scope'],
                ['countries', Globe2, 'Duplicate Countries', 'Merge catalog country spellings'],
                ['bulkDelete', Trash2, 'Bulk Delete Companies', 'Remove many companies at once by filter'],
                ['broadcast', Megaphone, 'Broadcast & Notifications', 'Send an in-app or email announcement to a segment'],
                ['payment', CreditCard, 'Payment Instructions', 'What users see on the upgrade page'],
                ['flags', Flag, 'Feature Flags', 'Storage-only toggles — nothing reads these yet'],
              ] as [DrawerKey, any, string, string][]).map(([key, Icon, title, desc]) => (
                <button key={key} onClick={() => setOpenDrawer(key)}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer' }}>
                  <Icon size={17} strokeWidth={1.5} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{title}</p>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{desc}</p>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>Edit →</span>
                </button>
              ))}
            </div>

            <AdminSettingsDrawer title="Plan Limits" open={openDrawer === 'planLimits'} onClose={() => setOpenDrawer(null)}>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 16px', lineHeight: 1.6 }}>
                Edit quotas per plan. Changes apply immediately to everyone on that plan. Use <strong>-1</strong> for unlimited.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {planLimits.map(pl => (
                  <div key={pl.plan} style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{pl.plan}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {([
                        ['Max companies', 'max_companies'],
                        ['Emails per period', 'max_emails_per_month'],
                        ['Period (days)', 'period_days'],
                        ['Price (USD)', 'price_usd'],
                        ['Price (Toman, 0 = auto)', 'price_irr'],
                      ] as [string, keyof PlanLimit][]).map(([label, field]) => (
                        <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <label style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{label}</label>
                          <input type="number" value={pl[field] as number}
                            onChange={e => setPl(pl.plan, field, parseInt(e.target.value || '0', 10))}
                            style={{ width: '110px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', color: 'var(--text)', outline: 'none', textAlign: 'right' }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '2px' }}>Countries this plan can see</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {catalogCountries.map(c => {
                          const on = (pl.allowed_countries || '').split(',').map(s => s.trim()).includes(c.name)
                          return (
                            <button key={c.name} type="button" onClick={() => toggleCountry(pl.plan, c.name)}
                              style={{ fontSize: '11px', padding: '4px 9px', borderRadius: '999px', cursor: 'pointer', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-dim)' : 'var(--bg-input)', color: on ? 'var(--accent)' : 'var(--text-dim)' }}>
                              {c.name} <span style={{ opacity: 0.6 }}>{c.count}</span>
                            </button>
                          )
                        })}
                      </div>
                      <input value={pl.allowed_countries || ''} onChange={e => setPl(pl.plan, 'allowed_countries', e.target.value)} placeholder="Empty = every country" style={input} />
                    </div>
                    <button onClick={() => savePlanLimit(pl)} disabled={savingPlan === pl.plan}
                      style={{ marginTop: '14px', width: '100%', padding: '9px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: savingPlan === pl.plan ? 0.6 : 1 }}>
                      {savingPlan === pl.plan ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                ))}
              </div>
              {limitMsg && <div style={{ marginTop: '12px' }}><InlineStatus text={limitMsg} /></div>}
            </AdminSettingsDrawer>

            <AdminSettingsDrawer title="Duplicate Countries" open={openDrawer === 'countries'} onClose={() => setOpenDrawer(null)}>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 14px' }}>
                The same country sometimes lands in the catalog under two spellings. New imports/hunts are normalized automatically — this fixes rows that already exist.
              </p>
              {duplicateCountryGroups.length === 0 ? (
                <p style={{ fontSize: '12.5px', color: 'var(--success)', marginBottom: '20px' }}>✓ No duplicate country names found in the catalog.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {duplicateCountryGroups.map(group => (
                    <div key={group.target.name} style={{ borderRadius: '12px', border: '1px solid rgba(221,162,63,0.3)', background: 'rgba(221,162,63,0.08)', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <p style={{ fontSize: '12.5px', color: 'var(--text)', margin: 0 }}>
                        <strong>{group.target.name}</strong> ({group.target.count}) also appears as{' '}
                        {group.extras.map((e, i) => (
                          <span key={e.name}>{i > 0 && ', '}<strong>{e.name}</strong> ({e.count})</span>
                        ))}
                      </p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {group.extras.map(e => (
                          <button key={e.name} onClick={() => mergeCountries(e.name, group.target.name)}
                            disabled={merging === `${e.name}->${group.target.name}`}
                            style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: '8px', color: 'var(--warning)', background: 'rgba(221,162,63,0.14)', border: '1px solid rgba(221,162,63,0.3)', cursor: 'pointer' }}>
                            {merging === `${e.name}->${group.target.name}` ? 'Merging…' : `Merge "${e.name}" into "${group.target.name}"`}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Merge this country…</label>
                  <input list="admin-country-list" value={manualMergeFrom} onChange={e => setManualMergeFrom(e.target.value)} placeholder="e.g. UK" style={{ ...input, width: '180px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>…into this one</label>
                  <input list="admin-country-list" value={manualMergeTo} onChange={e => setManualMergeTo(e.target.value)} placeholder="e.g. United Kingdom" style={{ ...input, width: '180px' }} />
                </div>
                <datalist id="admin-country-list">
                  {catalogCountries.map(c => <option key={c.name} value={c.name} />)}
                </datalist>
                <button onClick={() => mergeCountries(manualMergeFrom, manualMergeTo)}
                  disabled={!manualMergeFrom.trim() || !manualMergeTo.trim() || merging !== null}
                  style={{ padding: '9px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: (!manualMergeFrom.trim() || !manualMergeTo.trim()) ? 0.5 : 1 }}>
                  Merge
                </button>
              </div>
              {mergeMsg && <InlineStatus text={mergeMsg} />}
            </AdminSettingsDrawer>

            <AdminSettingsDrawer title="Bulk Delete Companies" open={openDrawer === 'bulkDelete'} onClose={() => setOpenDrawer(null)}>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 14px' }}>
                Delete many companies at once by category instead of one at a time. This is permanent.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Country</label>
                  <input list="admin-country-list" value={bulkFilters.country} onChange={e => { setBulkFilters(s => ({ ...s, country: e.target.value })); setBulkPreview(null) }} placeholder="Any" style={input} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Industry</label>
                  <input value={bulkFilters.industry} onChange={e => { setBulkFilters(s => ({ ...s, industry: e.target.value })); setBulkPreview(null) }} placeholder="Any" style={input} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Company size</label>
                  <input value={bulkFilters.company_size} onChange={e => { setBulkFilters(s => ({ ...s, company_size: e.target.value })); setBulkPreview(null) }} placeholder="Any" style={input} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Discovery source</label>
                  <input value={bulkFilters.discovery_source} onChange={e => { setBulkFilters(s => ({ ...s, discovery_source: e.target.value })); setBulkPreview(null) }} placeholder="Any" style={input} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Name/city contains</label>
                  <input value={bulkFilters.search} onChange={e => { setBulkFilters(s => ({ ...s, search: e.target.value })); setBulkPreview(null) }} placeholder="Any" style={input} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '32px' }}>
                <button onClick={checkBulkPreview} disabled={bulkChecking}
                  style={{ padding: '9px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent)', cursor: 'pointer', opacity: bulkChecking ? 0.6 : 1 }}>
                  {bulkChecking ? 'Checking…' : 'Preview count'}
                </button>
                {bulkPreview !== null && (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: bulkPreview > 0 ? 'var(--text)' : 'var(--text-dim)' }}>
                    {bulkPreview} {bulkPreview === 1 ? 'company matches' : 'companies match'}
                  </span>
                )}
                <button onClick={runBulkDelete} disabled={bulkDeleting || bulkPreview === 0}
                  style={{ padding: '9px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'var(--error)', background: 'rgba(198,69,69,0.1)', border: '1px solid rgba(198,69,69,0.3)', cursor: 'pointer', opacity: (bulkDeleting || bulkPreview === 0) ? 0.5 : 1 }}>
                  {bulkDeleting ? 'Deleting…' : 'Delete matching companies'}
                </button>
                {bulkMsg && <InlineStatus text={bulkMsg} />}
              </div>
            </AdminSettingsDrawer>

            <AdminSettingsDrawer title="Broadcast & Notification Center" open={openDrawer === 'broadcast'} onClose={() => setOpenDrawer(null)}>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 14px' }}>
                Send an in-app notification (optionally also by email) to every user matching a segment. Leave all filters empty to target everyone.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Plan</label>
                  <select value={bcFilters.plan} onChange={e => { setBcFilters(s => ({ ...s, plan: e.target.value })); setBcPreview(null) }} style={input}>
                    <option value="">Any</option>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="agency">Agency</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Marketplace enabled</label>
                  <select value={bcFilters.marketplace_beta} onChange={e => { setBcFilters(s => ({ ...s, marketplace_beta: e.target.value })); setBcPreview(null) }} style={input}>
                    <option value="">Any</option>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Active in the last (days)</label>
                  <input type="number" min={1} value={bcFilters.active_since_days} onChange={e => { setBcFilters(s => ({ ...s, active_since_days: e.target.value })); setBcPreview(null) }} placeholder="Any" style={input} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Title</label>
                  <input value={bcTitle} onChange={e => setBcTitle(e.target.value)} placeholder="e.g. New feature: Community Feed" style={input} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Link (optional, e.g. /feed)</label>
                  <input value={bcLink} onChange={e => setBcLink(e.target.value)} placeholder="/feed" style={input} />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Message</label>
                <textarea value={bcBody} onChange={e => setBcBody(e.target.value)} rows={3} placeholder="What do you want to tell them?" style={{ ...input, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '32px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={bcAlsoEmail} onChange={e => setBcAlsoEmail(e.target.checked)} />
                  Also send by email
                </label>
                <button onClick={checkBcPreview} disabled={bcChecking}
                  style={{ padding: '9px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent)', cursor: 'pointer', opacity: bcChecking ? 0.6 : 1 }}>
                  {bcChecking ? 'Checking…' : 'Preview count'}
                </button>
                {bcPreview !== null && (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: bcPreview > 0 ? 'var(--text)' : 'var(--text-dim)' }}>
                    {bcPreview} {bcPreview === 1 ? 'user matches' : 'users match'}
                  </span>
                )}
                <button onClick={sendBroadcast} disabled={bcSending || bcPreview === 0 || !bcTitle.trim()}
                  style={{ padding: '9px 18px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: (bcSending || bcPreview === 0 || !bcTitle.trim()) ? 0.5 : 1 }}>
                  {bcSending ? 'Sending…' : 'Send broadcast'}
                </button>
                {bcMsg && <InlineStatus text={bcMsg} />}
              </div>
            </AdminSettingsDrawer>

            <AdminSettingsDrawer title="Payment Instructions" open={openDrawer === 'payment'} onClose={() => setOpenDrawer(null)}>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 14px' }}>
                Shown to users on the upgrade page. Stored in the database, not in code.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Card number (Iran)</label>
                  <input value={instr.card_number} onChange={e => setInstr(s => ({ ...s, card_number: e.target.value }))} placeholder="6037-XXXX-XXXX-XXXX" style={{ ...input, resize: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Card holder name</label>
                  <input value={instr.card_holder} onChange={e => setInstr(s => ({ ...s, card_holder: e.target.value }))} placeholder="نام صاحب کارت" style={{ ...input, resize: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>PayPal email</label>
                  <input value={instr.paypal_email} onChange={e => setInstr(s => ({ ...s, paypal_email: e.target.value }))} placeholder="you@example.com" style={{ ...input, resize: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Support email</label>
                  <input value={instr.support_email} onChange={e => setInstr(s => ({ ...s, support_email: e.target.value }))} placeholder="support@…" style={{ ...input, resize: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Support phone (Telegram / WhatsApp)</label>
                  <input value={instr.support_phone} onChange={e => setInstr(s => ({ ...s, support_phone: e.target.value }))} placeholder="+98…" style={{ ...input, resize: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 220px' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>Fallback USD → Toman rate</label>
                  <input value={instr.manual_rate} onChange={e => setInstr(s => ({ ...s, manual_rate: e.target.value }))} placeholder="e.g. 190000" style={{ ...input, resize: 'none' }} />
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '0 0 10px', flex: 1, minWidth: '200px' }}>
                  {rate?.rate
                    ? `Live rate: ${rate.rate.toLocaleString('en-US')} Toman / $1 (source: ${rate.source}).`
                    : 'Live rate unavailable — the fallback above is used.'}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>English</label>
                  <textarea rows={8} value={instr.instructions_en} onChange={e => setInstr(s => ({ ...s, instructions_en: e.target.value }))} style={input} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>فارسی</label>
                  <textarea rows={8} value={instr.instructions_fa} onChange={e => setInstr(s => ({ ...s, instructions_fa: e.target.value }))} style={{ ...input, direction: 'rtl', textAlign: 'right' }} />
                </div>
              </div>
              <button onClick={saveInstructions} disabled={savingInstr}
                style={{ padding: '10px 22px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#3D4FE0,#2E3BB0)', border: 'none', cursor: 'pointer', opacity: savingInstr ? 0.6 : 1 }}>
                {savingInstr ? 'Saving…' : 'Save instructions'}
              </button>
              {limitMsg && <div style={{ marginTop: '10px' }}><InlineStatus text={limitMsg} /></div>}
            </AdminSettingsDrawer>

            <AdminSettingsDrawer title="Feature Flags" open={openDrawer === 'flags'} onClose={() => setOpenDrawer(null)}>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 16px', lineHeight: 1.6 }}>
                Storage only — a fixed, small set of flags saved to the database. Nothing elsewhere in the code currently reads these values.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {flags.map(f => (
                  <div key={f.key} style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 14px' }}>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>{f.label}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        defaultValue={f.value}
                        onBlur={e => { if (e.target.value !== f.value) saveFlag(f.key, e.target.value) }}
                        style={{ ...input, flex: 1 }}
                        disabled={savingFlag === f.key}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </AdminSettingsDrawer>
          </main>
        </div>
      </div>
    </div>
  )
}
