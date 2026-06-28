import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Archon — by Armila Design',
  description: 'Business Development OS for Architectural Studios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0 }}>
        <div className="page-enter">
          {children}
        </div>
      </body>
    </html>
  )
}
