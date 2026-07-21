import type { Metadata } from 'next'
import './globals.css'
import OnboardingTour from './components/OnboardingTour'
import AxiosAuth from './components/AxiosAuth'

export const metadata: Metadata = {
  title: 'Archon — by Armila Design',
  description: 'Business Development OS for Architectural Studios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0 }}>
        <AxiosAuth />
        <div className="page-enter">
          {children}
        </div>
        <OnboardingTour />
      </body>
    </html>
  )
}
