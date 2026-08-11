import { getOrganizationCredentials } from './store'

export function buildOrgAuthHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const creds = getOrganizationCredentials()
  const headers: Record<string, string> = { ...(extra ?? {}) }
  if (creds?.sessionToken?.trim()) {
    headers.Authorization = `Bearer ${creds.sessionToken.trim()}`
  }
  // Toujours envoyer la licence : un Bearer expiré ne doit pas bloquer le personnel.
  if (creds?.licenseKey?.trim()) {
    headers['x-license-key'] = creds.licenseKey.trim()
  }
  return headers
}

export function hasOrgAuth(): boolean {
  const creds = getOrganizationCredentials()
  return Boolean(creds?.sessionToken?.trim() || creds?.licenseKey?.trim())
}
