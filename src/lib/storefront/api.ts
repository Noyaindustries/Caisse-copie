import type {
  PublicStorefrontOrderInput,
  PublishedStorefrontMenu,
  StorefrontInfo,
} from './types'
import type { ProductWithStock } from '../../db/types'

const API_BASE = '/api'

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : `Erreur HTTP ${res.status}`,
    )
  }
  return data
}

export async function fetchStorefrontInfo(storeCode: string): Promise<StorefrontInfo> {
  const res = await fetch(
    `${API_BASE}/billing/storefront/${encodeURIComponent(storeCode)}`,
  )
  return parseJson(res)
}

export async function fetchStorefrontMenu(
  storeCode: string,
): Promise<PublishedStorefrontMenu & { name: string; storeCode: string }> {
  const res = await fetch(
    `${API_BASE}/billing/storefront/${encodeURIComponent(storeCode)}/menu`,
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
    `${API_BASE}/billing/storefront/${encodeURIComponent(storeCode)}/orders`,
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
    `${API_BASE}/billing/storefront/${encodeURIComponent(storeCode)}/orders/${encodeURIComponent(orderId)}/payment-status`,
  )
  return parseJson(res)
}

export async function publishStorefrontMenu(
  licenseKey: string,
  input: {
    storeId: string
    storeName: string
    products: ProductWithStock[]
  },
): Promise<{ storefrontUrl: string; productCount: number; publishedAt: string }> {
  const res = await fetch(`${API_BASE}/billing/storefront/publish`, {
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
        stock: p.stock,
        barcode: p.barcode,
        lowStockThreshold: p.lowStockThreshold,
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
  const res = await fetch(`${API_BASE}/billing/storefront/orders/inbox?${q}`, {
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
    `${API_BASE}/billing/storefront/orders/${encodeURIComponent(externalId)}`,
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
