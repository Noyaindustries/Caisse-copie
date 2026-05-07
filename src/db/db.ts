import Dexie, { type Table } from 'dexie'
import { storeStockRowId } from '../lib/storeStockId'
import { locationStockRowId } from '../lib/locationStockId'
import type {
  AuditEvent,
  DayClosure,
  DiningTable,
  OnlineOrder,
  Promotion,
  Product,
  ProductCategoryRow,
  RefundRecord,
  Sale,
  StockTransfer,
  Store,
  StoreStock,
  SyncQueueItem,
  TimePunch,
  LoyaltyCustomer,
  LoyaltyTransaction,
  HrRequest,
  CrmInteraction,
  TicketInvoice,
  TerminalNode,
  StockLocation,
  LocationStock,
  StockLocationTransfer,
  TableReservation,
  KitchenIngredient,
  KitchenIngredientStock,
  ProductRecipeIngredient,
  OnlineOrderMessage,
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
  stockLocations!: Table<StockLocation, string>
  locationStocks!: Table<LocationStock, string>
  locationTransfers!: Table<StockLocationTransfer, string>
  stockTransfers!: Table<StockTransfer, string>
  dayClosures!: Table<DayClosure, string>
  refunds!: Table<RefundRecord, string>
  auditEvents!: Table<AuditEvent, string>
  onlineOrders!: Table<OnlineOrder, string>
  productCategories!: Table<ProductCategoryRow, string>
  timePunches!: Table<TimePunch, string>
  diningTables!: Table<DiningTable, string>
  promotions!: Table<Promotion, string>
  loyaltyCustomers!: Table<LoyaltyCustomer, string>
  loyaltyTransactions!: Table<LoyaltyTransaction, string>
  hrRequests!: Table<HrRequest, string>
  crmInteractions!: Table<CrmInteraction, string>
  ticketInvoices!: Table<TicketInvoice, string>
  terminalNodes!: Table<TerminalNode, string>
  tableReservations!: Table<TableReservation, string>
  kitchenIngredients!: Table<KitchenIngredient, string>
  kitchenIngredientStocks!: Table<KitchenIngredientStock, string>
  productRecipeIngredients!: Table<ProductRecipeIngredient, string>
  onlineOrderMessages!: Table<OnlineOrderMessage, string>

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
    this.version(9).stores({
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
      diningTables: 'id, storeId, status, sortOrder, [storeId+sortOrder]',
    })
    this.version(10).stores({
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
      diningTables: 'id, storeId, status, sortOrder, [storeId+sortOrder]',
      promotions: 'id, code, active, storeId, [active+code]',
    })
    this.version(11).stores({
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
      diningTables: 'id, storeId, status, sortOrder, [storeId+sortOrder]',
      promotions: 'id, code, active, storeId, [active+code]',
      loyaltyCustomers: 'id, phone, updatedAt',
      loyaltyTransactions: 'id, customerId, createdAt, type',
    })
    this.version(12).stores({
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
      diningTables: 'id, storeId, status, sortOrder, [storeId+sortOrder]',
      promotions: 'id, code, active, storeId, [active+code]',
      loyaltyCustomers: 'id, phone, updatedAt',
      loyaltyTransactions: 'id, customerId, createdAt, type',
      hrRequests: 'id, createdAt, staffProfileId, status, type, [staffProfileId+createdAt]',
      crmInteractions:
        'id, createdAt, customerId, customerPhone, kind, [customerId+createdAt]',
    })
    this.version(13).stores({
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
      diningTables: 'id, storeId, status, sortOrder, [storeId+sortOrder]',
      promotions: 'id, code, active, storeId, [active+code]',
      loyaltyCustomers: 'id, phone, updatedAt',
      loyaltyTransactions: 'id, customerId, createdAt, type',
      hrRequests: 'id, createdAt, staffProfileId, status, type, [staffProfileId+createdAt]',
      crmInteractions:
        'id, createdAt, customerId, customerPhone, kind, [customerId+createdAt]',
      terminalNodes: 'id, storeId, online, lastSeenAt, [storeId+lastSeenAt]',
    })
    this.version(14).stores({
      products: 'id, barcode, category, archived',
      sales: 'id, createdAt, synced, storeId',
      syncQueue: '++id, createdAt',
      stores: 'id, sortOrder',
      storeStocks: 'id, storeId, productId, [storeId+productId]',
      stockLocations: 'id, storeId, active, sortOrder, [storeId+sortOrder]',
      locationStocks:
        'id, storeId, locationId, productId, [storeId+productId], [storeId+locationId]',
      locationTransfers: 'id, createdAt, storeId, productId, fromLocationId, toLocationId',
      stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
      dayClosures: 'dateYmd',
      refunds: 'id, saleId, createdAt',
      auditEvents: 'id, createdAt, kind',
      onlineOrders: 'id, createdAt, status, storeId',
      productCategories: 'id, sortOrder',
      timePunches: 'id, profileId, storeId, createdAt',
      diningTables: 'id, storeId, status, sortOrder, [storeId+sortOrder]',
      promotions: 'id, code, active, storeId, [active+code]',
      loyaltyCustomers: 'id, phone, updatedAt',
      loyaltyTransactions: 'id, customerId, createdAt, type',
      hrRequests: 'id, createdAt, staffProfileId, status, type, [staffProfileId+createdAt]',
      crmInteractions:
        'id, createdAt, customerId, customerPhone, kind, [customerId+createdAt]',
      terminalNodes: 'id, storeId, online, lastSeenAt, [storeId+lastSeenAt]',
    })
    this.version(15).stores({
      products: 'id, barcode, category, archived',
      sales: 'id, createdAt, synced, storeId',
      syncQueue: '++id, createdAt',
      stores: 'id, sortOrder',
      storeStocks: 'id, storeId, productId, [storeId+productId]',
      stockLocations: 'id, storeId, active, sortOrder, [storeId+sortOrder]',
      locationStocks:
        'id, storeId, locationId, productId, [storeId+productId], [storeId+locationId]',
      locationTransfers: 'id, createdAt, storeId, productId, fromLocationId, toLocationId',
      stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
      dayClosures: 'dateYmd',
      refunds: 'id, saleId, createdAt',
      auditEvents: 'id, createdAt, kind',
      onlineOrders: 'id, createdAt, status, storeId',
      productCategories: 'id, sortOrder',
      timePunches: 'id, profileId, storeId, createdAt',
      diningTables: 'id, storeId, status, sortOrder, [storeId+sortOrder]',
      promotions: 'id, code, active, storeId, [active+code]',
      loyaltyCustomers: 'id, phone, updatedAt',
      loyaltyTransactions: 'id, customerId, createdAt, type',
      hrRequests: 'id, createdAt, staffProfileId, status, type, [staffProfileId+createdAt]',
      crmInteractions:
        'id, createdAt, customerId, customerPhone, kind, [customerId+createdAt]',
      ticketInvoices: 'id, createdAt, updatedAt, kind, status, storeId, reference, [storeId+createdAt]',
      terminalNodes: 'id, storeId, online, lastSeenAt, [storeId+lastSeenAt]',
    })
    this.version(16).stores({
      products: 'id, barcode, category, archived',
      sales: 'id, createdAt, synced, storeId',
      syncQueue: '++id, createdAt',
      stores: 'id, sortOrder',
      storeStocks: 'id, storeId, productId, [storeId+productId]',
      stockLocations: 'id, storeId, active, sortOrder, [storeId+sortOrder]',
      locationStocks:
        'id, storeId, locationId, productId, [storeId+productId], [storeId+locationId]',
      locationTransfers: 'id, createdAt, storeId, productId, fromLocationId, toLocationId',
      stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
      dayClosures: 'dateYmd',
      refunds: 'id, saleId, createdAt',
      auditEvents: 'id, createdAt, kind',
      onlineOrders: 'id, createdAt, status, storeId',
      productCategories: 'id, sortOrder',
      timePunches: 'id, profileId, storeId, createdAt',
      diningTables: 'id, storeId, status, sortOrder, [storeId+sortOrder]',
      promotions: 'id, code, active, storeId, [active+code]',
      loyaltyCustomers: 'id, phone, updatedAt',
      loyaltyTransactions: 'id, customerId, createdAt, type',
      hrRequests: 'id, createdAt, staffProfileId, status, type, [staffProfileId+createdAt]',
      crmInteractions:
        'id, createdAt, customerId, customerPhone, kind, [customerId+createdAt]',
      ticketInvoices: 'id, createdAt, updatedAt, kind, status, storeId, reference, [storeId+createdAt]',
      terminalNodes: 'id, storeId, online, lastSeenAt, [storeId+lastSeenAt]',
      tableReservations:
        'id, storeId, tableId, status, startAt, endAt, [storeId+startAt], [tableId+startAt]',
    })
    this.version(17).stores({
      products: 'id, barcode, category, archived',
      sales: 'id, createdAt, synced, storeId',
      syncQueue: '++id, createdAt',
      stores: 'id, sortOrder',
      storeStocks: 'id, storeId, productId, [storeId+productId]',
      stockLocations: 'id, storeId, active, sortOrder, [storeId+sortOrder]',
      locationStocks:
        'id, storeId, locationId, productId, [storeId+productId], [storeId+locationId]',
      locationTransfers: 'id, createdAt, storeId, productId, fromLocationId, toLocationId',
      stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
      dayClosures: 'dateYmd',
      refunds: 'id, saleId, createdAt',
      auditEvents: 'id, createdAt, kind',
      onlineOrders:
        'id, createdAt, status, storeId, sourcePlatform, externalOrderRef, [storeId+createdAt]',
      productCategories: 'id, sortOrder',
      timePunches: 'id, profileId, storeId, createdAt',
      diningTables: 'id, storeId, status, sortOrder, [storeId+sortOrder]',
      promotions: 'id, code, active, storeId, [active+code]',
      loyaltyCustomers: 'id, phone, updatedAt',
      loyaltyTransactions: 'id, customerId, createdAt, type',
      hrRequests: 'id, createdAt, staffProfileId, status, type, [staffProfileId+createdAt]',
      crmInteractions:
        'id, createdAt, customerId, customerPhone, kind, [customerId+createdAt]',
      ticketInvoices: 'id, createdAt, updatedAt, kind, status, storeId, reference, [storeId+createdAt]',
      terminalNodes: 'id, storeId, online, lastSeenAt, [storeId+lastSeenAt]',
      tableReservations:
        'id, storeId, tableId, status, startAt, endAt, [storeId+startAt], [tableId+startAt]',
    })
    this.version(18).stores({
      products: 'id, barcode, category, archived',
      sales: 'id, createdAt, synced, storeId',
      syncQueue: '++id, createdAt',
      stores: 'id, sortOrder',
      storeStocks: 'id, storeId, productId, [storeId+productId]',
      stockLocations: 'id, storeId, active, sortOrder, [storeId+sortOrder]',
      locationStocks:
        'id, storeId, locationId, productId, [storeId+productId], [storeId+locationId]',
      locationTransfers: 'id, createdAt, storeId, productId, fromLocationId, toLocationId',
      stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
      dayClosures: 'dateYmd',
      refunds: 'id, saleId, createdAt',
      auditEvents: 'id, createdAt, kind',
      onlineOrders:
        'id, createdAt, status, storeId, sourcePlatform, externalOrderRef, [storeId+createdAt]',
      productCategories: 'id, sortOrder',
      timePunches: 'id, profileId, storeId, createdAt',
      diningTables: 'id, storeId, status, sortOrder, [storeId+sortOrder]',
      promotions: 'id, code, active, storeId, [active+code]',
      loyaltyCustomers: 'id, phone, updatedAt',
      loyaltyTransactions: 'id, customerId, createdAt, type',
      hrRequests: 'id, createdAt, staffProfileId, status, type, [staffProfileId+createdAt]',
      crmInteractions:
        'id, createdAt, customerId, customerPhone, kind, [customerId+createdAt]',
      ticketInvoices: 'id, createdAt, updatedAt, kind, status, storeId, reference, [storeId+createdAt]',
      terminalNodes: 'id, storeId, online, lastSeenAt, [storeId+lastSeenAt]',
      tableReservations:
        'id, storeId, tableId, status, startAt, endAt, [storeId+startAt], [tableId+startAt]',
      kitchenIngredients: 'id, name, archived',
      kitchenIngredientStocks: 'id, storeId, ingredientId, [storeId+ingredientId]',
      productRecipeIngredients: 'id, productId, ingredientId, [productId+ingredientId]',
    })
    this.version(19).stores({
      products: 'id, barcode, category, archived',
      sales: 'id, createdAt, synced, storeId',
      syncQueue: '++id, createdAt',
      stores: 'id, sortOrder',
      storeStocks: 'id, storeId, productId, [storeId+productId]',
      stockLocations: 'id, storeId, active, sortOrder, [storeId+sortOrder]',
      locationStocks:
        'id, storeId, locationId, productId, [storeId+productId], [storeId+locationId]',
      locationTransfers: 'id, createdAt, storeId, productId, fromLocationId, toLocationId',
      stockTransfers: 'id, createdAt, fromStoreId, toStoreId',
      dayClosures: 'dateYmd',
      refunds: 'id, saleId, createdAt',
      auditEvents: 'id, createdAt, kind',
      onlineOrders:
        'id, createdAt, status, storeId, sourcePlatform, externalOrderRef, [storeId+createdAt]',
      onlineOrderMessages: 'id, orderId, createdAt',
      productCategories: 'id, sortOrder',
      timePunches: 'id, profileId, storeId, createdAt',
      diningTables: 'id, storeId, status, sortOrder, [storeId+sortOrder]',
      promotions: 'id, code, active, storeId, [active+code]',
      loyaltyCustomers: 'id, phone, updatedAt',
      loyaltyTransactions: 'id, customerId, createdAt, type',
      hrRequests: 'id, createdAt, staffProfileId, status, type, [staffProfileId+createdAt]',
      crmInteractions:
        'id, createdAt, customerId, customerPhone, kind, [customerId+createdAt]',
      ticketInvoices: 'id, createdAt, updatedAt, kind, status, storeId, reference, [storeId+createdAt]',
      terminalNodes: 'id, storeId, online, lastSeenAt, [storeId+lastSeenAt]',
      tableReservations:
        'id, storeId, tableId, status, startAt, endAt, [storeId+startAt], [tableId+startAt]',
      kitchenIngredients: 'id, name, archived',
      kitchenIngredientStocks: 'id, storeId, ingredientId, [storeId+ingredientId]',
      productRecipeIngredients: 'id, productId, ingredientId, [productId+ingredientId]',
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

async function ensureDiningTablesSeed(): Promise<void> {
  if ((await db.diningTables.count()) > 0) return
  const stores = await db.stores.toArray()
  const rows: DiningTable[] = []
  for (const store of stores) {
    for (let i = 1; i <= 8; i += 1) {
      rows.push({
        id: crypto.randomUUID(),
        storeId: store.id,
        name: `Table ${i}`,
        capacity: i <= 4 ? 2 : 4,
        area: i <= 4 ? 'Salle' : 'Terrasse',
        status: 'free',
        sortOrder: i - 1,
      })
    }
  }
  if (rows.length > 0) {
    await db.diningTables.bulkAdd(rows)
  }
}

async function ensurePromotionsSeed(): Promise<void> {
  if ((await db.promotions.count()) > 0) return
  const now = Date.now()
  const rows: Promotion[] = [
    {
      id: crypto.randomUUID(),
      code: 'PROMO5',
      label: 'Remise bienvenue 5%',
      discountPct: 5,
      active: true,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      code: 'PROMO10',
      label: 'Offre fidélité 10%',
      discountPct: 10,
      active: true,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]
  await db.promotions.bulkAdd(rows)
}

async function ensureStockLocationsSeed(): Promise<void> {
  const stores = await db.stores.toArray()
  for (const store of stores) {
    const existing = await db.stockLocations.where('storeId').equals(store.id).count()
    if (existing > 0) continue
    await db.stockLocations.bulkAdd([
      {
        id: crypto.randomUUID(),
        storeId: store.id,
        name: 'Réserve',
        code: 'RES',
        sortOrder: 0,
        active: true,
      },
      {
        id: crypto.randomUUID(),
        storeId: store.id,
        name: 'Surface de vente',
        code: 'SHOP',
        sortOrder: 1,
        active: true,
      },
    ])
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

export async function ensureAllLocationStockRows(): Promise<void> {
  const [stores, products, locations, rows] = await Promise.all([
    db.stores.toArray(),
    db.products.toArray(),
    db.stockLocations.toArray(),
    db.locationStocks.toArray(),
  ])
  const have = new Set(rows.map((r) => r.id))
  const batch: LocationStock[] = []
  for (const s of stores) {
    const storeLocations = locations.filter((l) => l.storeId === s.id)
    for (const loc of storeLocations) {
      for (const p of products) {
        const id = locationStockRowId(s.id, loc.id, p.id)
        if (!have.has(id)) {
          batch.push({
            id,
            storeId: s.id,
            locationId: loc.id,
            productId: p.id,
            stock: 0,
          })
        }
      }
    }
  }
  if (batch.length > 0) {
    await db.locationStocks.bulkPut(batch)
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
  await ensureStockLocationsSeed()
  await ensureAllLocationStockRows()
  await syncProductCategoriesFromProducts()
  await ensureDiningTablesSeed()
  await ensurePromotionsSeed()
}
