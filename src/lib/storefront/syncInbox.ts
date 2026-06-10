import { db } from '../../db/db'
import type { OnlineOrder } from '../../db/types'
import { fetchStorefrontInbox } from './api'

export async function importStorefrontInbox(licenseKey: string): Promise<number> {
  const { orders } = await fetchStorefrontInbox(licenseKey, 'pending')
  let imported = 0
  for (const raw of orders) {
    const id = typeof raw.id === 'string' ? raw.id : null
    if (!id) continue
    const existing = await db.onlineOrders.get(id)
    if (existing) continue
    const order = raw as unknown as OnlineOrder
    if (!order.lines || !order.customerName) continue
    await db.onlineOrders.put({
      ...order,
      id,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      status: 'pending',
      sourcePlatform: 'web_storefront',
      externalOrderRef: id.slice(0, 8).toUpperCase(),
      importedAt: Date.now(),
    })
    imported += 1
  }
  return imported
}
