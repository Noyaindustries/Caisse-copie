import { db } from '../db/db'
import { getLastSyncTimestamp } from './syncMeta'
import { getOrCreateTerminalId, getOrCreateTerminalLabel } from './session'

export type TerminalPresenceInput = {
  storeId?: string
  storeName?: string
  profileId?: string
  profileDisplayName?: string
}

export async function upsertTerminalPresence(
  input: TerminalPresenceInput,
): Promise<void> {
  const id = getOrCreateTerminalId()
  const label = getOrCreateTerminalLabel()
  const pendingSyncCount = await db.syncQueue.count()
  const lastSyncAt = getLastSyncTimestamp() ?? undefined
  await db.terminalNodes.put({
    id,
    label,
    storeId: input.storeId,
    storeName: input.storeName,
    profileId: input.profileId,
    profileDisplayName: input.profileDisplayName,
    lastSeenAt: Date.now(),
    lastSyncAt,
    pendingSyncCount,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    appVersion: '1.0',
  })
}

export async function touchTerminalSyncTimestamp(): Promise<void> {
  const id = getOrCreateTerminalId()
  const node = await db.terminalNodes.get(id)
  if (!node) return
  await db.terminalNodes.update(id, {
    lastSeenAt: Date.now(),
    lastSyncAt: Date.now(),
    pendingSyncCount: await db.syncQueue.count(),
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
  })
}

export async function cleanupStaleTerminalNodes(
  maxAgeMs = 3 * 60 * 1000,
): Promise<void> {
  const limit = Date.now() - maxAgeMs
  const all = await db.terminalNodes.toArray()
  for (const t of all) {
    if (t.lastSeenAt < limit && t.online) {
      await db.terminalNodes.update(t.id, { online: false })
    }
  }
}
