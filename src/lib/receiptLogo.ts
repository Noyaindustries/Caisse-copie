import { fetchStorefrontBranding } from './storefront/api'
import { hasOrgAuth } from './subscription/authHeaders'

const STORAGE_KEY = 'caisseci-receipt-logo-url'

/** Logo entreprise mis en cache (boutique / storefront). */
export function getCachedReceiptLogoUrl(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim()
    if (!raw) return null
    if (
      raw.startsWith('data:image/') ||
      raw.startsWith('https://') ||
      raw.startsWith('http://') ||
      raw.startsWith('/')
    ) {
      return raw
    }
    return null
  } catch {
    return null
  }
}

export function setCachedReceiptLogoUrl(url: string | null | undefined): void {
  try {
    const trimmed = url?.trim()
    if (!trimmed) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, trimmed)
  } catch {
    /* quota / private mode */
  }
}

/**
 * Résout le logo du magasin pour les tickets.
 * Préfère le cache local, sinon charge le branding boutique si session org.
 * Ne renvoie jamais le logo produit « Caisse CI ».
 */
export async function resolveReceiptLogoUrl(): Promise<string | null> {
  const cached = getCachedReceiptLogoUrl()
  if (cached) return cached

  if (!hasOrgAuth()) return null

  try {
    const data = await fetchStorefrontBranding()
    const logo = data.branding.logoUrl?.trim() || null
    setCachedReceiptLogoUrl(logo)
    return logo
  } catch {
    return null
  }
}
