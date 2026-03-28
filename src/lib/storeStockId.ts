/** Clé stable pour la table storeStocks (IndexedDB). */
export function storeStockRowId(storeId: string, productId: string): string {
  return `${storeId}__${productId}`
}
