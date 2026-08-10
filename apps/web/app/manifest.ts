import type { MetadataRoute } from 'next'
import { getSiteBranding } from '../../../server/lib/siteBranding'

/**
 * Chrome exige des PNG 192×192 et 512×512 avec purpose "any".
 * Les URLs dynamiques `/pwa-icons/…` utilisent le logo admin (branding site)
 * quand il est défini, sinon le logo Caisse CI par défaut.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let brandName = 'Caisse CI'
  let version = '1'
  try {
    const branding = await getSiteBranding()
    if (branding.brandName?.trim()) brandName = branding.brandName.trim()
    if (branding.updatedAt) {
      const ts = Date.parse(branding.updatedAt)
      version = Number.isFinite(ts) ? String(ts) : branding.updatedAt
    } else if (branding.logoUrl) {
      version = String(Date.now())
    }
  } catch {
    /* DB indisponible au build → icônes par défaut */
  }

  const q = `v=${encodeURIComponent(version)}`

  return {
    name: `${brandName} — Point de vente`,
    short_name: brandName.length > 12 ? brandName.slice(0, 12) : brandName,
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
        src: `/pwa-icons/192?${q}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/pwa-icons/512?${q}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/pwa-icons/192?maskable=1&${q}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `/pwa-icons/512?maskable=1&${q}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
