import Dexie, { type Table } from 'dexie'
import { kitchenIngredientStockRowId } from '../lib/kitchenStock'
import { storeStockRowId } from '../lib/storeStockId'
import { locationStockRowId } from '../lib/locationStockId'
import type {
  AuditEvent,
  CashOutflow,
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

const ORG_CREDENTIALS_KEY = 'caisseci-org-credentials-v1'
const ORG_DATABASE_MAP_KEY = 'caisseci-org-database-map-v1'

function databaseNameForCurrentOrganization(): string {
  if (typeof window === 'undefined') return 'caisseci-unassigned'

  try {
    const credentialsRaw = localStorage.getItem(ORG_CREDENTIALS_KEY)
    if (!credentialsRaw) return 'caisseci-unassigned'
    const credentials = JSON.parse(credentialsRaw) as unknown
    if (
      typeof credentials !== 'object' ||
      credentials === null ||
      !('organizationId' in credentials) ||
      typeof credentials.organizationId !== 'string'
    ) {
      return 'caisseci-unassigned'
    }

    const organizationId = credentials.organizationId
    const mapRaw = localStorage.getItem(ORG_DATABASE_MAP_KEY)
    const parsedMap = mapRaw ? (JSON.parse(mapRaw) as unknown) : {}
    const map =
      typeof parsedMap === 'object' && parsedMap !== null
        ? (parsedMap as Record<string, string>)
        : {}
    const existing = map[organizationId]
    if (typeof existing === 'string' && existing) return existing

    // La première organisation récupère la base historique existante.
    // Les suivantes reçoivent chacune une base IndexedDB isolée.
    const databaseName =
      Object.keys(map).length === 0 ? 'caisseci' : `caisseci-org-${organizationId}`
    map[organizationId] = databaseName
    localStorage.setItem(ORG_DATABASE_MAP_KEY, JSON.stringify(map))
    return databaseName
  } catch {
    return 'caisseci-unassigned'
  }
}
import { DEFAULT_PRODUCT_CATEGORIES } from './types'
import { DEMO_KITCHEN_INGREDIENT_IDS, DEMO_PRODUCT_IDS, DEMO_PROMO_CODES, DEMO_STORE_ANNEX_ID } from './seed'
import { DEFAULT_STORE_ID, SEED_STORES } from './seedStores'
import { getOrganizationCredentials } from '../lib/subscription/store'
import { setLastSyncTimestamp } from '../lib/syncMeta'
import {
  getAppliedLocalWipeAt,
  getStoredForceClientWipeAt,
  setAppliedLocalWipeAt,
} from '../lib/clientDataWipe'

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
  cashOutflows!: Table<CashOutflow, string>
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
    super(databaseNameForCurrentOrganization())
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
      kitchenIngredients: 'id, name, archived, productId',
      kitchenIngredientStocks: 'id, storeId, ingredientId, [storeId+ingredientId]',
      productRecipeIngredients: 'id, productId, ingredientId, [productId+ingredientId]',
    })
    this.version(20).stores({
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
      kitchenIngredients: 'id, name, archived, productId',
      kitchenIngredientStocks: 'id, storeId, ingredientId, [storeId+ingredientId]',
      productRecipeIngredients: 'id, productId, ingredientId, [productId+ingredientId]',
    })
    this.version(21).stores({
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
      cashOutflows: 'id, dateYmd, createdAt',
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
      kitchenIngredients: 'id, name, archived, productId',
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
  void import('../lib/catalogCategoriesCloud')
    .then((m) => m.pushCatalogCategoriesToCloud())
    .catch(() => undefined)
  return name
}

function scheduleCategoryCloudPush(): void {
  void import('../lib/catalogCategoriesCloud')
    .then((m) => m.pushCatalogCategoriesToCloud())
    .catch(() => undefined)
  void import('../lib/workspaceCatalogCloud')
    .then((m) => m.scheduleWorkspaceCatalogPush())
    .catch(() => undefined)
}

/** Renomme une catégorie et met à jour les produits rattachés. */
export async function renameProductCategoryLabel(
  categoryId: string,
  rawNewName: string,
): Promise<string> {
  const nextName = rawNewName.replace(/\s+/g, ' ').trim()
  if (!nextName) throw new Error('Nom de catégorie vide.')
  if (nextName.toLowerCase() === 'tous') {
    throw new Error('Le nom « Tous » est réservé pour les filtres.')
  }
  const row = await db.productCategories.get(categoryId)
  if (!row) throw new Error('Catégorie introuvable.')
  if (row.name === nextName) return nextName

  const dup = await db.productCategories
    .filter(
      (r) =>
        r.id !== categoryId && r.name.toLowerCase() === nextName.toLowerCase(),
    )
    .first()
  if (dup) {
    throw new Error(`La catégorie « ${dup.name} » existe déjà.`)
  }

  const oldName = row.name
  await db.transaction('rw', db.productCategories, db.products, async () => {
    await db.productCategories.update(categoryId, { name: nextName })
    const products = await db.products
      .filter((p) => p.category === oldName)
      .toArray()
    const now = Date.now()
    for (const p of products) {
      await db.products.put({ ...p, category: nextName, updatedAt: now })
    }
  })
  scheduleCategoryCloudPush()
  return nextName
}

/**
 * Supprime une catégorie.
 * Si des produits y sont rattachés, `reassignTo` est obligatoire (libellé existant).
 */
export async function deleteProductCategoryLabel(
  categoryId: string,
  reassignTo?: string,
): Promise<void> {
  const row = await db.productCategories.get(categoryId)
  if (!row) throw new Error('Catégorie introuvable.')

  const linked = await db.products.filter((p) => p.category === row.name).toArray()
  if (linked.length > 0) {
    const target = (reassignTo ?? '').replace(/\s+/g, ' ').trim()
    if (!target) {
      throw new Error(
        `${linked.length} article(s) utilisent « ${row.name} ». Choisissez une catégorie de remplacement.`,
      )
    }
    if (target.toLowerCase() === row.name.toLowerCase()) {
      throw new Error('Choisissez une autre catégorie de remplacement.')
    }
    const targetRow = await db.productCategories
      .filter((r) => r.name.toLowerCase() === target.toLowerCase())
      .first()
    if (!targetRow) {
      throw new Error(`Catégorie de remplacement « ${target} » introuvable.`)
    }
    const now = Date.now()
    await db.transaction('rw', db.productCategories, db.products, async () => {
      for (const p of linked) {
        await db.products.put({
          ...p,
          category: targetRow.name,
          updatedAt: now,
        })
      }
      await db.productCategories.delete(categoryId)
    })
  } else {
    await db.productCategories.delete(categoryId)
  }
  scheduleCategoryCloudPush()
}

/** Déplace une catégorie d’un cran (haut / bas) dans l’ordre d’affichage. */
export async function moveProductCategory(
  categoryId: string,
  direction: -1 | 1,
): Promise<void> {
  const rows = await db.productCategories.orderBy('sortOrder').toArray()
  const idx = rows.findIndex((r) => r.id === categoryId)
  if (idx < 0) throw new Error('Catégorie introuvable.')
  const swapIdx = idx + direction
  if (swapIdx < 0 || swapIdx >= rows.length) return
  const a = rows[idx]
  const b = rows[swapIdx]
  await db.transaction('rw', db.productCategories, async () => {
    await db.productCategories.update(a.id, { sortOrder: b.sortOrder })
    await db.productCategories.update(b.id, { sortOrder: a.sortOrder })
  })
  scheduleCategoryCloudPush()
}

/** Met à jour l’image d’une catégorie (URL Blob ou data URL locale). */
export async function setProductCategoryImage(
  categoryId: string,
  fields: { imageUrl?: string; imageDataUrl?: string } | null,
): Promise<void> {
  const row = await db.productCategories.get(categoryId)
  if (!row) throw new Error('Catégorie introuvable.')
  if (!fields) {
    await db.productCategories.update(categoryId, {
      imageUrl: undefined,
      imageDataUrl: undefined,
    })
    // Dexie ne retire pas toujours les champs undefined : replace explicite.
    await db.productCategories.put({
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
    })
  } else {
    await db.productCategories.put({
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      ...(fields.imageUrl ? { imageUrl: fields.imageUrl } : {}),
      ...(fields.imageDataUrl && !fields.imageUrl
        ? { imageDataUrl: fields.imageDataUrl }
        : {}),
    })
  }
  scheduleCategoryCloudPush()
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
    void import('../lib/catalogCategoriesCloud')
      .then((m) => m.pushCatalogCategoriesToCloud())
      .catch(() => undefined)
  }
}

async function ensureStores(): Promise<void> {
  // `put` est idempotent : évite ConstraintError si deux ensureSeed
  // concurrents (ex. React Strict Mode) voient encore une table vide.
  for (const store of SEED_STORES) {
    const existing = await db.stores.get(store.id)
    if (!existing) {
      await db.stores.put(store)
    }
  }
}

const DEMO_DATA_PURGED_KEY = 'caisseci-demo-data-purged-v1'

/** Vide catalogue, ventes, compta, tickets, commandes, etc. (base IndexedDB courante). */
export async function wipeLocalBusinessData(): Promise<void> {
  await Promise.all([
    db.products.clear(),
    db.sales.clear(),
    db.syncQueue.clear(),
    db.storeStocks.clear(),
    db.stockLocations.clear(),
    db.locationStocks.clear(),
    db.locationTransfers.clear(),
    db.stockTransfers.clear(),
    db.dayClosures.clear(),
    db.cashOutflows.clear(),
    db.refunds.clear(),
    db.auditEvents.clear(),
    db.onlineOrders.clear(),
    db.productCategories.clear(),
    db.timePunches.clear(),
    db.diningTables.clear(),
    db.promotions.clear(),
    db.loyaltyCustomers.clear(),
    db.loyaltyTransactions.clear(),
    db.hrRequests.clear(),
    db.crmInteractions.clear(),
    db.ticketInvoices.clear(),
    db.terminalNodes.clear(),
    db.tableReservations.clear(),
    db.kitchenIngredients.clear(),
    db.kitchenIngredientStocks.clear(),
    db.productRecipeIngredients.clear(),
    db.onlineOrderMessages.clear(),
  ])
  // Magasins : on garde la structure minimale via ensureStores ensuite.
  const stores = await db.stores.toArray()
  const toDelete = stores.filter((s) => s.id !== DEFAULT_STORE_ID).map((s) => s.id)
  if (toDelete.length > 0) await db.stores.bulkDelete(toDelete)
  setLastSyncTimestamp(Date.now())
}

/**
 * Applique une purge locale si le serveur a demandé un wipe plus récent
 * (`forceClientWipeAt` via reset-data / intégrations).
 */
export async function maybeApplyPendingLocalDataWipe(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const creds = getOrganizationCredentials()
  if (!creds) return false

  const forceAt = getStoredForceClientWipeAt()
  if (forceAt <= 0) return false

  const appliedAt = getAppliedLocalWipeAt(creds.organizationId)
  if (appliedAt >= forceAt) return false

  await wipeLocalBusinessData()
  setAppliedLocalWipeAt(creds.organizationId, forceAt)
  return true
}

async function purgeLegacyDemoData(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(DEMO_DATA_PURGED_KEY) === '1') return
  } catch {
    // Continuer la purge même si localStorage est indisponible.
  }

  const demoProductIds = new Set(DEMO_PRODUCT_IDS)
  const demoIngredientIds = new Set(DEMO_KITCHEN_INGREDIENT_IDS)
  const demoPromoCodes = new Set(
    DEMO_PROMO_CODES.map((code) => code.toUpperCase()),
  )

  await db.products.bulkDelete([...DEMO_PRODUCT_IDS])

  const storeStocks = await db.storeStocks.toArray()
  await db.storeStocks.bulkDelete(
    storeStocks
      .filter(
        (row) =>
          demoProductIds.has(row.productId) ||
          row.storeId === DEMO_STORE_ANNEX_ID,
      )
      .map((row) => row.id),
  )

  const locationStocks = await db.locationStocks.toArray()
  await db.locationStocks.bulkDelete(
    locationStocks
      .filter(
        (row) =>
          demoProductIds.has(row.productId) ||
          row.storeId === DEMO_STORE_ANNEX_ID,
      )
      .map((row) => row.id),
  )

  const stockTransfers = await db.stockTransfers.toArray()
  await db.stockTransfers.bulkDelete(
    stockTransfers
      .filter(
        (row) =>
          demoProductIds.has(row.productId) ||
          row.fromStoreId === DEMO_STORE_ANNEX_ID ||
          row.toStoreId === DEMO_STORE_ANNEX_ID,
      )
      .map((row) => row.id),
  )

  const locationTransfers = await db.locationTransfers.toArray()
  await db.locationTransfers.bulkDelete(
    locationTransfers
      .filter(
        (row) =>
          demoProductIds.has(row.productId) ||
          row.storeId === DEMO_STORE_ANNEX_ID,
      )
      .map((row) => row.id),
  )

  await db.kitchenIngredients.bulkDelete([...DEMO_KITCHEN_INGREDIENT_IDS])

  const kitchenStocks = await db.kitchenIngredientStocks.toArray()
  await db.kitchenIngredientStocks.bulkDelete(
    kitchenStocks
      .filter(
        (row) =>
          demoIngredientIds.has(row.ingredientId) ||
          row.storeId === DEMO_STORE_ANNEX_ID,
      )
      .map((row) => row.id),
  )

  const recipes = await db.productRecipeIngredients.toArray()
  await db.productRecipeIngredients.bulkDelete(
    recipes
      .filter(
        (row) =>
          demoProductIds.has(row.productId) ||
          demoIngredientIds.has(row.ingredientId),
      )
      .map((row) => row.id),
  )

  const promotions = await db.promotions.toArray()
  await db.promotions.bulkDelete(
    promotions
      .filter((row) => demoPromoCodes.has(row.code.trim().toUpperCase()))
      .map((row) => row.id),
  )

  const stockLocations = await db.stockLocations.toArray()
  await db.stockLocations.bulkDelete(
    stockLocations
      .filter((row) => row.storeId === DEMO_STORE_ANNEX_ID)
      .map((row) => row.id),
  )

  const diningTables = await db.diningTables.toArray()
  await db.diningTables.bulkDelete(
    diningTables
      .filter(
        (row) =>
          row.storeId === DEMO_STORE_ANNEX_ID ||
          /^Table [1-8]$/.test(row.name),
      )
      .map((row) => row.id),
  )

  await db.stores.delete(DEMO_STORE_ANNEX_ID)

  try {
    localStorage.setItem(DEMO_DATA_PURGED_KEY, '1')
  } catch {
    // Ignore — la purge a déjà été appliquée en base.
  }
}

async function ensureKitchenIngredientStocksForAllStores(): Promise<void> {
  const ingredients = await db.kitchenIngredients.toArray()
  if (ingredients.length === 0) return

  const stores = await db.stores.toArray()
  const existing = new Set(
    (await db.kitchenIngredientStocks.toArray()).map((row) => row.id),
  )
  const toPut: KitchenIngredientStock[] = []

  for (const store of stores) {
    for (const ingredient of ingredients) {
      const id = kitchenIngredientStockRowId(store.id, ingredient.id)
      if (existing.has(id)) continue
      toPut.push({
        id,
        storeId: store.id,
        ingredientId: ingredient.id,
        stock: 0,
      })
    }
  }

  if (toPut.length > 0) {
    await db.kitchenIngredientStocks.bulkPut(toPut)
  }
}

async function ensureKitchenStockSeed(): Promise<void> {
  // Plus de catalogue cuisine démo automatique.
  if ((await db.kitchenIngredients.count()) > 0) {
    await ensureKitchenIngredientStocksForAllStores()
  }
}

/** Ancienne entrée « charger démo cuisine » — ne crée plus de données test. */
export async function loadKitchenStockDemo(): Promise<boolean> {
  await ensureKitchenStockSeed()
  return false
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
  await maybeApplyPendingLocalDataWipe()
  await ensureStores()
  await purgeLegacyDemoData()

  // Structure uniquement — aucun catalogue / stock / promo / cuisine démo.
  await ensureAllStoreStockRows()
  await ensureStockLocationsSeed()
  await ensureAllLocationStockRows()
  await syncProductCategoriesFromProducts()
  await ensureKitchenStockSeed()
  void import('../lib/catalogCategoriesCloud')
    .then((m) => m.pullCatalogCategoriesFromCloud())
    .catch(() => undefined)
}
