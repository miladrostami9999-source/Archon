'use client'
import { useEffect, useState, useRef, useCallback, memo } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps'

const API = 'http://localhost:8000'
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const getThemeColors = (isDark: boolean) => ({
  mapBg:        isDark ? '#0F1117' : '#E8ECF4',
  countryEmpty: isDark ? '#1E2436' : '#D0D8E8',
  stroke:       isDark ? '#0F1117' : '#E8ECF4',
  countryHover: isDark ? '#2A3350' : '#BCC8DC',
})

const NAME_MAP: Record<string, string[]> = {
  'United Kingdom': ['United Kingdom', 'England', 'UK', 'Britain'],
  'United States':  ['United States of America', 'USA', 'US'],
  'South Korea':    ['Korea, Republic of', 'Korea'],
  'Iran':           ['Iran, Islamic Republic of', 'Islamic Republic of Iran'],
  'Russia':         ['Russian Federation'],
  'Czech Republic': ['Czechia'],
  'UAE':            ['United Arab Emirates'],
}

const STATUS_COLOR: Record<string, string> = {
  new: '#60A5FA', reviewed: '#A78BFA', ready: '#FCD34D',
  sent: '#FB923C', replied: '#34D399', meeting: '#2DD4BF',
  client: '#4ADE80', archive: '#F87171', waiting: '#9CA3AF',
}

interface CountryData {
  name: string; count: number; avg_score: number; hot: number
  statuses: Record<string, number>
  companies: { id: number; name: string; status: string; score: number; heat_level: string; industry: string }[]
}

export default function MapPage() {
  const isMobile = useIsMobile()
  const [mapData, setMapData] = useState<CountryData[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CountryData | null>(null)
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState<[number, number]>([10, 20])
  const zoomRef = useRef(1)
  const centerRef = useRef<[number, number]>([10, 20])
  const [isDark, setIsDark] = useState(true)
  const [showPanel, setShowPanel] = useState(true)

  useEffect(() => {
    const check = () => setIsDark(!document.documentElement.classList.contains('light-theme'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    axios.get(`${API}/companies/map/data`)
      .then(res => { setMapData(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const themeColors = getThemeColors(isDark)
  const maxCount = Math.max(...mapData.map(d => d.count), 1)
  const totalCountries = mapData.length
  const totalCompanies = mapData.reduce((a, c) => a + c.count, 0)
  const hotCount = mapData.reduce((a, c) => a + c.hot, 0)

  const reverseMap: Record<string, string> = {}
  Object.entries(NAME_MAP).forEach(([ourName, aliases]) => {
    aliases.forEach(a => { reverseMap[a] = ourName })
  })

  const getCountryData = (geoName: string) => {
    const normalized = reverseMap[geoName] || geoName
    return mapData.find(d => d.name.toLowerCase() === normalized.toLowerCase()) || null
  }

  const getFillColor = (data: CountryData | null) => {
    if (!data) return themeColors.countryEmpty
    const intensity = data.count / maxCount
    const r = Math.round(79 + (20 - 79) * (1 - intensity))
    const g = Math.round(123 + (100 - 123) * (1 - intensity))
    const b = Math.round(247 + (200 - 247) * (1 - intensity))
    return `rgb(${r},${g},${b})`
  }

  const getScoreColor = (s: number) => s >= 80 ? '#34D399' : s >= 60 ? '#FBBF24' : '#9CA3AF'
  const HEAT = { hot: '🔥', warm: '🌤', cold: '❄️' } as any

  // MOBILE: bottom sheet for country detail
  // DESKTOP: side panel

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mapJSX = (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: themeColors.mapBg }}>
      {/* ZOOM */}
      <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {[
          { label: '+', action: () => { const nz = Math.min(zoomRef.current + 0.5, 8); zoomRef.current = nz; setZoom(nz) } },
          { label: '−', action: () => { const nz = Math.max(zoomRef.current - 0.5, 1); zoomRef.current = nz; setZoom(nz) } },
          { label: '⌂', action: () => { zoomRef.current = 1; centerRef.current = [10,20]; setZoom(1); setCenter([10,20]) } },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action}
            style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {btn.label}
          </button>
        ))}
      </div>

      {/* LEGEND */}
      <div style={{ position: 'absolute', bottom: '12px', left: '12px', zIndex: 10, borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '8px 12px' }}>
        <p style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Density</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {['#A8C4E0', '#93B0D4', '#7C9FDB', '#6B8FE8', '#4F7BF7'].map((c, i) => (
            <div key={i} style={{ width: '16px', height: '8px', borderRadius: '2px', background: c }} />
          ))}
          <span style={{ fontSize: '9px', color: 'var(--text-dim)', marginLeft: '4px' }}>Low→High</span>
        </div>
      </div>

      {/* MAP */}
      {mapData.length === 0 && !loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '28px', opacity: 0.2 }}>🗺</p>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No geographic data yet</p>
        </div>
      ) : (
        <ComposableMap
          projection="geoMercator"
          style={{ width: '100%', height: '100%', background: themeColors.mapBg }}
        >
          <ZoomableGroup zoom={zoom} center={center}
            onMoveEnd={({ coordinates, zoom: z }) => {
              centerRef.current = coordinates as [number, number]
              zoomRef.current = z
              // Don't call setCenter/setZoom here — avoids re-render flash
            }}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) => geographies.map(geo => {
                const geoName = geo.properties.name
                const data = getCountryData(geoName)
                const fill = getFillColor(data)
                const isSelected = selected?.name === (data?.name || geoName)
                return (
                  <Geography key={geo.rsmKey} geography={geo}
                    onClick={() => { if (data) { setSelected(data); setShowPanel(true) } }}
                    style={{
                      default: { fill: isSelected ? '#4F7BF7' : fill, stroke: themeColors.stroke, strokeWidth: 0.4, outline: 'none' },
                      hover:   { fill: data ? '#4F7BF7' : themeColors.countryHover, stroke: themeColors.stroke, strokeWidth: 0.4, outline: 'none', cursor: data ? 'pointer' : 'default' },
                      pressed: { fill: '#3B6EE8', stroke: themeColors.stroke, strokeWidth: 0.4, outline: 'none' },
                    }}
                  />
                )
              })}
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      )}
    </div>
  )

  const panelJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {selected ? (
        <>
          {/* HEADER */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{selected.name}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{selected.count} {selected.count === 1 ? 'company' : 'companies'}</p>
            </div>
            <button onClick={() => setSelected(null)}
              style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', borderRadius: '6px' }}>✕</button>
          </div>

          {/* STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', flexShrink: 0 }}>
            {[
              { label: 'Avg Score', value: selected.avg_score, color: getScoreColor(selected.avg_score) },
              { label: 'Hot Leads', value: selected.hot, color: '#FB923C' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-input)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <p style={{ fontSize: '20px', fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* PIPELINE */}
          {Object.keys(selected.statuses).length > 0 && (
            <div style={{ padding: '0 12px 10px', flexShrink: 0 }}>
              <p style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Pipeline</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Object.entries(selected.statuses).map(([status, count]) => (
                  <span key={status} style={{ fontSize: '10px', fontWeight: 600, color: STATUS_COLOR[status] || '#9CA3AF', background: `${STATUS_COLOR[status] || '#9CA3AF'}15`, border: `1px solid ${STATUS_COLOR[status] || '#9CA3AF'}30`, padding: '2px 7px', borderRadius: '999px' }}>
                    {status} {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* COMPANIES */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
            <p style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Companies</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selected.companies.map(c => (
                <button key={c.id} onClick={() => window.location.href = `/company/${c.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.35)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: '1px 0 0' }}>{c.industry} · {HEAT[c.heat_level]}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: getScoreColor(c.score), margin: 0 }}>{c.score}</p>
                    <p style={{ fontSize: '10px', color: STATUS_COLOR[c.status] || '#9CA3AF', margin: 0 }}>{c.status}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Top Markets</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>Click a country to explore</p>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {mapData.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '24px 16px' }}>No data yet</p>
            ) : (
              <div style={{ padding: '8px' }}>
                {mapData.map((country, i) => (
                  <button key={country.name} onClick={() => { setSelected(country); setShowPanel(true) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', marginBottom: '2px', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', width: '18px', textAlign: 'center', flexShrink: 0 }}>#{i+1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{country.name}</p>
                      <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '3px', marginTop: '4px' }}>
                        <div style={{ height: '3px', borderRadius: '999px', background: '#4F7BF7', width: `${(country.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{country.count}</p>
                      {country.hot > 0 && <p style={{ fontSize: '10px', color: '#FB923C', margin: 0 }}>🔥{country.hot}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', paddingTop: isMobile ? '52px' : 0 }}>
        <div className="spinner" />
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>Loading map data...</p>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', display: 'flex', flexDirection: 'column', height: isMobile ? 'auto' : '100vh', overflow: 'hidden', paddingTop: isMobile ? '52px' : 0 }}>

        {/* HEADER */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 24px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Market Intelligence Map</h1>
            <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: 0 }}>Geographic distribution of your pipeline</p>
          </div>
          <div style={{ display: 'flex', gap: isMobile ? '12px' : '20px' }}>
            {[
              { label: 'Countries', value: totalCountries, color: '#60A5FA' },
              { label: 'Companies', value: totalCompanies, color: '#A78BFA' },
              { label: 'Hot Leads', value: hotCount, color: '#FB923C' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'right' }}>
                <p style={{ fontSize: isMobile ? '15px' : '16px', fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                <p style={{ fontSize: '9px', color: 'var(--text-dim)', margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ DESKTOP LAYOUT ═══ */}
        {!isMobile && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            {/* MAP */}
            <div style={{ flex: 1, overflow: 'hidden', background: themeColors.mapBg }}>
              {mapJSX}
            </div>
            {/* SIDE PANEL */}
            <div style={{ width: selected ? '260px' : '200px', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg-card)', transition: 'width 0.3s ease', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {panelJSX}
            </div>
          </div>
        )}

        {/* ═══ MOBILE LAYOUT ═══ */}
        {isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {/* MAP — fixed height */}
            <div style={{ height: '55vh', maxHeight: '380px', minHeight: '220px', position: 'relative', flexShrink: 0, background: themeColors.mapBg }}>
              {mapJSX}
            </div>

            {/* PANEL — fills rest of screen */}
            <div style={{ flex: 1, borderTop: '1px solid var(--border)', background: 'var(--bg-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {panelJSX}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spinner { width:24px; height:24px; border:2px solid rgba(79,123,247,0.2); border-top-color:#4F7BF7; border-radius:50%; animation:spin 0.7s linear infinite; }`}</style>
    </div>
  )
}
