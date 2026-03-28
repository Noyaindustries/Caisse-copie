import type { Product } from '../db/types'

/** Produit vendable à la caisse (non archivé). */
export function productIsActive(p: Product): boolean {
  return p.archived !== true
}
