import type { Metadata } from 'next'
import { Vazirmatn, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import OnboardingTour from './components/OnboardingTour'
import AxiosAuth from './components/AxiosAuth'
import PageTransition from './components/PageTransition'

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Archon — by Armila Design',
  description: 'Business Development OS for Architectural Studios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${vazirmatn.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0 }}>
        <AxiosAuth />
        <PageTransition>{children}</PageTransition>
        <OnboardingTour />
      </body>
    </html>
  )
}
