import { describe, expect, it } from 'vitest'
import {
  normalizeStorefrontBranding,
  storefrontAccentColor,
  storefrontDisplayName,
  type PublishedStorefrontMenu,
  type StorefrontBranding,
} from './types'

/** Mirror serveur : republication catalogue conserve le branding existant. */
function mergePublishMenu(
  existing: PublishedStorefrontMenu | null,
  next: Omit<PublishedStorefrontMenu, 'branding'>,
): PublishedStorefrontMenu {
  const branding = existing?.branding
  return {
    ...next,
    ...(branding ? { branding } : {}),
  }
}

describe('normalizeStorefrontBranding', () => {
  it('accepte un branding valide', () => {
    expect(
      normalizeStorefrontBranding({
        shopName: '  Ma Boutique  ',
        primaryColor: '#1A2B3C',
        welcomeMessage: 'Bonjour',
      }),
    ).toEqual({
      shopName: 'Ma Boutique',
      primaryColor: '#1A2B3C',
      welcomeMessage: 'Bonjour',
    })
  })

  it('rejette une couleur invalide', () => {
    expect(
      normalizeStorefrontBranding({ primaryColor: 'red' }),
    ).toBeUndefined()
  })

  it('conserve une data URL logo longue (pas de troncature à 2k)', () => {
    const payload = 'A'.repeat(12_000)
    const logoUrl = `data:image/png;base64,${payload}`
    expect(
      normalizeStorefrontBranding({ logoUrl })?.logoUrl,
    ).toBe(logoUrl)
  })

  it('accepte une URL https courte', () => {
    expect(
      normalizeStorefrontBranding({
        logoUrl: 'https://example.com/logo.png',
      })?.logoUrl,
    ).toBe('https://example.com/logo.png')
  })
})

describe('storefrontDisplayName / accent', () => {
  it('préfère shopName', () => {
    const branding: StorefrontBranding = { shopName: 'Chez Awa' }
    expect(storefrontDisplayName(branding, 'Org Légale')).toBe('Chez Awa')
    expect(storefrontDisplayName(undefined, 'Org Légale')).toBe('Org Légale')
  })

  it('fallback amber', () => {
    expect(storefrontAccentColor(undefined)).toBe('#B8922E')
    expect(storefrontAccentColor({ primaryColor: '#FF5500' })).toBe('#FF5500')
  })
})

describe('publish merge branding', () => {
  it('conserve le branding lors d’une republication catalogue', () => {
    const existing: PublishedStorefrontMenu = {
      storeId: 's1',
      storeName: 'Ancien',
      publishedAt: '2020-01-01T00:00:00.000Z',
      products: [],
      promotions: [],
      branding: {
        shopName: 'Vitrine',
        primaryColor: '#112233',
        logoUrl: 'https://example.com/logo.png',
      },
    }
    const published = mergePublishMenu(existing, {
      storeId: 's1',
      storeName: 'Nouveau catalogue',
      publishedAt: '2026-08-05T00:00:00.000Z',
      products: [],
      promotions: [],
    })
    expect(published.storeName).toBe('Nouveau catalogue')
    expect(published.branding).toEqual(existing.branding)
  })
})
