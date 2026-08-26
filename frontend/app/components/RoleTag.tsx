'use client'

/** A small "Client" / "Freelancer" label next to a name — so it's always
 * clear which hat the other person is wearing in this thread/contract/
 * proposal, since the same platform account can be either. */
export default function RoleTag({ role }: { role: 'client' | 'freelancer' }) {
  return (
    <span style={{
      fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px',
      color: 'var(--text-dim)', background: 'var(--bg-tag)', textTransform: 'uppercase', letterSpacing: '0.04em',
      flexShrink: 0,
    }}>
      {role === 'client' ? 'Client' : 'Freelancer'}
    </span>
  )
}
