import type { ProductWithStock, PaymentMethod, Promotion } from '../../db/types'

export type StorefrontBranding = {
  shopName?: string
  logoUrl?: string
  primaryColor?: string
  bannerUrl?: string
  welcomeMessage?: string
  /** Téléphone affiché (lien tel:). */
  phone?: string
  /** WhatsApp (si vide côté UI, dérivé de phone). */
  whatsapp?: string
  email?: string
  address?: string
  mapsUrl?: string
  /** Horaires multi-lignes. */
  openingHours?: string
  /** Accroche courte du pied de page. */
  footerTagline?: string
  /** Mentions légales / texte bas de page. */
  legalMentions?: string
  /** Frais de livraison TTC (FCFA). */
  deliveryFeeTTC?: number
  /**
   * Seuil panier TTC pour livraison offerte.
   * 0 = jamais offerte.
   */
  freeDeliveryThresholdTTC?: number
}

/** Défauts historiques de la boutique (avant config par entreprise). */
export const DEFAULT_STOREFRONT_DELIVERY_FEE_TTC = 1000
export const DEFAULT_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC = 15_000
export const MAX_STOREFRONT_DELIVERY_FEE_TTC = 1_000_000
export const MAX_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC = 10_000_000

function normalizeNonNegativeInt(
  raw: unknown,
  max: number,
): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.round(raw)
    if (n >= 0 && n <= max) return n
    return undefined
  }
  if (typeof raw === 'string' && raw.trim()) {
    const n = Math.round(Number(raw.trim().replace(/\s/g, '')))
    if (Number.isFinite(n) && n >= 0 && n <= max) return n
  }
  return undefined
}

export function resolveStorefrontDeliveryFeeTTC(
  branding: StorefrontBranding | undefined,
): number {
  return branding?.deliveryFeeTTC ?? DEFAULT_STOREFRONT_DELIVERY_FEE_TTC
}

export function resolveStorefrontFreeDeliveryThresholdTTC(
  branding: StorefrontBranding | undefined,
): number {
  return (
    branding?.freeDeliveryThresholdTTC ??
    DEFAULT_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC
  )
}

export function computeDeliveryFeeTTC(opts: {
  fulfillmentMode: 'pickup' | 'delivery'
  cartTTC: number
  feeTTC: number
  freeThresholdTTC: number
}): number {
  if (opts.fulfillmentMode !== 'delivery') return 0
  const fee = Math.max(0, Math.round(opts.feeTTC))
  const threshold = Math.max(0, Math.round(opts.freeThresholdTTC))
  const cart = Math.max(0, opts.cartTTC)
  if (threshold > 0 && cart >= threshold) return 0
  return fee
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

/** HTTPS court ; data URL logo/bannière ≤ ~500 Ko ≈ 700k–1,5M caractères. */
const MAX_REMOTE_IMAGE_URL = 2_000
const MAX_DATA_IMAGE_URL = 1_500_000

function normalizeStorefrontImageUrl(raw: string): string | undefined {
  const value = raw.trim()
  if (!value) return undefined
  if (value.startsWith('data:image/')) {
    return value.length <= MAX_DATA_IMAGE_URL ? value : undefined
  }
  if (
    /^https?:\/\//i.test(value) ||
    value.startsWith('/uploads/') ||
    value.startsWith('/branding/')
  ) {
    return value.length <= MAX_REMOTE_IMAGE_URL ? value : undefined
  }
  return undefined
}

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
    const logoUrl = normalizeStorefrontImageUrl(raw.logoUrl)
    if (logoUrl) branding.logoUrl = logoUrl
  }
  if (typeof raw.bannerUrl === 'string') {
    const bannerUrl = normalizeStorefrontImageUrl(raw.bannerUrl)
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

  const trimField = (
    key:
      | 'phone'
      | 'whatsapp'
      | 'email'
      | 'address'
      | 'openingHours'
      | 'footerTagline'
      | 'legalMentions',
    max: number,
  ): void => {
    const value = raw[key]
    if (typeof value !== 'string') return
    const trimmed = value.trim().slice(0, max)
    if (trimmed) branding[key] = trimmed
  }

  trimField('phone', 40)
  trimField('whatsapp', 40)
  trimField('email', 160)
  trimField('address', 300)
  trimField('openingHours', 1_000)
  trimField('footerTagline', 200)
  trimField('legalMentions', 1_000)

  if (typeof raw.mapsUrl === 'string') {
    const mapsUrl = raw.mapsUrl.trim().slice(0, 500)
    if (mapsUrl && /^https?:\/\//i.test(mapsUrl)) {
      branding.mapsUrl = mapsUrl
    }
  }

  const deliveryFeeTTC = normalizeNonNegativeInt(
    raw.deliveryFeeTTC,
    MAX_STOREFRONT_DELIVERY_FEE_TTC,
  )
  if (deliveryFeeTTC != null) branding.deliveryFeeTTC = deliveryFeeTTC

  const freeDeliveryThresholdTTC = normalizeNonNegativeInt(
    raw.freeDeliveryThresholdTTC,
    MAX_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC,
  )
  if (freeDeliveryThresholdTTC != null) {
    branding.freeDeliveryThresholdTTC = freeDeliveryThresholdTTC
  }

  return Object.keys(branding).length > 0 ? branding : undefined
}

/** Chiffres seuls pour tel: / wa.me. */
export function storefrontPhoneDigits(raw: string | undefined): string {
  if (!raw) return ''
  return raw.replace(/\D/g, '')
}

export function storefrontTelHref(phone: string | undefined): string | undefined {
  const digits = storefrontPhoneDigits(phone)
  return digits ? `tel:+${digits}` : undefined
}

export function storefrontWhatsAppHref(
  whatsapp: string | undefined,
  phoneFallback?: string,
): string | undefined {
  const digits =
    storefrontPhoneDigits(whatsapp) || storefrontPhoneDigits(phoneFallback)
  return digits ? `https://wa.me/${digits}` : undefined
}

export function storefrontMapsHref(
  mapsUrl: string | undefined,
  address: string | undefined,
): string | undefined {
  const url = mapsUrl?.trim()
  if (url && /^https?:\/\//i.test(url)) return url
  const addr = address?.trim()
  if (!addr) return undefined
  return `https://maps.google.com/?q=${encodeURIComponent(addr)}`
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
