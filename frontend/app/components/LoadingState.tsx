'use client'

/** Standard loading spinner — same size/color/animation everywhere, so a
 * page doesn't have to redeclare its own @keyframes spin block. `fullPage`
 * centers it in the remaining viewport (for a page's very first load);
 * omit it for an inline spinner inside an already-laid-out card/list. */
export default function LoadingState({ fullPage = false, label }: { fullPage?: boolean; label?: string }) {
  const spinner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
      <div style={{ width: '28px', height: '28px', border: '2px solid var(--accent-dim)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'archon-spin 0.8s linear infinite' }} />
      {label && <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: 0 }}>{label}</p>}
      <style>{`@keyframes archon-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  if (!fullPage) return spinner
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
      {spinner}
    </div>
  )
}
