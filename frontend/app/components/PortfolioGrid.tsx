'use client'
import { Building2, Camera, ExternalLink, Plus, X } from 'lucide-react'

export interface PortfolioImage { id: string; data: string; name: string; alt?: string }
export interface PortfolioItem { id: string; title: string; desc: string; url: string; images: PortfolioImage[] }

interface PortfolioGridProps {
  items: PortfolioItem[]
  isMobile?: boolean
  /** 'themed' follows the app's CSS variables (Profile, Members). 'dark' is the fixed dark
   * palette used by the standalone public share page (u/[username]), independent of site theme. */
  variant?: 'themed' | 'dark'
  editable?: boolean
  onSelect?: (item: PortfolioItem) => void
  onAddImages?: (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => void
  onDeleteItem?: (itemId: string) => void
  emptyTitle?: string
  emptySubtitle?: string
}

const PALETTE = {
  themed: {
    border: 'var(--border)', hoverBorder: 'rgba(61,79,224,0.35)',
    bg: 'var(--bg-card)', coverBg: 'linear-gradient(135deg, rgba(61,79,224,0.08), rgba(46,59,176,0.08))',
    text: 'var(--text)', textMuted: 'var(--text-muted)', textDim: 'var(--text-dim)',
    emptyBorder: 'var(--border)', emptyBg: 'var(--bg-card)',
  },
  dark: {
    border: 'rgba(255,255,255,0.09)', hoverBorder: 'rgba(61,79,224,0.35)',
    bg: 'rgba(255,255,255,0.02)', coverBg: 'linear-gradient(135deg, rgba(61,79,224,0.08), rgba(46,59,176,0.08))',
    text: '#E7EAF0', textMuted: 'rgba(231,234,240,0.5)', textDim: 'rgba(231,234,240,0.3)',
    emptyBorder: 'rgba(255,255,255,0.09)', emptyBg: 'transparent',
  },
}

export default function PortfolioGrid({
  items, isMobile, variant = 'themed', editable, onSelect, onAddImages, onDeleteItem,
  emptyTitle = 'No projects yet', emptySubtitle = 'Nothing has been added to this portfolio yet.',
}: PortfolioGridProps) {
  const c = PALETTE[variant]

  if (items.length === 0) {
    return (
      <div style={{ borderRadius: 'var(--radius-xl)', border: `1px solid ${c.emptyBorder}`, background: c.emptyBg, padding: '56px 24px', textAlign: 'center' }}>
        <Building2 size={36} strokeWidth={1.25} style={{ color: c.textDim, marginBottom: '12px' }} />
        <p style={{ fontSize: '14.5px', fontWeight: 500, color: c.textMuted, margin: '0 0 4px' }}>{emptyTitle}</p>
        <p style={{ fontSize: '12.5px', color: c.textDim, margin: 0 }}>{emptySubtitle}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
      {items.map(item => {
        const cover = item.images?.[0]
        const clickable = !!onSelect
        return (
          <div key={item.id}
            onClick={clickable ? () => onSelect!(item) : undefined}
            style={{ borderRadius: 'var(--radius-lg)', border: `1px solid ${c.border}`, background: c.bg, overflow: 'hidden', transition: 'all 0.2s', cursor: clickable ? 'pointer' : 'default' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = c.hoverBorder; e.currentTarget.style.transform = 'translateY(-3px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.transform = 'none' }}>

            <div style={{ height: '160px', background: c.coverBg, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {cover ? (
                <img src={cover.data} alt={cover.alt || item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Building2 size={40} strokeWidth={1.25} style={{ opacity: 0.3, color: c.textDim }} />
              )}

              {item.images?.length > 0 && (
                <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', color: 'white', fontWeight: 600 }}>
                  <Camera size={11} strokeWidth={2} /> {item.images.length}
                </div>
              )}

              {editable && (
                <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                  <button onClick={e => { e.stopPropagation(); document.getElementById(`upload-${item.id}`)?.click() }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 9px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '11px', backdropFilter: 'blur(4px)' }}>
                    <Plus size={12} strokeWidth={2.5} /> Photos
                  </button>
                  <button onClick={e => { e.stopPropagation(); onDeleteItem?.(item.id) }}
                    style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(239,68,68,0.8)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={13} strokeWidth={2.5} />
                  </button>
                  <input id={`upload-${item.id}`} type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => onAddImages?.(e, item.id)} />
                </div>
              )}
            </div>

            <div style={{ padding: '14px 16px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: c.text, margin: '0 0 4px' }}>{item.title}</h4>
              {item.desc && (
                <p style={{ fontSize: '12px', color: c.textMuted, margin: '0 0 8px', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {item.desc}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {clickable ? (
                  <span style={{ fontSize: '11px', color: '#60A5FA', fontWeight: 500 }}>Click to view →</span>
                ) : item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#60A5FA', textDecoration: 'none', fontWeight: 500 }}>
                    View project <ExternalLink size={11} strokeWidth={2} />
                  </a>
                ) : <span />}
                {clickable && item.url && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: c.textDim }}>
                    <ExternalLink size={10} strokeWidth={2} /> External
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
