import { describe, expect, it } from 'vitest'

/** Copie locale du slugify (évite d’importer le module serveur Prisma dans Vitest). */
function slugifyStoreName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'boutique'
}

describe('slugifyStoreName', () => {
  it('slugifie un nom d’entreprise français', () => {
    expect(slugifyStoreName('Restaurant Le Palmier')).toBe(
      'restaurant-le-palmier',
    )
    expect(slugifyStoreName("Café d'Abidjan")).toBe('cafe-d-abidjan')
  })

  it('fallback boutique si vide', () => {
    expect(slugifyStoreName('   ')).toBe('boutique')
    expect(slugifyStoreName('@@@')).toBe('boutique')
  })
})
