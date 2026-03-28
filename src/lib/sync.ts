import { db } from '../db/db'
import type { SyncQueueItem } from '../db/types'
import { setLastSyncTimestamp } from './syncMeta'

export type SyncResult = {
  processed: number
  mode: 'cloud' | 'local' | 'failed' | 'noop'
  error?: string
}

function parseSaleId(payload: string): string | undefined {
  try {
    const o = JSON.parse(payload) as { saleId?: string }
    return typeof o.saleId === 'string' ? o.saleId : undefined
  } catch {
    return undefined
  }
}

function buildBatchPayload(items: SyncQueueItem[]) {
  return items.map((item) => {
    let parsed: unknown = item.payload
    try {
      parsed = JSON.parse(item.payload) as unknown
    } catch {
      /* garder la chaîne brute */
    }
    return {
      kind: item.kind,
      createdAt: item.createdAt,
      payload: parsed,
    }
  })
}

/**
 * Envoie les mouvements de stock vers la file cloud (traitée au prochain flush).
 */
export async function enqueueStockSync(payload: {
  productId: string
  stock: number
  lowStockThreshold: number
  storeId: string
}): Promise<void> {
  await db.syncQueue.add({
    kind: 'stock',
    payload: JSON.stringify({
      type: 'stock_update',
      ...payload,
      at: Date.now(),
    }),
    createdAt: Date.now(),
  })
}

/**
 * Synchronise la file vers le cloud si `VITE_CLOUD_SYNC_URL` est défini et que le réseau répond.
 * Sinon : simulation locale (latence courte) pour la démo hors backend.
 */
export async function flushSyncQueue(): Promise<SyncResult> {
  const pending = await db.syncQueue.orderBy('createdAt').toArray()
  if (pending.length === 0) {
    return { processed: 0, mode: 'noop' }
  }

  const saleIds = pending
    .filter((p) => p.kind === 'sale')
    .map((p) => parseSaleId(p.payload))
    .filter(Boolean) as string[]

  const cloudUrl = import.meta.env.VITE_CLOUD_SYNC_URL?.trim()

  if (cloudUrl) {
    try {
      const body = JSON.stringify({
        batchId: crypto.randomUUID(),
        sentAt: Date.now(),
        items: buildBatchPayload(pending),
      })

      const ctrl = new AbortController()
      const timer = window.setTimeout(() => ctrl.abort(), 18_000)

      const res = await fetch(cloudUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
        signal: ctrl.signal,
      })
      window.clearTimeout(timer)

      if (!res.ok) {
        const err = `Cloud sync : HTTP ${res.status}`
        return { processed: 0, mode: 'failed', error: err }
      }

      for (const item of pending) {
        if (item.id != null) await db.syncQueue.delete(item.id)
      }
      for (const sid of saleIds) {
        await db.sales.update(sid, { synced: true })
      }
      setLastSyncTimestamp(Date.now())
      return { processed: pending.length, mode: 'cloud' }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Échec de la synchronisation cloud'
      return {
        processed: 0,
        mode: 'failed',
        error: msg.includes('abort') ? 'Délai dépassé (cloud)' : msg,
      }
    }
  }

  /* Mode hors backend : file vidée localement (démo) */
  let done = 0
  for (const item of pending) {
    await new Promise((r) => setTimeout(r, 100))
    if (item.id != null) await db.syncQueue.delete(item.id)
    done += 1
  }

  for (const sid of saleIds) {
    await db.sales.update(sid, { synced: true })
  }
  setLastSyncTimestamp(Date.now())
  return { processed: done, mode: 'local' }
}

export async function pendingSyncCount(): Promise<number> {
  return db.syncQueue.count()
}
