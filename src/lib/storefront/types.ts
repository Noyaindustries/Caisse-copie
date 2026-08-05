import type { ProductWithStock, PaymentMethod, Promotion } from '../../db/types'

export type StorefrontBranding = {
  shopName?: string
  logoUrl?: string
  primaryColor?: string
  bannerUrl?: string
  welcomeMessage?: string
}

export type PublishedStorefrontMenu = {
  storeId: string
  storeName: string
  publishedAt: string
  products: ProductWithStock[]
  promotions: Promotion[]
  branding?: StorefrontBranding
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
  branding?: StorefrontBranding
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

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

export function normalizeStorefrontBranding(
  input: unknown,
): StorefrontBranding | undefined {
  if (!input || typeof input !== 'object') return undefined
  const raw = input as Record<string, unknown>
  const branding: StorefrontBranding = {}

  if (typeof raw.shopName === 'string') {
    const shopName = raw.shopName.trim().slice(0, 120)
    if (shopName) branding.shopName = shopName
  }
  if (typeof raw.logoUrl === 'string') {
    const logoUrl = raw.logoUrl.trim().slice(0, 2_000)
    if (logoUrl) branding.logoUrl = logoUrl
  }
  if (typeof raw.bannerUrl === 'string') {
    const bannerUrl = raw.bannerUrl.trim().slice(0, 2_000)
    if (bannerUrl) branding.bannerUrl = bannerUrl
  }
  if (typeof raw.welcomeMessage === 'string') {
    const welcomeMessage = raw.welcomeMessage.trim().slice(0, 500)
    if (welcomeMessage) branding.welcomeMessage = welcomeMessage
  }
  if (typeof raw.primaryColor === 'string') {
    const primaryColor = raw.primaryColor.trim()
    if (HEX_COLOR_RE.test(primaryColor)) branding.primaryColor = primaryColor
  }

  return Object.keys(branding).length > 0 ? branding : undefined
}

export function storefrontDisplayName(
  branding: StorefrontBranding | undefined,
  storeName: string,
  fallback = 'Boutique',
): string {
  return branding?.shopName?.trim() || storeName.trim() || fallback
}

export function storefrontAccentColor(
  branding: StorefrontBranding | undefined,
): string {
  const color = branding?.primaryColor?.trim()
  return color && HEX_COLOR_RE.test(color) ? color : '#B8922E'
}
