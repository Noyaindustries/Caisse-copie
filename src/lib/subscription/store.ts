import type { OrganizationCredentials, SubscriptionSnapshot } from './types'
import { OFFLINE_GRACE_MS } from './plans'

const ORG_KEY = 'caisseci-org-credentials-v1'
const SNAPSHOT_KEY = 'caisseci-subscription-snapshot-v1'

export function getOrganizationCredentials(): OrganizationCredentials | null {
  try {
    const raw = localStorage.getItem(ORG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as OrganizationCredentials).licenseKey !== 'string' ||
      typeof (parsed as OrganizationCredentials).organizationId !== 'string' ||
      typeof (parsed as OrganizationCredentials).name !== 'string'
    ) {
      return null
    }
    return parsed as OrganizationCredentials
  } catch {
    return null
  }
}

export function setOrganizationCredentials(creds: OrganizationCredentials): void {
  localStorage.setItem(ORG_KEY, JSON.stringify(creds))
}

export function clearOrganizationCredentials(): void {
  localStorage.removeItem(ORG_KEY)
  localStorage.removeItem(SNAPSHOT_KEY)
}

export function getCachedSubscription(): SubscriptionSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SubscriptionSnapshot
    if (typeof parsed?.licenseKey !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function setCachedSubscription(snapshot: SubscriptionSnapshot): void {
  localStorage.setItem(
    SNAPSHOT_KEY,
    JSON.stringify({ ...snapshot, cachedAt: Date.now() }),
  )
}

export function isCacheWithinGrace(snapshot: SubscriptionSnapshot | null): boolean {
  if (!snapshot) return false
  return Date.now() - snapshot.cachedAt <= OFFLINE_GRACE_MS
}

export function effectiveUsable(
  snapshot: SubscriptionSnapshot | null,
  online: boolean,
): boolean {
  if (!snapshot) return false
  if (snapshot.usable) return true
  if (!online && isCacheWithinGrace(snapshot) && snapshot.status !== 'expired') {
    return true
  }
  return false
}
