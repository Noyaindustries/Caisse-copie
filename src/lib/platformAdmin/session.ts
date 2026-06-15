const STORAGE_KEY = 'caisseci-platform-admin-secret'

export function getPlatformAdminSecret(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  const value = sessionStorage.getItem(STORAGE_KEY)?.trim()
  return value || null
}

export function setPlatformAdminSecret(secret: string): void {
  sessionStorage.setItem(STORAGE_KEY, secret.trim())
}

export function clearPlatformAdminSecret(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
