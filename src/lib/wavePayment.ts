const WAVE_ANDROID_PACKAGE = 'com.wave.personal'

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

function isWaveHttpsUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase()
    return (
      url.protocol === 'https:' &&
      (host === 'wave.com' || host.endsWith('.wave.com'))
    )
  } catch {
    return false
  }
}

/** Android : intent vers l’app Wave. iOS/desktop : URL https (lien universel / QR). */
export function waveAppLaunchUrl(paymentUrl: string): string {
  if (!isAndroid() || !isWaveHttpsUrl(paymentUrl)) return paymentUrl
  try {
    const url = new URL(paymentUrl)
    const hostPath = `${url.host}${url.pathname}${url.search}${url.hash}`
    return `intent://${hostPath}#Intent;scheme=https;package=${WAVE_ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(url.href)};end`
  } catch {
    return paymentUrl
  }
}

/** Ouvre l’app Wave (même fenêtre — un nouvel onglet bloque souvent le deep link). */
export function openWaveCheckout(paymentUrl: string, options?: { newTab?: boolean }): void {
  const target = waveAppLaunchUrl(paymentUrl)
  if (options?.newTab) {
    window.open(target, '_blank', 'noopener,noreferrer')
    return
  }
  window.location.assign(target)
}
