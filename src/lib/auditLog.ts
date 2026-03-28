import { db } from '../db/db'
import type { AuditEvent, AuditEventKind } from '../db/types'

export type AuditActor = { profileId: string; displayName: string }

/**
 * Écriture append-only du journal d’audit : horodatage serveur local (Date.now),
 * aucune mise à jour ni suppression via l’app (IndexedDB `add` uniquement).
 */
export async function appendAuditEvent(params: {
  kind: AuditEventKind
  actor: AuditActor
  reason: string
  payload: unknown
  relatedSaleId?: string
}): Promise<void> {
  const ev: AuditEvent = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    kind: params.kind,
    actorProfileId: params.actor.profileId,
    actorDisplayName: params.actor.displayName,
    reason: params.reason,
    relatedSaleId: params.relatedSaleId,
    payloadJson: JSON.stringify(params.payload),
  }
  await db.auditEvents.add(ev)
}
