export type ProductCategory =
  | 'Boissons'
  | 'Alimentation'
  | 'Hygiène'
  | 'Autre'

export const PRODUCT_CATEGORY_LIST: ProductCategory[] = [
  'Boissons',
  'Alimentation',
  'Hygiène',
  'Autre',
]

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

export interface OnlineOrder {
  id: string
  createdAt: number
  storeId: string
  storeName?: string
  customerName: string
  customerPhone?: string
  customerAddress?: string
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
  reviewedAt?: number
  reviewedByProfileId?: string
  reviewedByDisplayName?: string
  reviewNote?: string
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
