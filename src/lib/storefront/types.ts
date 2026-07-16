import type { ProductWithStock, PaymentMethod, Promotion } from '../../db/types'

export type PublishedStorefrontMenu = {
  storeId: string
  storeName: string
  publishedAt: string
  products: ProductWithStock[]
  promotions: Promotion[]
}

export type StorefrontInfo = {
  organizationId: string
  name: string
  storeCode: string
  usable: boolean
  planId: string
  storefrontUrl: string
  menuPublished: boolean
  publishedAt: string | null
  waveEnabled: boolean
}

export type StorefrontPaymentMethod = PaymentMethod | 'wave'

export type PublicStorefrontOrderInput = {
  customerName: string
  customerPhone?: string
  customerAddress?: string
  customerNote?: string
  desiredTimeSlot?: string
  paymentMethod: StorefrontPaymentMethod
  fulfillmentMode: 'pickup' | 'delivery'
  lines: Array<{
    productId: string
    name: string
    unitPriceTTC: number
    qty: number
    vatRatePct: number
  }>
  subtotalHT: number
  tva: number
  totalTTC: number
  netProductsTTC: number
  discountPct?: number
  promoCode?: string
  deliveryFeeTTC?: number
}
