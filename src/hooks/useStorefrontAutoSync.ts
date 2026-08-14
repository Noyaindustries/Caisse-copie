import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useActiveStore } from '../context/ActiveStoreContext'
import { useSubscription } from '../context/SubscriptionContext'
import { db } from '../db/db'
import {
  getLastStorefrontPublishedAt,
  publishActiveStorefrontMenu,
} from '../lib/storefront/autoPublish'
import { importStorefrontInbox } from '../lib/storefront/syncInbox'

const PUBLISH_DEBOUNCE_MS = 2_500
const INBOX_POLL_MS = 30_000

/**
 * Publie automatiquement le catalogue / promotions vers la boutique publique
 * et importe périodiquement les commandes web.
 */
export function useStorefrontAutoSync(): {
  lastPublishedAt: string | null
  syncing: boolean
  lastError: string | null
} {
  const { subscription, usable, online } = useSubscription()
  const { activeStoreId } = useActiveStore()
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(() =>
    getLastStorefrontPublishedAt(),
  )
  const [syncing, setSyncing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const publishInFlight = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const productsRevision =
    useLiveQuery(async () => {
      const [products, stocks, promotions, categories] = await Promise.all([
        db.products.toArray(),
        db.storeStocks.where('storeId').equals(activeStoreId).toArray(),
        db.promotions.toArray(),
        db.productCategories.toArray(),
      ])
      return [
        activeStoreId,
        products.length,
        stocks.length,
        promotions.length,
        categories.length,
        products.reduce(
          (acc, p) =>
            acc +
            p.id.length +
            p.name.length +
            p.priceTTC +
            p.vatRatePct +
            (p.archived ? 1 : 0) +
            (p.imageUrl?.length ?? 0) +
            (p.imageDataUrl?.length ?? 0) +
            (p.barcode?.length ?? 0),
          0,
        ),
        stocks.reduce((acc, s) => acc + s.stock + s.productId.length, 0),
        promotions.reduce(
          (acc, p) =>
            acc +
            p.code.length +
            p.discountPct +
            (p.active ? 1 : 0) +
            p.updatedAt +
            p.usageCount,
          0,
        ),
        categories.reduce(
          (acc, c) =>
            acc +
            c.id.length +
            c.name.length +
            c.sortOrder +
            (c.imageUrl?.length ?? 0) +
            (c.imageDataUrl?.length ?? 0),
          0,
        ),
      ].join('|')
    }, [activeStoreId]) ?? ''

  useEffect(() => {
    if (!online || !usable || !subscription?.licenseKey || !productsRevision) {
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (publishInFlight.current) return
      publishInFlight.current = true
      setSyncing(true)
      void publishActiveStorefrontMenu({
        licenseKey: subscription.licenseKey,
        storeId: activeStoreId,
      })
        .then((result) => {
          if (!result.skipped) {
            setLastPublishedAt(result.publishedAt)
          } else {
            setLastPublishedAt(getLastStorefrontPublishedAt())
          }
          setLastError(null)
        })
        .catch((err) => {
          setLastError(
            err instanceof Error
              ? err.message
              : 'Synchronisation boutique impossible',
          )
        })
        .finally(() => {
          publishInFlight.current = false
          setSyncing(false)
        })
    }, PUBLISH_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [
    online,
    usable,
    subscription?.licenseKey,
    activeStoreId,
    productsRevision,
  ])

  useEffect(() => {
    if (!online || !usable || !subscription?.licenseKey) return

    let cancelled = false
    const pullInbox = () => {
      void importStorefrontInbox(subscription.licenseKey).catch(() => {
        /* inbox optionnel */
      })
    }

    pullInbox()
    const id = window.setInterval(() => {
      if (!cancelled) pullInbox()
    }, INBOX_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [online, usable, subscription?.licenseKey])

  return { lastPublishedAt, syncing, lastError }
}
