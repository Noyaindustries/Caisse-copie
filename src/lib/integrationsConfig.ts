/** Clés localStorage pour la démo « intégrations » (sans backend). */
const KEY_API = 'caisseci-demo-partner-api-key'
const KEY_COMPTA = 'caisseci-module-compta-demo'
const KEY_ECOM = 'caisseci-module-ecom-demo'

export function getOrCreateDemoApiKey(): string {
  try {
    let k = localStorage.getItem(KEY_API)
    if (!k) {
      k = `ck_live_${crypto.randomUUID().replace(/-/g, '')}`
      localStorage.setItem(KEY_API, k)
    }
    return k
  } catch {
    return 'ck_live_••••••••••••••••'
  }
}

export function isComptaModuleDemoOn(): boolean {
  try {
    return localStorage.getItem(KEY_COMPTA) === '1'
  } catch {
    return false
  }
}

export function setComptaModuleDemo(on: boolean): void {
  try {
    localStorage.setItem(KEY_COMPTA, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function isEcomModuleDemoOn(): boolean {
  try {
    return localStorage.getItem(KEY_ECOM) === '1'
  } catch {
    return false
  }
}

export function setEcomModuleDemo(on: boolean): void {
  try {
    localStorage.setItem(KEY_ECOM, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}
