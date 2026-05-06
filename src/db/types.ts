/** Libellé de catégorie (défaut + catégories ajoutées par l’utilisateur). */
export type ProductCategory = string

export const DEFAULT_PRODUCT_CATEGORIES = [
  'Boissons',
  'Alimentation',
  'Hygiène',
  'Autre',
] as const

/** Catégories proposées par défaut (la liste complète est en base : `productCategories`). */
export const PRODUCT_CATEGORY_LIST: ProductCategory[] = [
  ...DEFAULT_PRODUCT_CATEGORIES,
]

/** Ligne de la table Dexie `productCategories` (ordre d’affichage). */
export interface ProductCategoryRow {
  id: string
  name: string
  sortOrder: number
}

/** Produit + stock sur un magasin donné (affichage caisse / listes). */
export type ProductWithStock = Product & { stock: number }

export interface Store {
  id: string
  name: string
  shortCode: string
  sortOrder: number
}

export interface StoreStock {
  id: string
  storeId: string
  productId: string
  stock: number
}

export interface StockLocation {
  id: string
  storeId: string
  name: string
  code: string
  sortOrder: number
  active: boolean
}

export interface LocationStock {
  id: string
  storeId: string
  locationId: string
  productId: string
  stock: number
}

export interface StockLocationTransfer {
  id: string
  createdAt: number
  storeId: string
  productId: string
  fromLocationId: string
  toLocationId: string
  qty: number
  note?: string
  createdByProfileId?: string
}

export type DiningTableStatus = 'free' | 'occupied' | 'reserved' | 'cleaning'

export interface DiningTable {
  id: string
  storeId: string
  name: string
  capacity: number
  area?: string
  status: DiningTableStatus
  occupiedSince?: number
  note?: string
  sortOrder: number
}

export type TableReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'seated'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export interface TableReservation {
  id: string
  storeId: string
  tableId: string
  customerName: string
  customerPhone?: string
  guests: number
  startAt: number
  endAt: number
  status: TableReservationStatus
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface Promotion {
  id: string
  code: string
  label: string
  discountPct: number
  active: boolean
  startAt?: number
  endAt?: number
  minCartTTC?: number
  storeId?: string
  usageCount: number
  maxUsage?: number
  createdAt: number
  updatedAt: number
}

export interface LoyaltyCustomer {
  id: string
  phone: string
  displayName?: string
  points: number
  totalSpentTTC: number
  visitCount: number
  createdAt: number
  updatedAt: number
}

export interface LoyaltyTransaction {
  id: string
  customerId: string
  saleId?: string
  createdAt: number
  type: 'earn' | 'redeem' | 'adjustment'
  points: number
  amountTTC?: number
  note?: string
  actorProfileId?: string
}

export type HrRequestStatus = 'pending' | 'approved' | 'rejected'

export type HrRequestType = 'leave' | 'advance' | 'expense'

export interface HrRequest {
  id: string
  createdAt: number
  staffProfileId: string
  staffDisplayName: string
  storeId?: string
  type: HrRequestType
  startDate?: string
  endDate?: string
  amountFCFA?: number
  reason: string
  status: HrRequestStatus
  reviewedAt?: number
  reviewedByProfileId?: string
  reviewedByDisplayName?: string
  reviewNote?: string
}

export type CrmInteractionKind =
  | 'call'
  | 'sms'
  | 'whatsapp'
  | 'email'
  | 'visit'
  | 'note'

export interface CrmInteraction {
  id: string
  createdAt: number
  customerId: string
  customerPhone: string
  customerName?: string
  kind: CrmInteractionKind
  note: string
  nextActionAt?: number
  actorProfileId?: string
  actorDisplayName?: string
}

export type TicketInvoiceKind = 'ticket' | 'facture'

export type TicketInvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled'

export interface TicketInvoice {
  id: string
  createdAt: number
  updatedAt: number
  reference: string
  kind: TicketInvoiceKind
  status: TicketInvoiceStatus
  storeId?: string
  storeName?: string
  customerName?: string
  customerPhone?: string
  notes?: string
  dueAt?: number
  issuedAt?: number
  paidAt?: number
  currency: 'XOF'
  lines: SaleLine[]
  subtotalHT: number
  tva: number
  totalTTC: number
  linkedSaleId?: string
  createdByProfileId?: string
  createdByDisplayName?: string
}

export interface TerminalNode {
  id: string
  label: string
  storeId?: string
  storeName?: string
  profileId?: string
  profileDisplayName?: string
  lastSeenAt: number
  lastSyncAt?: number
  pendingSyncCount: number
  online: boolean
  appVersion?: string
}

export interface StockTransfer {
  id: string
  createdAt: number
  fromStoreId: string
  toStoreId: string
  productId: string
  qty: number
  note?: string
  createdByProfileId?: string
}

/** Entrée / sortie pointage (magasin courant au moment du pointage). */
export type TimePunchKind = 'in' | 'out'

export interface TimePunch {
  id: string
  createdAt: number
  profileId: string
  /** Libellé figé au moment du pointage (historique si le profil change). */
  profileDisplayName: string
  storeId: string
  storeName?: string
  kind: TimePunchKind
  note?: string
}

export interface Product {
  id: string
  name: string
  /** Prix unitaire TTC en FCFA */
  priceTTC: number
  /** Prix de revient TTC unitaire (optionnel) — pour marge analytique. */
  purchasePriceTTC?: number
  category: ProductCategory
  barcode: string
  lowStockThreshold: number
  /** Taux de TVA en % (ex. 18). Sert à ventiler HT / TVA sur le ticket. */
  vatRatePct: number
  /** Aperçu catalogue / grille caisse (data URL ou URL https). */
  imageDataUrl?: string
  /** Masqué de la caisse ; réactivable depuis le catalogue. */
  archived: boolean
}

export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'mixed'

export type MobileMoneyOperator = 'orange' | 'mtn' | 'wave'

/** Ventilation TTC d’une vente (simple ou mixte). */
export interface SalePaymentSplit {
  cash: number
  card: number
  mobile: number
  mobileOperator?: MobileMoneyOperator
}

export interface CartLine {
  productId: string
  name: string
  unitPriceTTC: number
  qty: number
  vatRatePct: number
}

export interface SaleLine {
  productId: string
  name: string
  unitPriceTTC: number
  qty: number
  /** Taux TVA % au moment de la vente (traçabilité). */
  vatRatePct?: number
}

export type OnlineOrderStatus = 'pending' | 'approved' | 'rejected'

export type OnlineOrderPlatform =
  | 'native'
  | 'glovo'
  | 'ubereats'
  | 'jumia'
  | 'shopify'
  | 'whatsapp'

export type DeliveryStatus =
  | 'queued'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'cancelled'

export type KitchenStatus =
  | 'queued'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled'

export type KitchenPriority = 'low' | 'normal' | 'high'

export interface OnlineOrder {
  id: string
  createdAt: number
  storeId: string
  storeName?: string
  customerName: string
  customerPhone?: string
  customerAddress?: string
  customerNote?: string
  desiredTimeSlot?: string
  paymentMethod: PaymentMethod
  lines: SaleLine[]
  subtotalHT: number
  tva: number
  totalTTC: number
  netProductsTTC?: number
  discountPct?: number
  promoCode?: string
  deliveryFeeTTC?: number
  fulfillmentMode?: 'pickup' | 'delivery'
  status: OnlineOrderStatus
  sourcePlatform?: OnlineOrderPlatform
  externalOrderRef?: string
  importedAt?: number
  reviewedAt?: number
  reviewedByProfileId?: string
  reviewedByDisplayName?: string
  reviewNote?: string
  deliveryStatus?: DeliveryStatus
  deliveryProvider?: string
  deliveryTrackingCode?: string
  deliveryRiderName?: string
  deliveryEtaAt?: number
  deliveryLastEvent?: string
  deliveryUpdatedAt?: number
  kitchenStatus?: KitchenStatus
  kitchenPriority?: KitchenPriority
  kitchenStation?: string
  kitchenTicketCode?: string
  kitchenUpdatedAt?: number
}

export interface Sale {
  id: string
  createdAt: number
  lines: SaleLine[]
  subtotalHT: number
  tva: number
  totalTTC: number
  discountPct: number
  paymentMethod: PaymentMethod
  /** Ventilation par canal ; les anciennes ventes peuvent s’en passer (déduit de paymentMethod). */
  paymentSplit?: SalePaymentSplit
  /** Espèces : montant remis par le client (pour monnaie). */
  cashReceived?: number
  /** Monnaie à rendre (cashReceived − part espèces). */
  changeDue?: number
  /** Référence transaction TPE (démo / saisie caisse). */
  cardTpeReference?: string
  /** Référence opérateur mobile money (démo / saisie). */
  mobileMoneyReference?: string
  synced: boolean
  /** Magasin où la vente a été enregistrée. */
  storeId?: string
  storeName?: string
  /** Utilisateur connecté au moment de la vente (reçu / rapport). */
  cashierProfileId?: string
  cashierDisplayName?: string
  /** Cumul des remboursements TTC (pour CA net). */
  refundsTotalTTC?: number
  /** Quantités déjà remboursées par produit (clé = productId). */
  refundedLineQty?: Record<string, number>
  promoCode?: string
  loyaltyCustomerId?: string
  loyaltyCustomerPhone?: string
  loyaltyPointsEarned?: number
  loyaltyPointsRedeemed?: number
  loyaltyDiscountTTC?: number
}

/** Remboursement enregistré (traçabilité). */
export interface RefundRecord {
  id: string
  createdAt: number
  saleId: string
  amountTTC: number
  reason: string
  actorProfileId: string
  actorDisplayName: string
  lineAdjustments: { productId: string; qty: number }[]
}

/** Journal d’audit append-only (horodaté, non modifiable depuis l’app). */
export type AuditEventKind =
  | 'cart_cancelled'
  | 'sale_refund'
  | 'promo_applied'
  | 'stock_adjusted'
  | 'stock_transfer'
  | 'time_punch'

export interface AuditEvent {
  id: string
  createdAt: number
  kind: AuditEventKind
  actorProfileId: string
  actorDisplayName: string
  /** Motif obligatoire pour remboursement ; recommandé pour annulation panier. */
  reason: string
  relatedSaleId?: string
  payloadJson: string
}

export interface SyncQueueItem {
  id?: number
  kind: 'sale' | 'stock'
  payload: string
  createdAt: number
}

/**
 * État du jour pour le rapport de caisse : fond de caisse, clôture, instantanés.
 * Clé primaire = dateYmd (jour local).
 */
export interface DayClosure {
  dateYmd: string
  /** Fond de caisse en espèces au début de journée (FCFA). */
  openingFloat: number
  /** Horodatage de la clôture ; absent = journée ouverte. */
  closedAt?: number
  snapshotTotalTTC?: number
  snapshotTransactionCount?: number
  snapshotCash?: number
  snapshotCard?: number
  snapshotMobile?: number
  snapshotCashCount?: number
  snapshotCardCount?: number
  snapshotMobileCount?: number
  /** openingFloat + encaissements espèces au moment de la clôture. */
  expectedCashAtClose?: number
  /** Montant physique compté en caisse à la clôture (optionnel). */
  countedCash?: number
  /** countedCash - expectedCashAtClose */
  cashDifference?: number
  note?: string
  closedByProfileId?: string
  closedByDisplayName?: string
}
