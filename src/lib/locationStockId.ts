/** Clé stable pour la table locationStocks (IndexedDB). */
export function locationStockRowId(
  storeId: string,
  locationId: string,
  productId: string,
): string {
  return `${storeId}__${locationId}__${productId}`
}
