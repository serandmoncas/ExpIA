import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AudienceProvider } from '@/components/audience-provider'
import { SiteHeader } from '@/components/site-header'

// globals.css (shadcn) espera --font-sans y --font-geist-mono
const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'ExpIA', template: '%s · ExpIA' },
  description: 'Aprende IA navegando conceptos y herramientas por fecha, dependencias y tendencia.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AudienceProvider>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </AudienceProvider>
      </body>
    </html>
  )
}
