import type {
  PublicStorefrontOrderInput,
  PublishedStorefrontMenu,
  StorefrontInfo,
} from './types'
import type { ProductWithStock, Promotion } from '../../db/types'
import { apiUrl } from '../apiUrl'
import { parseApiResponse } from '../parseApiResponse'

async function parseJson<T>(res: Response): Promise<T> {
  return parseApiResponse<T>(res)
}

export async function fetchStorefrontInfo(storeCode: string): Promise<StorefrontInfo> {
  const res = await fetch(
    apiUrl(`/billing/storefront/${encodeURIComponent(storeCode)}`),
  )
  return parseJson(res)
}

export async function fetchStorefrontMenu(
  storeCode: string,
): Promise<PublishedStorefrontMenu & { name: string; storeCode: string }> {
  const res = await fetch(
    apiUrl(`/billing/storefront/${encodeURIComponent(storeCode)}/menu`),
  )
  const data = await parseJson<{
    name: string
    storeCode: string
    publishedAt: string | null
    menu: PublishedStorefrontMenu
  }>(res)
  return {
    name: data.name,
    storeCode: data.storeCode,
    ...data.menu,
    publishedAt: data.menu.publishedAt ?? data.publishedAt ?? new Date().toISOString(),
  }
}

export async function submitPublicStorefrontOrder(
  storeCode: string,
  order: PublicStorefrontOrderInput,
): Promise<{
  orderId: string
  reference: string
  requiresPayment?: boolean
  paymentUrl?: string
  demo?: boolean
  provider?: 'wave'
}> {
  const res = await fetch(
    apiUrl(`/billing/storefront/${encodeURIComponent(storeCode)}/orders`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    },
  )
  return parseJson(res)
}

export async function verifyStorefrontOrderPayment(
  storeCode: string,
  orderId: string,
): Promise<{ status: 'paid' | 'pending' | 'failed' | 'unknown'; orderId: string }> {
  const res = await fetch(
    apiUrl(
      `/billing/storefront/${encodeURIComponent(storeCode)}/orders/${encodeURIComponent(orderId)}/payment-status`,
    ),
  )
  return parseJson(res)
}

export async function publishStorefrontMenu(
  licenseKey: string,
  input: {
    storeId: string
    storeName: string
    products: ProductWithStock[]
    promotions: Promotion[]
  },
): Promise<{ storefrontUrl: string; productCount: number; publishedAt: string }> {
  const res = await fetch(apiUrl('/billing/storefront/publish'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-license-key': licenseKey,
    },
    body: JSON.stringify({
      storeId: input.storeId,
      storeName: input.storeName,
      products: input.products.map((p) => ({
        id: p.id,
        name: p.name,
        priceTTC: p.priceTTC,
        category: p.category,
        vatRatePct: p.vatRatePct,
        imageDataUrl: p.imageDataUrl,
        imageUrl: p.imageUrl,
        stock: p.stock,
        barcode: p.barcode,
        lowStockThreshold: p.lowStockThreshold,
      })),
      promotions: input.promotions.map((promotion) => ({
        id: promotion.id,
        code: promotion.code,
        label: promotion.label,
        discountPct: promotion.discountPct,
        active: promotion.active,
        startAt: promotion.startAt,
        endAt: promotion.endAt,
        minCartTTC: promotion.minCartTTC,
        maxUsage: promotion.maxUsage,
        usageCount: promotion.usageCount,
        storeId: promotion.storeId,
        createdAt: promotion.createdAt,
        updatedAt: promotion.updatedAt,
      })),
    }),
  })
  return parseJson(res)
}

export async function fetchStorefrontInbox(
  licenseKey: string,
  status = 'pending',
): Promise<{ orders: Array<Record<string, unknown> & { id: string; createdAt: number; status: string }> }> {
  const q = new URLSearchParams({ status })
  const res = await fetch(apiUrl(`/billing/storefront/orders/inbox?${q}`), {
    headers: { 'x-license-key': licenseKey },
  })
  return parseJson(res)
}

export async function patchStorefrontOrderStatus(
  licenseKey: string,
  externalId: string,
  status: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(`/billing/storefront/orders/${encodeURIComponent(externalId)}`),
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-license-key': licenseKey,
      },
      body: JSON.stringify({ status }),
    },
  )
  await parseJson(res)
}
