function configuredApiOrigin(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!configured) return ''

  return configured.replace(/\/+$/, '').replace(/\/api$/i, '')
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
