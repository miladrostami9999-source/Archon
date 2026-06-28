'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps'

const API = 'http://localhost:8000'
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Theme-aware colors for SVG (CSS vars don't work inside SVG)
const getThemeColors = (isDark: boolean) => ({
  mapBg:       isDark ? '#0F1117' : '#E8ECF4',
  countryEmpty: isDark ? '#1E2436' : '#D0D8E8',
  stroke:      isDark ? '#0F1117' : '#E8ECF4',
  countryHover: isDark ? '#2A3350' : '#BCC8DC',
})

// Country name mapping — react-simple-maps uses different names
const NAME_MAP: Record<string, string[]> = {
  'United Kingdom':  ['United Kingdom', 'England', 'UK', 'Britain'],
  'United States':   ['United States of America', 'USA', 'US'],
  'South Korea':     ['Korea, Republic of', 'Korea'],
  'Iran':            ['Iran, Islamic Republic of', 'Islamic Republic of Iran'],
  'Russia':          ['Russian Federation'],
  'Czech Republic':  ['Czechia'],
  'UAE':             ['United Arab Emirates'],
}

// Flatten reverse map: topo name → our name
const buildReverseMap = (data: Record<string, { count: number }>) => {
  const rev: Record<string, string> = {}
  Object.entries(NAME_MAP).forEach(([ourName, aliases]) => {
    aliases.forEach(a => { rev[a] = ourName })
  })
  return rev
}

const STATUS_COLOR: Record<string, string> = {
  new: '#60A5FA', reviewed: '#A78BFA', ready: '#FCD34D',
  sent: '#FB923C', replied: '#34D399', meeting: '#2DD4BF',
  client: '#4ADE80', archive: '#F87171', waiting: '#9CA3AF',
}

interface CountryData {
  name: string
  count: number
  avg_score: number
  hot: number
  statuses: Record<string, number>
  companies: { id: number; name: string; status: string; score: number; heat_level: string; industry: string }[]
}

export default function MapPage() {
  const [mapData, setMapData] = useState<CountryData[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CountryData | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; country: CountryData } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState<[number, number]>([10, 20])

  const [isDark, setIsDark] = useState(true)

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

  const countryMap = Object.fromEntries(mapData.map(d => [d.name, d]))
  const maxCount = Math.max(...mapData.map(d => d.count), 1)
  const reverseMap = buildReverseMap(countryMap)

  const getCountryData = (geoName: string): CountryData | null => {
    // Direct match
    if (countryMap[geoName]) return countryMap[geoName]
    // Reverse alias match
    const mapped = reverseMap[geoName]
    if (mapped && countryMap[mapped]) return countryMap[mapped]
    return null
  }

  const themeColors = getThemeColors(isDark)

  const getFillColor = (data: CountryData | null): string => {
    if (!data) return themeColors.countryEmpty
    const intensity = data.count / maxCount
    if (intensity >= 0.8) return '#4F7BF7'
    if (intensity >= 0.6) return '#6B8FE8'
    if (intensity >= 0.4) return '#7C9FDB'
    if (intensity >= 0.2) return '#93B0D4'
    return '#A8C4E0'
  }

  const totalCompanies = mapData.reduce((a, d) => a + d.count, 0)
  const totalCountries = mapData.length
  const hotCount = mapData.reduce((a, d) => a + d.hot, 0)

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '224px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid rgba(79,123,247,0.3)', borderTop: '2px solid #4F7BF7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', transition: 'background 0.25s, color 0.25s' }}>
      <Sidebar />

      {/* TOOLTIP */}
      {tooltip && (
        <div style={{
          position: 'fixed', zIndex: 100, pointerEvents: 'none',
          left: tooltip.x + 12, top: tooltip.y - 8,
          borderRadius: '10px', border: '1px solid var(--border)',
          background: 'var(--bg-card)', backdropFilter: 'blur(12px)',
          padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          minWidth: '140px',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>{tooltip.country.name}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 2px' }}>🏢 {tooltip.country.count} companies</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 2px' }}>⭐ Avg score: {tooltip.country.avg_score}</p>
          {tooltip.country.hot > 0 && <p style={{ fontSize: '12px', color: '#FB923C', margin: 0 }}>🔥 {tooltip.country.hot} hot leads</p>}
        </div>
      )}

      <div style={{ flex: 1, marginLeft: '224px', display: 'flex', flexDirection: 'column' }}>

        {/* HEADER */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', height: '56px',
          background: 'var(--bg-main)', borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)', transition: 'background 0.25s, border-color 0.25s',
        }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Market Intelligence Map</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>Geographic distribution of your pipeline</p>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            {[
              { label: 'Countries', value: totalCountries, color: '#60A5FA' },
              { label: 'Companies', value: totalCompanies, color: '#A78BFA' },
              { label: 'Hot Leads', value: hotCount, color: '#FB923C' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '16px', fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: '0' }}>

          {/* MAP */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

            {/* ZOOM CONTROLS */}
            <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { label: '+', action: () => setZoom(z => Math.min(z + 0.5, 8)) },
                { label: '−', action: () => setZoom(z => Math.max(z - 0.5, 1)) },
                { label: '⌂', action: () => { setZoom(1); setCenter([10, 20]) } },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action}
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA'; e.currentTarget.style.borderColor = 'rgba(79,123,247,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                  {btn.label}
                </button>
              ))}
            </div>

            {/* LEGEND */}
            <div style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 10, borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '10px 14px' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Density</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {['#A8C4E0', '#93B0D4', '#7C9FDB', '#6B8FE8', '#4F7BF7'].map((c, i) => (
                  <div key={i} style={{ width: '20px', height: '10px', borderRadius: '3px', background: c }} />
                ))}
                <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: '4px' }}>Low → High</span>
              </div>
            </div>

            {mapData.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '32px', opacity: 0.2 }}>🗺</p>
                <p style={{ fontSize: '14px', color: 'var(--text-dim)' }}>No geographic data yet. Add companies with countries.</p>
              </div>
            ) : (
              <ComposableMap
                projection="geoMercator"
                style={{ width: '100%', height: '100%', minHeight: '500px', background: themeColors.mapBg }}
              >
                <ZoomableGroup
                  zoom={zoom}
                  center={center}
                  onMoveEnd={({ coordinates, zoom: z }) => { setCenter(coordinates as [number, number]); setZoom(z) }}
                >
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map(geo => {
                        const geoName = geo.properties.name
                        const data = getCountryData(geoName)
                        const fill = getFillColor(data)
                        const hasData = !!data

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={fill}
                            stroke={themeColors.stroke}
                            strokeWidth={0.5}
                            style={{
                              default: { outline: 'none', cursor: hasData ? 'pointer' : 'default', transition: 'fill 0.2s' },
                              hover: { outline: 'none', fill: hasData ? '#3B6CF0' : themeColors.countryHover, cursor: hasData ? 'pointer' : 'default' },
                              pressed: { outline: 'none', fill: hasData ? '#2D5FE0' : themeColors.countryHover },
                            }}
                            onMouseEnter={e => { if (data) setTooltip({ x: e.clientX, y: e.clientY, country: data }) }}
                            onMouseMove={e => { if (data) setTooltip({ x: e.clientX, y: e.clientY, country: data }) }}
                            onMouseLeave={() => setTooltip(null)}
                            onClick={() => { if (data) { setSelected(data); setTooltip(null) } }}
                          />
                        )
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
            )}
          </div>

          {/* SIDEBAR PANEL */}
          <div style={{
            width: selected ? '320px' : '240px',
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg-card)',
            display: 'flex', flexDirection: 'column',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
          }}>
            {selected ? (
              /* COUNTRY DETAIL */
              <div style={{ flex: 1, overflow: 'auto' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{selected.name}</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{selected.count} companies</p>
                  </div>
                  <button onClick={() => setSelected(null)}
                    style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', transition: 'color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}>
                    ✕
                  </button>
                </div>

                {/* STATS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  {[
                    { label: 'Avg Score', value: selected.avg_score, color: selected.avg_score >= 70 ? '#34D399' : '#FBBF24' },
                    { label: 'Hot Leads', value: selected.hot, color: '#FB923C' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg-input)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <p style={{ fontSize: '18px', fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* STATUS BREAKDOWN */}
                {Object.keys(selected.statuses).length > 0 && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Pipeline Status</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {Object.entries(selected.statuses).map(([status, count]) => (
                        <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_COLOR[status] || '#64748B' }} />
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* COMPANIES LIST */}
                <div style={{ padding: '12px 16px' }}>
                  <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Companies</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selected.companies.map(c => (
                      <button key={c.id}
                        onClick={() => window.location.href = `/company/${c.id}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,123,247,0.3)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-input)' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>{c.industry} · {c.heat_level === 'hot' ? '🔥' : c.heat_level === 'warm' ? '🌤' : '❄️'}</p>
                        </div>
                        <div style={{ display: 'flex', flex: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: c.score >= 70 ? '#34D399' : c.score >= 50 ? '#FBBF24' : '#64748B' }}>{c.score}</span>
                          <span style={{ fontSize: '10px', color: STATUS_COLOR[c.status] || '#64748B' }}>{c.status}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* COUNTRY LIST */
              <div style={{ flex: 1, overflow: 'auto' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', margin: 0 }}>Top Markets</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0' }}>Click a country to explore</p>
                </div>
                {mapData.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '32px 16px' }}>No data yet</p>
                ) : (
                  <div style={{ padding: '8px' }}>
                    {mapData.map((country, i) => (
                      <button key={country.name}
                        onClick={() => setSelected(country)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', marginBottom: '2px' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-dim)', width: '20px', textAlign: 'center', flexShrink: 0 }}>#{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{country.name}</p>
                          <div style={{ width: '100%', background: 'var(--border)', borderRadius: '999px', height: '4px', marginTop: '4px' }}>
                            <div style={{ height: '4px', borderRadius: '999px', background: '#4F7BF7', width: `${(country.count / maxCount) * 100}%`, transition: 'width 0.5s' }} />
                          </div>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{country.count}</p>
                          {country.hot > 0 && <p style={{ fontSize: '10px', color: '#FB923C', margin: 0 }}>🔥{country.hot}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
