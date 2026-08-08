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

const KITCHEN_DEMO_STOCK_BY_INGREDIENT: Record<string, number> = {
  'ing-poulet': 15,
  'ing-poisson': 6,
  'ing-huile': 5,
  'ing-oignon': 8,
  'ing-attieke': 20,
  'ing-riz': 25,
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
        stock:
          store.id === DEFAULT_STORE_ID
            ? (KITCHEN_DEMO_STOCK_BY_INGREDIENT[ingredient.id] ?? 0)
            : 0,
      })
    }
  }

  if (toPut.length > 0) {
    await db.kitchenIngredientStocks.bulkPut(toPut)
  }
}

async function ensureKitchenStockSeed(): Promise<void> {
  if ((await db.kitchenIngredients.count()) > 0) {
    await ensureKitchenIngredientStocksForAllStores()
    return
  }

  const ingredients: KitchenIngredient[] = [
    {
      id: 'ing-poulet',
      name: 'Poulet',
      unit: 'kg',
      lowStockThreshold: 5,
      archived: false,
    },
    {
      id: 'ing-poisson',
      name: 'Poisson',
      unit: 'kg',
      lowStockThreshold: 4,
      archived: false,
    },
    {
      id: 'ing-huile',
      name: 'Huile',
      unit: 'l',
      lowStockThreshold: 2,
      archived: false,
    },
    {
      id: 'ing-oignon',
      name: 'Oignons',
      unit: 'kg',
      lowStockThreshold: 3,
      archived: false,
    },
    {
      id: 'ing-attieke',
      name: 'Attiéké',
      unit: 'kg',
      lowStockThreshold: 8,
      archived: false,
    },
    {
      id: 'ing-riz',
      name: 'Riz',
      unit: 'kg',
      lowStockThreshold: 10,
      archived: false,
    },
  ]

  const stocks: KitchenIngredientStock[] = ingredients.map((ingredient) => ({
    id: kitchenIngredientStockRowId(DEFAULT_STORE_ID, ingredient.id),
    storeId: DEFAULT_STORE_ID,
    ingredientId: ingredient.id,
    stock: KITCHEN_DEMO_STOCK_BY_INGREDIENT[ingredient.id] ?? 0,
  }))

  const recipes: ProductRecipeIngredient[] = [
    { id: 'recipe-p1-poulet', productId: 'p1', ingredientId: 'ing-poulet', qtyPerUnit: 0.2 },
    { id: 'recipe-p1-huile', productId: 'p1', ingredientId: 'ing-huile', qtyPerUnit: 0.05 },
    { id: 'recipe-p1-oignon', productId: 'p1', ingredientId: 'ing-oignon', qtyPerUnit: 0.1 },
    { id: 'recipe-p1-riz', productId: 'p1', ingredientId: 'ing-riz', qtyPerUnit: 0.15 },
    { id: 'recipe-p2-poisson', productId: 'p2', ingredientId: 'ing-poisson', qtyPerUnit: 0.25 },
    { id: 'recipe-p2-attieke', productId: 'p2', ingredientId: 'ing-attieke', qtyPerUnit: 0.3 },
    { id: 'recipe-p3-poisson', productId: 'p3', ingredientId: 'ing-poisson', qtyPerUnit: 0.18 },
    { id: 'recipe-p3-attieke', productId: 'p3', ingredientId: 'ing-attieke', qtyPerUnit: 0.25 },
  ]

  await db.kitchenIngredients.bulkAdd(ingredients)
  await db.kitchenIngredientStocks.bulkAdd(stocks)
  await db.productRecipeIngredients.bulkAdd(recipes)
  await ensureKitchenIngredientStocksForAllStores()
}

/** Charge ingrédients, stocks et recettes de démo (si la liste est vide). */
export async function loadKitchenStockDemo(): Promise<boolean> {
  const ingredientCountBefore = await db.kitchenIngredients.count()
  const stockCountBefore = await db.kitchenIngredientStocks.count()
  await ensureKitchenStockSeed()
  const ingredientCountAfter = await db.kitchenIngredients.count()
  const stockCountAfter = await db.kitchenIngredientStocks.count()
  return (
    ingredientCountAfter > ingredientCountBefore ||
    stockCountAfter > stockCountBefore
  )
}

async function ensureTimePunchSeed(): Promise<void> {
  if ((await db.timePunches.count()) > 0) return

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  const atDayTime = (
    dayOffset: number,
    hour: number,
    minute: number,
  ): number => {
    const d = new Date(now + dayOffset * dayMs)
    d.setHours(hour, minute, 0, 0)
    return d.getTime()
  }

  const mk = (
    profileId: string,
    profileDisplayName: string,
    kind: TimePunch['kind'],
    dayOffset: number,
    hour: number,
    minute: number,
    note?: string,
  ): TimePunch => ({
    id: crypto.randomUUID(),
    createdAt: atDayTime(dayOffset, hour, minute),
    profileId,
    profileDisplayName,
    storeId: DEFAULT_STORE_ID,
    storeName: 'Magasin principal',
    kind,
    note,
    source: 'self',
  })

  const rows: TimePunch[] = [
    mk('profile-caissier', 'Awa Konaté', 'in', 0, 7, 55),
    mk('profile-caissier', 'Awa Konaté', 'in', -1, 8, 5),
    mk('profile-caissier', 'Awa Konaté', 'out', -1, 17, 30),
    mk('profile-caissier', 'Awa Konaté', 'in', -2, 8, 20, 'Retard transport'),
    mk('profile-caissier', 'Awa Konaté', 'out', -2, 16, 45),
    mk('profile-gerant', 'Koffi N’Guessan', 'in', 0, 8, 2),
    mk('profile-gerant', 'Koffi N’Guessan', 'in', -1, 7, 45),
    mk('profile-gerant', 'Koffi N’Guessan', 'out', -1, 18, 0),
    mk('profile-admin', 'Kouadio Yao', 'in', -1, 9, 0),
    mk('profile-admin', 'Kouadio Yao', 'out', -1, 19, 15),
  ]

  await db.timePunches.bulkAdd(rows)
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
  await ensureKitchenStockSeed()
  await ensureTimePunchSeed()
}
