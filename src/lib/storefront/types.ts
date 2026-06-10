import type { ProductWithStock } from '../../db/types'
import type { PaymentMethod } from '../../db/types'

export type PublishedStorefrontMenu = {
  storeId: string
  storeName: string
  publishedAt: string
  products: ProductWithStock[]
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
}

export type PublicStorefrontOrderInput = {
  customerName: string
  customerPhone?: string
  customerAddress?: string
  customerNote?: string
  desiredTimeSlot?: string
  paymentMethod: PaymentMethod
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
