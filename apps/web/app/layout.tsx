import type { Metadata, Viewport } from 'next'

import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'

import '../src/index.css'

import Providers from './providers'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: 'Caisse CI — Caisse POS & abonnement',
  description:
    'Caisse CI — caisse POS offline-first pour la Côte d’Ivoire. Mobile money, multi-postes, essai gratuit 1 mois. Orange Money, Wave, MTN MoMo.',
  openGraph: {
    title: 'Caisse CI — Caisse POS & abonnement',
    description:
      'Vendez hors ligne, payez en mobile money, gérez vos équipes. Essai gratuit 1 mois.',
    type: 'website',
    images: ['/marketing/hero-caisseci.png'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/marketing/hero-caisseci.png'],
  },
  icons: {
    icon: [
      { url: '/branding/logo-circle.svg', type: 'image/svg+xml' },
      { url: '/branding/caisse-ci-logo.png', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#1463ff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
