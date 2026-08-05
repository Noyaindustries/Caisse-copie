import type { OrganizationCredentials, SubscriptionSnapshot } from './types'
import { OFFLINE_GRACE_MS } from './plans'

const ORG_KEY = 'caisseci-org-credentials-v1'
const SNAPSHOT_KEY = 'caisseci-subscription-snapshot-v1'
const SESSION_KEY = 'caisseci-session-token-v1'

function readSessionToken(): string | undefined {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw?.trim() || undefined
  } catch {
    return undefined
  }
}

function writeSessionToken(token: string | undefined): void {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

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
    const creds = parsed as OrganizationCredentials
    if (!creds.sessionToken) {
      creds.sessionToken = readSessionToken()
    }
    return creds
  } catch {
    return null
  }
}

export function setOrganizationCredentials(creds: OrganizationCredentials): void {
  writeSessionToken(creds.sessionToken)
  localStorage.setItem(ORG_KEY, JSON.stringify(creds))
}

export function clearOrganizationCredentials(): void {
  localStorage.removeItem(ORG_KEY)
  localStorage.removeItem(SNAPSHOT_KEY)
  writeSessionToken(undefined)
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
  if (online) return snapshot.usable
  return (
    snapshot.usable &&
    snapshot.status !== 'expired' &&
    isCacheWithinGrace(snapshot)
  )
}
