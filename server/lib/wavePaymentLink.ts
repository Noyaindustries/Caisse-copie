/** Hôtes Wave acceptés pour un lien de paiement abonnement (pas l’API checkout). */
const WAVE_PAYMENT_LINK_HOSTS = new Set([
  'pay.wave.com',
  'checkout.wave.com',
  'wave.com',
  'www.wave.com',
])

/** Package Play Store de l’app Wave CI / SN (`com.wave.personal`). */
export const WAVE_ANDROID_PACKAGE = 'com.wave.personal'

export function isWaveHttpsHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'wave.com' || host.endsWith('.wave.com')
}

export function isWavePaymentLinkHost(hostname: string): boolean {
  return WAVE_PAYMENT_LINK_HOSTS.has(hostname.toLowerCase())
}

/**
 * Normalise un lien Wave Business (pay.wave.com / wave.com).
 * Chaîne vide → null. URL invalide → throw.
 */
export function normalizeWavePaymentLink(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(
      'Lien Wave invalide. Collez l’URL complète (ex. https://pay.wave.com/m/M_ci_…).',
    )
  }

  if (url.protocol !== 'https:') {
    throw new Error('Le lien Wave doit commencer par https://')
  }
  if (!isWavePaymentLinkHost(url.hostname)) {
    throw new Error(
      'Le lien doit provenir de Wave (pay.wave.com ou wave.com).',
    )
  }
  if (url.href.length > 2_000) {
    throw new Error('Lien Wave trop long.')
  }
  return url.href
}

/**
 * Intent Android qui ouvre l’app Wave (repli navigateur si l’app n’est pas installée).
 * iOS / desktop : laisser l’URL https (lien universel + page QR).
 */
export function waveAndroidIntentUrl(httpsUrl: string): string {
  const url = new URL(httpsUrl)
  if (url.protocol !== 'https:' || !isWaveHttpsHost(url.hostname)) {
    return httpsUrl
  }
  const hostPath = `${url.host}${url.pathname}${url.search}${url.hash}`
  return `intent://${hostPath}#Intent;scheme=https;package=${WAVE_ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(url.href)};end`
}
