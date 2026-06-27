import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Archon — by Armila Design',
  description: 'Business Development OS for Architectural Studios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('archon-theme');
                  if (theme === 'light') {
                    document.documentElement.classList.add('light-theme');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
