import { getOrganizationCredentials } from './store'

export function buildOrgAuthHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const creds = getOrganizationCredentials()
  const headers: Record<string, string> = { ...(extra ?? {}) }
  if (creds?.sessionToken) {
    headers.Authorization = `Bearer ${creds.sessionToken}`
  } else if (creds?.licenseKey) {
    headers['x-license-key'] = creds.licenseKey
  }
  return headers
}

export function hasOrgAuth(): boolean {
  const creds = getOrganizationCredentials()
  return Boolean(creds?.sessionToken || creds?.licenseKey)
}
