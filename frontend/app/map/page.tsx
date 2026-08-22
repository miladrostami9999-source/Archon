'use client'
import { useEffect, useState, useRef, useCallback, memo } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useIsMobile } from '../hooks/useIsMobile'
import { FeatureLocked } from '../components/AccessLock'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps'
import { geoCentroid, geoBounds } from 'd3-geo'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
// Self-hosted rather than the world-atlas CDN file (which tops out at 1:50m
// resolution). Built from Natural Earth's 1:10m admin-0 countries — five
// times finer than 50m — via mapshaper (`-simplify dp 12% keep-shapes`, which
// protects tiny polygons like Singapore/Bahrain from being simplified into
// nothing), then quantized to topojson. Comparable file size to the old CDN
// 50m file despite the much higher source resolution. Regenerate with:
//   npx mapshaper ne_10m_admin_0_countries.geojson \
//     -filter-fields NAME,ADMIN,SOVEREIGNT -rename-fields name=NAME \
//     -simplify dp 12% keep-shapes -clean \
//     -o format=topojson quantization=1e5 countries-10m.json
const GEO_URL = '/geo/countries-10m.json'

const getThemeColors = (isDark: boolean) => ({
  mapBg:        isDark ? '#0F1117' : '#E8ECF4',
  countryEmpty: isDark ? '#1E2436' : '#D0D8E8',
  stroke:       isDark ? '#0F1117' : '#E8ECF4',
  countryHover: isDark ? '#2A3350' : '#BCC8DC',
  label:        isDark ? '#E2E8F0' : '#1A1A2E',
  labelHalo:    isDark ? '#0F1117' : '#FFFFFF',
})

const SELECTED_FILL = '#FBBF24'   // amber reads clearly against every blue in the ramp

// react-simple-maps defaults ZoomableGroup to maxZoom=8, which leaves a
// micro-state like Singapore only ~8px wide even centered. Raised so manual
// scroll-zoom and goToCountry (below) can bring tiny countries in close
// enough to actually read their shape.
const MAX_ZOOM = 20

/**
 * Our country names vs. the atlas's.
 *
 * Matching is normalised (lowercase, punctuation stripped) so most names line
 * up on their own; this table only covers the ones that genuinely differ.
 */
const NAME_MAP: Record<string, string[]> = {
  'United Kingdom':        ['United Kingdom', 'England', 'Scotland', 'Wales', 'UK', 'Great Britain', 'Britain'],
  'United States':         ['United States of America', 'USA', 'US', 'United States'],
  'United Arab Emirates':  ['United Arab Emirates', 'UAE'],
  'South Korea':           ['Korea, Republic of', 'Republic of Korea', 'Korea', 'S. Korea'],
  'North Korea':           ["Korea, Democratic People's Republic of", 'Dem. Rep. Korea', 'N. Korea'],
  'Iran':                  ['Iran, Islamic Republic of', 'Islamic Republic of Iran'],
  'Russia':                ['Russian Federation'],
  'Czech Republic':        ['Czechia'],
  'Turkey':                ['Türkiye', 'Turkiye'],
  'Netherlands':           ['Kingdom of the Netherlands', 'Holland'],
  'Bosnia and Herzegovina':['Bosnia and Herz.', 'Bosnia'],
  'Dominican Republic':    ['Dominican Rep.'],
  'Central African Republic': ['Central African Rep.'],
  'Democratic Republic of the Congo': ['Dem. Rep. Congo', 'DR Congo', 'Congo, The Democratic Republic of the'],
  'Republic of the Congo': ['Congo'],
  'Ivory Coast':           ["Côte d'Ivoire", "Cote d'Ivoire"],
  'Equatorial Guinea':     ['Eq. Guinea'],
  'South Sudan':           ['S. Sudan'],
  'Solomon Islands':       ['Solomon Is.'],
  'Vietnam':               ['Viet Nam'],
  'Laos':                  ["Lao PDR", "Lao People's Democratic Republic"],
  'Syria':                 ['Syrian Arab Republic'],
  'Tanzania':              ['United Republic of Tanzania'],
  'Venezuela':             ['Venezuela, Bolivarian Republic of'],
  'Bolivia':               ['Bolivia, Plurinational State of'],
  'Moldova':               ['Republic of Moldova'],
  'Macedonia':             ['North Macedonia', 'Macedonia'],
  'Eswatini':              ['Swaziland'],
  'Myanmar':               ['Burma'],
  'Cape Verde':            ['Cabo Verde'],
  'Hong Kong':             ['Hong Kong S.A.R.', 'Hong Kong SAR'],
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
  const [blocked, setBlocked] = useState<string | null>(null)
  const [selected, setSelected] = useState<CountryData | null>(null)
  const [zoom, setZoom] = useState(1)
  // Kept separate from `zoom` on purpose. `zoom` is the controlled prop fed
  // back into ZoomableGroup, and writing to it on every wheel event makes the
  // map jump. This one only drives label sizing, so it can update freely.
  const [labelZoom, setLabelZoom] = useState(1)
  const [center, setCenter] = useState<[number, number]>([10, 20])
  const zoomRef = useRef(1)
  const centerRef = useRef<[number, number]>([10, 20])
  // Cached once the atlas geometry loads (see the Geographies render prop
  // below), keyed the same way as dataByName, so selecting a country by name
  // — from the map or the Top Markets list — can look up its shape to pan
  // and zoom to it without a second fetch of the same topojson.
  const geoIndexRef = useRef<Record<string, any>>({})
  const [isDark, setIsDark] = useState(true)
  const [showPanel, setShowPanel] = useState(true)
  // Follows the cursor: name + count for whichever country it's currently
  // over, including ones with zero companies. Viewport coordinates (not
  // SVG/map coordinates) since the tooltip is a plain fixed-position div.
  const [hover, setHover] = useState<{ name: string; count: number; x: number; y: number } | null>(null)

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
      .catch(err => {
        // Market Map is a paid feature; a 403 here means the plan doesn't
        // include it, which is a different thing from the request failing.
        if (err.response?.status === 403) setBlocked(err.response.data?.detail || '')
        setLoading(false)
      })
  }, [])

  const themeColors = getThemeColors(isDark)
  const maxCount = Math.max(...mapData.map(d => d.count), 1)
  const totalCountries = mapData.length
  const totalCompanies = mapData.reduce((a, c) => a + c.count, 0)
  const hotCount = mapData.reduce((a, c) => a + c.hot, 0)

  // Fold case, punctuation and accents away so "Côte d'Ivoire" and "Cote
  // dIvoire" are the same key. Only genuinely different names need NAME_MAP.
  const norm = (s: string) =>
    (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]/g, '')

  const reverseMap: Record<string, string> = {}
  Object.entries(NAME_MAP).forEach(([ourName, aliases]) => {
    aliases.forEach(a => { reverseMap[norm(a)] = ourName })
  })

  // Index our data once per render rather than scanning it per geography —
  // this runs for every country on every paint.
  const dataByName = new Map<string, CountryData>()
  mapData.forEach(d => {
    dataByName.set(norm(d.name), d)
    const canonical = reverseMap[norm(d.name)]
    if (canonical) dataByName.set(norm(canonical), d)
    ;(NAME_MAP[d.name] || []).forEach(a => dataByName.set(norm(a), d))
  })

  const getCountryData = (geoName: string): CountryData | null => {
    const key = norm(geoName)
    return dataByName.get(key)
      || dataByName.get(norm(reverseMap[key] || ''))
      || null
  }

  // The name to show in the tooltip for a country with no data yet — prefer
  // our canonical spelling over the atlas's when we happen to know it.
  const displayName = (geoName: string): string => reverseMap[norm(geoName)] || geoName

  // Pans and zooms the map to a country by name — picking it from the map
  // itself or from the Top Markets list both land here, so a tiny country
  // like Singapore or Bahrain is never just a click that does nothing. Zoom
  // level is a coarse tier off the country's bounding box rather than an
  // exact fit — good enough to bring it from "a few sub-pixels" to clearly
  // visible without per-country tuning.
  const goToCountry = (name: string) => {
    const geo = geoIndexRef.current[norm(name)]
    if (!geo) return
    const centroid = geoCentroid(geo)
    const [[west, south], [east, north]] = geoBounds(geo)
    const maxDim = Math.max(east - west, north - south)
    const z = maxDim < 1 ? MAX_ZOOM : maxDim < 3 ? 12 : maxDim < 8 ? 5 : maxDim < 20 ? 3 : maxDim < 50 ? 1.8 : 1.2
    zoomRef.current = z
    centerRef.current = centroid
    setZoom(z)
    setCenter(centroid)
  }

  const getFillColor = (data: CountryData | null) => {
    if (!data) return themeColors.countryEmpty
    // Square-root scale: with a few countries holding most of the catalog, a
    // linear ramp leaves everything else indistinguishable from empty.
    const t = Math.sqrt(data.count / maxCount)
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * t)
    return `rgb(${lerp(150, 59)},${lerp(190, 105)},${lerp(235, 247)})`
  }

  const getScoreColor = (s: number) => s >= 80 ? '#34D399' : s >= 60 ? '#FBBF24' : '#9CA3AF'
  const HEAT = { hot: '🔥', warm: '🌤', cold: '❄️' } as any

  // MOBILE: bottom sheet for country detail
  // DESKTOP: side panel

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mapJSX = (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: themeColors.mapBg }}
      onMouseLeave={() => setHover(null)}>
      {/* Safety net for the tooltip: a Geography's own onMouseLeave normally
          clears it, but this catches the cursor leaving the map area entirely
          (e.g. over the zoom controls) without crossing another country first. */}
      {/* ZOOM */}
      <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {[
          { label: '+', action: () => { const nz = Math.min(zoomRef.current + 0.5, MAX_ZOOM); zoomRef.current = nz; setZoom(nz) } },
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
        <p style={{ fontSize: '9px', color: 'var(--text-dim)', margin: '6px 0 0' }}>Hover a country for details</p>
      </div>

      {/* HOVER TOOLTIP — follows the cursor, works for every country including
          ones with zero companies. position:fixed so it's never clipped by
          the map's own overflow. */}
      {hover && (
        <div style={{
          position: 'fixed', left: hover.x + 16, top: hover.y + 16, zIndex: 50,
          pointerEvents: 'none', borderRadius: '9px', border: '1px solid var(--border)',
          background: 'var(--bg-card)', padding: '8px 12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', whiteSpace: 'nowrap',
        }}>
          <p style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{hover.name}</p>
          <p style={{ fontSize: '11px', color: hover.count > 0 ? '#60A5FA' : 'var(--text-dim)', margin: '2px 0 0', fontWeight: hover.count > 0 ? 600 : 400 }}>
            {hover.count > 0 ? `${hover.count} ${hover.count === 1 ? 'company' : 'companies'}` : 'No companies yet'}
          </p>
        </div>
      )}

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
          <ZoomableGroup zoom={zoom} center={center} maxZoom={MAX_ZOOM}
            onMoveEnd={({ coordinates, zoom: z }: { coordinates: [number, number]; zoom: number }) => {
              centerRef.current = coordinates as [number, number]
              zoomRef.current = z
              // Don't call setCenter/setZoom here — feeding them back into the
              // controlled props makes the map jump. Only the label scale is
              // safe to update, since nothing reads it back.
              setLabelZoom(z)
            }}>
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: any[] }) => {
                // Built once per load: raw atlas name and our canonical
                // spelling both resolve to the same geometry, mirroring how
                // dataByName is indexed above.
                if (geographies.length && Object.keys(geoIndexRef.current).length === 0) {
                  geographies.forEach((geo: any) => {
                    const n = geo.properties.name
                    geoIndexRef.current[norm(n)] = geo
                    const canonical = reverseMap[norm(n)]
                    if (canonical) geoIndexRef.current[norm(canonical)] = geo
                  })
                }
                return geographies.map((geo: any) => {
                const geoName = geo.properties.name
                const data = getCountryData(geoName)
                const isSelected = !!data && selected?.name === data.name
                return (
                  <Geography key={geo.rsmKey} geography={geo}
                    onClick={() => { if (data) { setSelected(data); setShowPanel(true); goToCountry(data.name) } }}
                    // Permanent per-country labels used to overlap into an
                    // unreadable mess wherever a few small countries sit close
                    // together (the Gulf states, the Balkans...). A tooltip
                    // that follows the cursor gives the same name + count for
                    // *every* country — including ones with no data yet —
                    // without ever needing two labels to share the same spot.
                    onMouseEnter={(e: any) =>
                      setHover({ name: data?.name || displayName(geoName), count: data?.count || 0, x: e.clientX, y: e.clientY })}
                    onMouseMove={(e: any) =>
                      setHover(h => (h ? { ...h, x: e.clientX, y: e.clientY } : h))}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      default: {
                        fill: isSelected ? SELECTED_FILL : getFillColor(data),
                        // A halo on the selected country so it reads as picked
                        // even when the map is zoomed right out.
                        stroke: isSelected ? themeColors.labelHalo : themeColors.stroke,
                        strokeWidth: isSelected ? 1.4 / labelZoom : 0.35,
                        outline: 'none',
                        transition: 'fill 0.15s',
                      },
                      hover: {
                        fill: isSelected ? SELECTED_FILL : data ? '#4F7BF7' : themeColors.countryHover,
                        stroke: isSelected ? themeColors.labelHalo : themeColors.stroke,
                        strokeWidth: isSelected ? 1.4 / labelZoom : 0.35,
                        outline: 'none',
                        cursor: data ? 'pointer' : 'default',
                      },
                      pressed: {
                        fill: isSelected ? SELECTED_FILL : '#3B6EE8',
                        stroke: themeColors.stroke, strokeWidth: 0.35, outline: 'none',
                      },
                    }}
                  />
                )
                })
              }}
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
                  <button key={country.name} onClick={() => { setSelected(country); setShowPanel(true); goToCountry(country.name) }}
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

  if (blocked !== null) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', display: 'flex', paddingTop: isMobile ? '52px' : 0 }}>
        <FeatureLocked
          title="Market Map is on Pro and Agency"
          blurb={blocked || 'See where every company in the catalog sits, which countries are heating up, and where your pipeline is concentrated.'}
        />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '224px', display: 'flex', flexDirection: 'column', height: isMobile ? 'auto' : '100vh', overflow: 'hidden', paddingTop: isMobile ? '52px' : 0 }}>

        {/* HEADER */}
        <div style={{ position: 'sticky', top: isMobile ? '52px' : 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 24px', height: '56px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
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
