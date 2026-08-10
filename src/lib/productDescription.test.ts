import { describe, expect, it } from 'vitest'
import type { Product } from '../db/types'
import {
  normalizeProductDescription,
  normalizeProductHighlights,
  productCardBlurb,
  productDescription,
  productHighlights,
} from './productDescription'

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Article test',
    priceTTC: 1000,
    category: 'Autre',
    barcode: '123',
    lowStockThreshold: 5,
    vatRatePct: 18,
    archived: false,
    ...overrides,
  }
}

describe('product custom boutique details', () => {
  it('priorise la description saisie par le commerçant', () => {
    const product = baseProduct({
      name: 'Riz gras',
      description: '  Notre riz gras signature, portion XL.  ',
    })
    expect(productDescription(product)).toBe('Notre riz gras signature, portion XL.')
    expect(productCardBlurb(product)).toBe('Notre riz gras signature, portion XL.')
  })

  it('priorise les points forts saisis', () => {
    const product = baseProduct({
      name: 'Attieké',
      highlights: ['Fait maison', 'Poisson du jour'],
    })
    expect(productHighlights(product)).toEqual(['Fait maison', 'Poisson du jour'])
  })

  it('normalise les points forts depuis un texte multiligne', () => {
    expect(
      normalizeProductHighlights('- Frais\n• Maison\n\nTrop long '.repeat(1) + 'x'.repeat(100)),
    ).toEqual(['Frais', 'Maison', `Trop long ${'x'.repeat(70)}`.slice(0, 80)])
  })

  it('conserve les retours à la ligne dans la description', () => {
    expect(normalizeProductDescription('Ligne 1\n\n\nLigne 2')).toBe('Ligne 1\n\nLigne 2')
  })

  it('ne montre pas de blurb carte sans description perso', () => {
    expect(productCardBlurb(baseProduct({ name: 'Riz gras' }))).toBeUndefined()
  })
})
