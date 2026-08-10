/** Miroir des defaults / calcul client (`src/lib/storefront/types.ts`). */

export const DEFAULT_STOREFRONT_DELIVERY_FEE_TTC = 1000
export const DEFAULT_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC = 15_000
export const MAX_STOREFRONT_DELIVERY_FEE_TTC = 1_000_000
export const MAX_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC = 10_000_000

export function normalizeNonNegativeInt(
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
  branding: Record<string, unknown> | undefined,
): number {
  return (
    normalizeNonNegativeInt(
      branding?.deliveryFeeTTC,
      MAX_STOREFRONT_DELIVERY_FEE_TTC,
    ) ?? DEFAULT_STOREFRONT_DELIVERY_FEE_TTC
  )
}

export function resolveStorefrontFreeDeliveryThresholdTTC(
  branding: Record<string, unknown> | undefined,
): number {
  return (
    normalizeNonNegativeInt(
      branding?.freeDeliveryThresholdTTC,
      MAX_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC,
    ) ?? DEFAULT_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC
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
