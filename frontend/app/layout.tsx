import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Archon — by Armila Design',
  description: 'Business Development OS for Architectural Studios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0F1117] text-[#E2E8F0] min-h-screen">
        {children}
      </body>
    </html>
  )
}