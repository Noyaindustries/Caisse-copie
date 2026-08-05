import { db } from '../db/db'
import type { Sale } from '../db/types'
import { storeStockRowId } from './storeStockId'
import { getOrCreateTerminalId } from './session'

export type CloudMergeResult = {
  salesImported: number
  stockMerged: number
  conflicts: number
}

function asSale(value: unknown): Sale | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Partial<Sale>
  if (typeof v.id !== 'string' || !Array.isArray(v.lines)) return null
  return value as Sale
}

export async function mergeSalesFromCloud(
  remoteSales: Array<{ saleId: string; sale: Record<string, unknown>; terminalId?: string }>,
): Promise<number> {
  const localTerminalId = getOrCreateTerminalId()
  let imported = 0

  for (const remote of remoteSales) {
    if (remote.terminalId === localTerminalId) continue
    const existing = await db.sales.get(remote.saleId)
    if (existing) continue

    const sale = asSale(remote.sale)
    if (!sale) continue

    await db.sales.put({
      ...sale,
      id: remote.saleId,
      synced: true,
    })
    imported += 1
  }

  return imported
}

export async function mergeStockFromCloud(
  updates: Array<{
    productId: string
    storeId: string
    stock: number
    lowStockThreshold?: number
    terminalId?: string
    updatedAt: number
  }>,
): Promise<{ merged: number; conflicts: number }> {
  const localTerminalId = getOrCreateTerminalId()
  let merged = 0
  let conflicts = 0

  for (const update of updates) {
    if (update.terminalId === localTerminalId) continue

    const stockId = storeStockRowId(update.storeId, update.productId)
    const existing = await db.storeStocks.get(stockId)
    if (existing && existing.stock === update.stock) continue

    const pendingLocal = await db.syncQueue
      .filter((item) => item.kind === 'stock')
      .toArray()
    const hasPending = pendingLocal.some((item) => {
      try {
        const parsed = JSON.parse(item.payload) as { productId?: string; storeId?: string }
        return parsed.productId === update.productId && parsed.storeId === update.storeId
      } catch {
        return false
      }
    })
    if (hasPending) {
      conflicts += 1
      continue
    }

    await db.storeStocks.put({
      id: stockId,
      storeId: update.storeId,
      productId: update.productId,
      stock: update.stock,
    })
    merged += 1
  }

  return { merged, conflicts }
}

export async function mergeCloudDeltas(input: {
  sales: Array<{ saleId: string; sale: Record<string, unknown>; terminalId?: string }>
  stockUpdates: Array<{
    productId: string
    storeId: string
    stock: number
    lowStockThreshold?: number
    terminalId?: string
    updatedAt: number
  }>
}): Promise<CloudMergeResult> {
  const salesImported = await mergeSalesFromCloud(input.sales)
  const stock = await mergeStockFromCloud(input.stockUpdates)
  return {
    salesImported,
    stockMerged: stock.merged,
    conflicts: stock.conflicts,
  }
}
