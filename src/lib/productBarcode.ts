import { db } from '../db/db'
import type { Product } from '../db/types'

/** Recherche un produit par code-barres non vide. */
export async function findProductByBarcode(
  barcode: string,
): Promise<Product | undefined> {
  const code = barcode.trim()
  if (!code) return undefined
  return db.products.where('barcode').equals(code).first()
}

/**
 * Les codes-barres vides sont autorisés (plusieurs articles sans code).
 * Seuls les codes non vides doivent être uniques.
 */
export async function assertBarcodeAvailable(
  barcode: string,
  exceptProductId?: string,
): Promise<void> {
  const dup = await findProductByBarcode(barcode)
  if (dup && dup.id !== exceptProductId) {
    throw new Error('Ce code-barres existe déjà.')
  }
}
