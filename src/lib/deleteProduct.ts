import { db } from '../db/db'
import type { Product } from '../db/types'
import { appendAuditEvent, type AuditActor } from './auditLog'

/**
 * Suppression définitive d'un article catalogue + stocks / recettes liés.
 * Les ventes historiques gardent le nom sur les lignes (pas de cascade ventes).
 */
export async function deleteProductPermanently(
  product: Product,
  actor: AuditActor,
): Promise<void> {
  const productId = product.id

  await db.transaction(
    'rw',
    [
      db.products,
      db.storeStocks,
      db.locationStocks,
      db.locationTransfers,
      db.productRecipeIngredients,
      db.kitchenIngredients,
      db.auditEvents,
    ],
    async () => {
      await db.storeStocks.where('productId').equals(productId).delete()
      await db.locationStocks.where('productId').equals(productId).delete()
      await db.locationTransfers.where('productId').equals(productId).delete()
      await db.productRecipeIngredients.where('productId').equals(productId).delete()

      const linkedIngredients = await db.kitchenIngredients
        .where('productId')
        .equals(productId)
        .toArray()
      for (const ing of linkedIngredients) {
        const { productId: _removed, ...rest } = ing
        await db.kitchenIngredients.put(rest)
      }

      await db.products.delete(productId)

      await appendAuditEvent({
        kind: 'product_deleted',
        actor,
        reason: 'Suppression article catalogue',
        payload: {
          productId,
          name: product.name,
          barcode: product.barcode,
          category: product.category,
          priceTTC: product.priceTTC,
        },
      })
    },
  )
}
