function configuredApiOrigin(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!configured) return ''

  return configured.replace(/\/+$/, '').replace(/\/api$/i, '')
}

/**
 * Indique si le client peut joindre l’API cloud (push/pull sync, staff distant).
 * - `VITE_API_BASE_URL` : frontend et API sur des domaines distincts ;
 * - proxy Vite `/api` ou monolithe Render : chemins relatifs `/api/...`.
 */
export function isCloudApiConfigured(): boolean {
  if (import.meta.env.VITE_API_BASE_URL?.trim()) return true
  if (import.meta.env.VITE_CLOUD_SYNC_URL?.trim()) return true
  return typeof window !== 'undefined'
}

/**
 * URL d’envoi de la file sync locale → cloud.
 * Préfère `apiUrl('/caisseci/sync')` ; `VITE_CLOUD_SYNC_URL` reste un repli legacy.
 */
export function cloudSyncPushUrl(): string {
  const legacy = import.meta.env.VITE_CLOUD_SYNC_URL?.trim()
  if (legacy) return legacy
  return apiUrl('/caisseci/sync')
}

/**
 * Construit une URL API compatible avec :
 * - un déploiement fullstack sur le même domaine ;
 * - un frontend statique et une API hébergée séparément.
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${configuredApiOrigin()}/api${normalizedPath}`
}
