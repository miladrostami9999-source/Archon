'use client'
import { usePathname } from 'next/navigation'

// Opacity-only, keyed by pathname so the fade replays on every navigation.
// Never add transform/filter here — either creates a containing block for
// this wrapper's position:fixed descendants (the Sidebar), breaking it.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  )
}
