/** Miroir des defaults / calcul client (`src/lib/storefront/types.ts`). */

export const DEFAULT_STOREFRONT_DELIVERY_FEE_TTC = 1000
export const DEFAULT_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC = 15_000
export const MAX_STOREFRONT_DELIVERY_FEE_TTC = 1_000_000
export const MAX_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC = 10_000_000
export const MAX_STOREFRONT_DELIVERY_ZONES = 40

export type StorefrontDeliveryZone = {
  id: string
  name: string
  feeTTC: number
}

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

export function normalizeStorefrontDeliveryZones(
  raw: unknown,
): StorefrontDeliveryZone[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const zones: StorefrontDeliveryZone[] = []
  for (const item of raw.slice(0, MAX_STOREFRONT_DELIVERY_ZONES)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id =
      typeof row.id === 'string' ? row.id.trim().slice(0, 80) : ''
    const name =
      typeof row.name === 'string' ? row.name.trim().slice(0, 80) : ''
    const feeTTC = normalizeNonNegativeInt(
      row.feeTTC,
      MAX_STOREFRONT_DELIVERY_FEE_TTC,
    )
    if (!id || !name || feeTTC == null) continue
    zones.push({ id, name, feeTTC })
  }
  return zones.length > 0 ? zones : undefined
}

export function resolveStorefrontDeliveryZones(
  branding: Record<string, unknown> | undefined,
): StorefrontDeliveryZone[] {
  return normalizeStorefrontDeliveryZones(branding?.deliveryZones) ?? []
}

export function findStorefrontDeliveryZone(
  branding: Record<string, unknown> | undefined,
  zoneId: string | null | undefined,
): StorefrontDeliveryZone | undefined {
  if (!zoneId) return undefined
  return resolveStorefrontDeliveryZones(branding).find((z) => z.id === zoneId)
}

export function resolveStorefrontDeliveryFeeTTC(
  branding: Record<string, unknown> | undefined,
  zoneId?: string | null,
): number {
  const zones = resolveStorefrontDeliveryZones(branding)
  if (zones.length > 0) {
    const zone = findStorefrontDeliveryZone(branding, zoneId)
    if (zone) return zone.feeTTC
    return (
      normalizeNonNegativeInt(
        branding?.deliveryFeeTTC,
        MAX_STOREFRONT_DELIVERY_FEE_TTC,
      ) ?? DEFAULT_STOREFRONT_DELIVERY_FEE_TTC
    )
  }
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
