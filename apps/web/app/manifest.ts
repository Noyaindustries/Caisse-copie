import type { MetadataRoute } from 'next'

/**
 * Chrome exige des PNG 192×192 et 512×512 avec purpose "any"
 * pour afficher le logo à l’installation PWA. SVG seul / maskable seul
 * → icône manquante ou générique.
 */
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
        src: '/branding/pwa-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/branding/pwa-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/branding/pwa-icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/branding/pwa-icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
