import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Caisse CI — Point de vente',
    short_name: 'Caisse CI',
    description:
      'Caisse enregistreuse hors ligne pour commerces en Côte d’Ivoire',
    theme_color: '#003399',
    background_color: '#f8fafc',
    display: 'standalone',
    orientation: 'any',
    start_url: '/',
    scope: '/',
    lang: 'fr',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      {
        src: '/branding/logo-circle.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/branding/caisse-ci-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
