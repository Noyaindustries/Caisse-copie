import type { OnlineOrder } from '../db/types'
import type { DayBucket } from './salesStats'
import { saleLocalYmd } from './salesStats'

/** Commandes web dont la date de création tombe dans la fenêtre calendaire des `buckets` (même logique que les ventes). */
export function filterOnlineOrdersInBucketWindow(
  orders: OnlineOrder[],
  buckets: DayBucket[],
): OnlineOrder[] {
  const firstYmd = buckets[0]?.ymd
  if (!firstYmd) return []
  return orders.filter((o) => saleLocalYmd(o.createdAt) >= firstYmd)
}

export type WebOrderDayAgg = {
  label: string
  ymd: string
  created: number
  pending: number
  approved: number
  rejected: number
  totalTTC: number
}

export function aggregateWebOrdersByDay(
  ordersInWindow: OnlineOrder[],
  buckets: DayBucket[],
): WebOrderDayAgg[] {
  return buckets.map((b) => {
    const day = ordersInWindow.filter((o) => saleLocalYmd(o.createdAt) === b.ymd)
    return {
      label: b.label,
      ymd: b.ymd,
      created: day.length,
      pending: day.filter((o) => o.status === 'pending').length,
      approved: day.filter((o) => o.status === 'approved').length,
      rejected: day.filter((o) => o.status === 'rejected').length,
      totalTTC: day.reduce((s, o) => s + o.totalTTC, 0),
    }
  })
}
