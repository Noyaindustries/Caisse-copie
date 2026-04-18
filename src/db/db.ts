import Dexie, { type Table } from 'dexie'
import { storeStockRowId } from '../lib/storeStockId'
import type {
  AuditEvent,
  DayClosure,
  OnlineOrder,
  Product,
  ProductCategoryRow,
  RefundRecord,
  Sale,
  StockTransfer,
  Store,
  StoreStock,
  SyncQueueItem,
  TimePunch,
} from './types'
import { DEFAULT_PRODUCT_CATEGORIES } from './types'
import { SEED_INITIAL_STOCK_MAIN, SEED_PRODUCTS } from './seed'
import { DEFAULT_STORE_ID, SEED_STORES } from './seedStores'

export class CaisseDB extends Dexie {
  products!: Table<Product, string>
  sales!: Table<Sale, string>
  syncQueue!: Table<SyncQueueItem, number>
  stores!: Table<Store, string>
  storeStocks!: Table<StoreStock, string>
  stockTransfers!: Table<StockTransfer, string>
  dayClosures!: Table<DayClosure, string>
  refunds!: Table<RefundRecord, string>
  auditEvents!: Table<AuditEvent, string>
  onlineOrders!: Table<OnlineOrder, string>
  productCategories!: Table<ProductCategoryRow, string>
  timePunches!: Table<TimePunch, string>

  constructor() {
    super('caisseci')
    this.version(1).stores({
      products: 'id, barcode, category',
      sales: 'id, createdAt, synced',
      syncQueue: '++id, createdAt',
    })
    this.version(2)
      .stores({
        products: 'id, barcode, category, archived',
        sales: 'id, createdAt, synced',
        syncQueue: '++id, createdAt',
      })
      .upgrade(async (tx) => {
        const table = tx.table('products')
        await table.toCollection().modify((row: Record<string, unknown>) => {
          if (row.vatRatePct === undefined) row.vatRatePct = 18
          if (row.archived === undefined) row.archived = false
        })
      })
    this.version(3)
      .stores({
        products: 'id, barcode, category, archived',
        sales: 'id, createdAt, synced, storeId',
        syncQueue: '++id, createdAt',
        stores: 'id, sortOrder',
        storeStocks: 'id, storeId, productId, [storeId+productId]',
        stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
      })
      .upgrade(async (tx) => {
        const storeTable = tx.table('stores')
        if ((await storeTable.count()) === 0) {
          await storeTable.bulkAdd(SEED_STORES)
        }
        const main = DEFAULT_STORE_ID
        const prodTable = tx.table('products')
        const products = (await prodTable.toArray()) as Record<
          string,
          unknown
        >[]
        const ss = tx.table('storeStocks')
        for (const p of products) {
          const pid = p.id as string
          const rid = storeStockRowId(main, pid)
          const prev =
            typeof p.stock === 'number' ? (p.stock as number) : 0
          await ss.put({
            id: rid,
            storeId: main,
            productId: pid,
            stock: prev,
          })
        }
        await prodTable.toCollection().modify((row: Record<string, unknown>) => {
          delete row.stock
        })
      })
    this.version(4).stores({
      products: 'id, barcode, category, archived',
      sales: 'id, createdAt, synced, storeId',
      syncQueue: '++id, createdAt',
      stores: 'id, sortOrder',
      storeStocks: 'id, storeId, productId, [storeId+productId]',
      stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
      dayClosures: 'dateYmd',
    })
    this.version(5).stores({
      products: 'id, barcode, category, archived',
      sales: 'id, createdAt, synced, storeId',
      syncQueue: '++id, createdAt',
      stores: 'id, sortOrder',
      storeStocks: 'id, storeId, productId, [storeId+productId]',
      stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
      dayClosures: 'dateYmd',
      refunds: 'id, saleId, createdAt',
      /** Append-only : n’utiliser que `add` (voir `appendAuditEvent`). */
      auditEvents: 'id, createdAt, kind',
    })
    this.version(6).stores({
      products: 'id, barcode, category, archived',
      sales: 'id, createdAt, synced, storeId',
      syncQueue: '++id, createdAt',
      stores: 'id, sortOrder',
      storeStocks: 'id, storeId, productId, [storeId+productId]',
      stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
      dayClosures: 'dateYmd',
      refunds: 'id, saleId, createdAt',
      auditEvents: 'id, createdAt, kind',
      onlineOrders: 'id, createdAt, status, storeId',
    })
    this.version(7)
      .stores({
        products: 'id, barcode, category, archived',
        sales: 'id, createdAt, synced, storeId',
        syncQueue: '++id, createdAt',
        stores: 'id, sortOrder',
        storeStocks: 'id, storeId, productId, [storeId+productId]',
        stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
        dayClosures: 'dateYmd',
        refunds: 'id, saleId, createdAt',
        auditEvents: 'id, createdAt, kind',
        onlineOrders: 'id, createdAt, status, storeId',
        productCategories: 'id, sortOrder',
      })
      .upgrade(async (tx) => {
        const catTable = tx.table('productCategories')
        let rows = (await catTable.toArray()) as ProductCategoryRow[]
        if (rows.length === 0) {
          let i = 0
          for (const name of DEFAULT_PRODUCT_CATEGORIES) {
            await catTable.add({
              id: crypto.randomUUID(),
              name,
              sortOrder: i++,
            })
          }
          rows = (await catTable.toArray()) as ProductCategoryRow[]
        }
        const seen = new Set(rows.map((r) => r.name.toLowerCase()))
        let sortOrder =
          rows.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1
        const products = (await tx.table('products').toArray()) as Product[]
        for (const p of products) {
          const c =
            typeof p.category === 'string'
              ? p.category.replace(/\s+/g, ' ').trim()
              : ''
          if (!c) continue
          const key = c.toLowerCase()
          if (seen.has(key)) continue
          await catTable.add({
            id: crypto.randomUUID(),
            name: c,
            sortOrder: sortOrder++,
          })
          seen.add(key)
        }
      })
    this.version(8).stores({
      products: 'id, barcode, category, archived',
      sales: 'id, createdAt, synced, storeId',
      syncQueue: '++id, createdAt',
      stores: 'id, sortOrder',
      storeStocks: 'id, storeId, productId, [storeId+productId]',
      stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
      dayClosures: 'dateYmd',
      refunds: 'id, saleId, createdAt',
      auditEvents: 'id, createdAt, kind',
      onlineOrders: 'id, createdAt, status, storeId',
      productCategories: 'id, sortOrder',
      timePunches: 'id, profileId, storeId, createdAt',
    })
  }
}

export const db = new CaisseDB()

/** Ajoute une catégorie si le libellé (insensible à la casse) est nouveau. */
export async function addProductCategoryLabel(raw: string): Promise<string> {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (!name) {
    throw new Error('Nom de catégorie vide.')
  }
  if (name.toLowerCase() === 'tous') {
    throw new Error('Le nom « Tous » est réservé pour les filtres.')
  }
  const dup = await db.productCategories
    .filter((r) => r.name.toLowerCase() === name.toLowerCase())
    .first()
  if (dup) {
    return dup.name
  }
  const rows = await db.productCategories.toArray()
  const maxOrder = rows.reduce((m, r) => Math.max(m, r.sortOrder), -1)
  await db.productCategories.add({
    id: crypto.randomUUID(),
    name,
    sortOrder: maxOrder + 1,
  })
  return name
}

/** Enregistre en index les catégories présentes sur les produits (import CSV, etc.). */
export async function syncProductCategoriesFromProducts(): Promise<void> {
  const [rows, products] = await Promise.all([
    db.productCategories.toArray(),
    db.products.toArray(),
  ])
  const byLower = new Map(rows.map((r) => [r.name.toLowerCase(), r]))
  let maxOrder = rows.reduce((m, r) => Math.max(m, r.sortOrder), -1)
  const toAdd: ProductCategoryRow[] = []
  for (const p of products) {
    const label =
      typeof p.category === 'string'
        ? p.category.replace(/\s+/g, ' ').trim()
        : ''
    if (!label) continue
    const key = label.toLowerCase()
    if (byLower.has(key)) continue
    maxOrder += 1
    const row: ProductCategoryRow = {
      id: crypto.randomUUID(),
      name: label,
      sortOrder: maxOrder,
    }
    byLower.set(key, row)
    toAdd.push(row)
  }
  if (toAdd.length > 0) {
    await db.productCategories.bulkAdd(toAdd)
  }
}

async function ensureStores(): Promise<void> {
  if ((await db.stores.count()) === 0) {
    await db.stores.bulkAdd(SEED_STORES)
  }
}

/** Crée toutes les cellules (magasin × produit) manquantes avec stock 0. */
export async function ensureAllStoreStockRows(): Promise<void> {
  const [stores, products, rows] = await Promise.all([
    db.stores.toArray(),
    db.products.toArray(),
    db.storeStocks.toArray(),
  ])
  const have = new Set(rows.map((r) => r.id))
  const batch: StoreStock[] = []
  for (const s of stores) {
    for (const p of products) {
      const id = storeStockRowId(s.id, p.id)
      if (!have.has(id)) {
        batch.push({ id, storeId: s.id, productId: p.id, stock: 0 })
      }
    }
  }
  if (batch.length > 0) {
    await db.storeStocks.bulkPut(batch)
  }
}

export async function ensureSeed(): Promise<void> {
  await ensureStores()
  await db.products.bulkPut(SEED_PRODUCTS)

  const existingMainStocks = new Set(
    (
      await db.storeStocks.where('storeId').equals(DEFAULT_STORE_ID).toArray()
    ).map((row) => row.productId),
  )
  const mainStocks: StoreStock[] = Object.entries(SEED_INITIAL_STOCK_MAIN)
    .filter(([productId]) => !existingMainStocks.has(productId))
    .map(([productId, stock]) => ({
      id: storeStockRowId(DEFAULT_STORE_ID, productId),
      storeId: DEFAULT_STORE_ID,
      productId,
      stock,
    }))
  if (mainStocks.length > 0) {
    await db.storeStocks.bulkPut(mainStocks)
  }

  await ensureAllStoreStockRows()
  await syncProductCategoriesFromProducts()
}
