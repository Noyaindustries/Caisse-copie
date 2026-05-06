/** Clés localStorage pour la démo « intégrations » (sans backend). */
const KEY_API = 'caisseci-demo-partner-api-key'
const KEY_COMPTA = 'caisseci-module-compta-demo'
const KEY_ECOM = 'caisseci-module-ecom-demo'
const KEY_DELIVERY = 'caisseci-module-delivery-demo'
const KEY_DELIVERY_PROVIDER = 'caisseci-delivery-provider'
const KEY_DELIVERY_WEBHOOK = 'caisseci-delivery-webhook-url'
const KEY_KITCHEN = 'caisseci-module-kitchen-demo'
const KEY_KITCHEN_STATION = 'caisseci-kitchen-station'
const KEY_ONLINE_PLATFORMS = 'caisseci-online-platforms'
const KEY_ONLINE_SYNC_MODE = 'caisseci-online-sync-mode'
const KEY_DEVICE_ORDER_TERMINALS = 'caisseci-device-order-terminals'
const KEY_DEVICE_RECEIPT_PRINTERS = 'caisseci-device-receipt-printers'
const KEY_DEVICE_KDS_SCREENS = 'caisseci-device-kds-screens'
const KEY_DEVICE_CASH_DRAWER = 'caisseci-device-cash-drawer'
const KEY_DEVICE_PAYMENT_TERMINALS = 'caisseci-device-payment-terminals'

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

export function isDeliveryModuleDemoOn(): boolean {
  try {
    return localStorage.getItem(KEY_DELIVERY) === '1'
  } catch {
    return false
  }
}

export function setDeliveryModuleDemo(on: boolean): void {
  try {
    localStorage.setItem(KEY_DELIVERY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function getDeliveryProviderDemo(): string {
  try {
    return localStorage.getItem(KEY_DELIVERY_PROVIDER) || 'Coursier interne'
  } catch {
    return 'Coursier interne'
  }
}

export function setDeliveryProviderDemo(provider: string): void {
  try {
    localStorage.setItem(KEY_DELIVERY_PROVIDER, provider.trim() || 'Coursier interne')
  } catch {
    /* ignore */
  }
}

export function getDeliveryWebhookDemo(): string {
  try {
    return localStorage.getItem(KEY_DELIVERY_WEBHOOK) || ''
  } catch {
    return ''
  }
}

export function setDeliveryWebhookDemo(url: string): void {
  try {
    localStorage.setItem(KEY_DELIVERY_WEBHOOK, url.trim())
  } catch {
    /* ignore */
  }
}

export function isKitchenModuleDemoOn(): boolean {
  try {
    return localStorage.getItem(KEY_KITCHEN) === '1'
  } catch {
    return false
  }
}

export function setKitchenModuleDemo(on: boolean): void {
  try {
    localStorage.setItem(KEY_KITCHEN, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function getKitchenStationDemo(): string {
  try {
    return localStorage.getItem(KEY_KITCHEN_STATION) || 'Cuisine principale'
  } catch {
    return 'Cuisine principale'
  }
}

export function setKitchenStationDemo(station: string): void {
  try {
    localStorage.setItem(
      KEY_KITCHEN_STATION,
      station.trim() || 'Cuisine principale',
    )
  } catch {
    /* ignore */
  }
}

export type ConnectedPlatform =
  | 'shopify'
  | 'glovo'
  | 'ubereats'
  | 'jumia'
  | 'whatsapp'

const DEFAULT_PLATFORMS: ConnectedPlatform[] = ['shopify']

export function getConnectedPlatformsDemo(): ConnectedPlatform[] {
  try {
    const raw = localStorage.getItem(KEY_ONLINE_PLATFORMS)
    if (!raw) return DEFAULT_PLATFORMS
    const parsed = JSON.parse(raw) as string[]
    const allowed = new Set<ConnectedPlatform>([
      'shopify',
      'glovo',
      'ubereats',
      'jumia',
      'whatsapp',
    ])
    const out = parsed.filter((p): p is ConnectedPlatform => allowed.has(p as ConnectedPlatform))
    return out.length > 0 ? out : DEFAULT_PLATFORMS
  } catch {
    return DEFAULT_PLATFORMS
  }
}

export function setConnectedPlatformsDemo(platforms: ConnectedPlatform[]): void {
  try {
    localStorage.setItem(KEY_ONLINE_PLATFORMS, JSON.stringify(platforms))
  } catch {
    /* ignore */
  }
}

export function getOnlineSyncModeDemo(): 'webhook' | 'pull' {
  try {
    const raw = localStorage.getItem(KEY_ONLINE_SYNC_MODE)
    return raw === 'pull' ? 'pull' : 'webhook'
  } catch {
    return 'webhook'
  }
}

export function setOnlineSyncModeDemo(mode: 'webhook' | 'pull'): void {
  try {
    localStorage.setItem(KEY_ONLINE_SYNC_MODE, mode)
  } catch {
    /* ignore */
  }
}

export type DeviceConnectivityDemo = {
  orderTerminals: boolean
  receiptPrinters: boolean
  kitchenScreens: boolean
  cashDrawer: boolean
  paymentTerminals: boolean
}

const DEFAULT_DEVICE_CONNECTIVITY: DeviceConnectivityDemo = {
  orderTerminals: true,
  receiptPrinters: true,
  kitchenScreens: true,
  cashDrawer: false,
  paymentTerminals: false,
}

function readBoolKey(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return raw === '1'
  } catch {
    return fallback
  }
}

function writeBoolKey(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function getDeviceConnectivityDemo(): DeviceConnectivityDemo {
  return {
    orderTerminals: readBoolKey(
      KEY_DEVICE_ORDER_TERMINALS,
      DEFAULT_DEVICE_CONNECTIVITY.orderTerminals,
    ),
    receiptPrinters: readBoolKey(
      KEY_DEVICE_RECEIPT_PRINTERS,
      DEFAULT_DEVICE_CONNECTIVITY.receiptPrinters,
    ),
    kitchenScreens: readBoolKey(
      KEY_DEVICE_KDS_SCREENS,
      DEFAULT_DEVICE_CONNECTIVITY.kitchenScreens,
    ),
    cashDrawer: readBoolKey(
      KEY_DEVICE_CASH_DRAWER,
      DEFAULT_DEVICE_CONNECTIVITY.cashDrawer,
    ),
    paymentTerminals: readBoolKey(
      KEY_DEVICE_PAYMENT_TERMINALS,
      DEFAULT_DEVICE_CONNECTIVITY.paymentTerminals,
    ),
  }
}

export function setDeviceConnectivityDemo(config: DeviceConnectivityDemo): void {
  writeBoolKey(KEY_DEVICE_ORDER_TERMINALS, config.orderTerminals)
  writeBoolKey(KEY_DEVICE_RECEIPT_PRINTERS, config.receiptPrinters)
  writeBoolKey(KEY_DEVICE_KDS_SCREENS, config.kitchenScreens)
  writeBoolKey(KEY_DEVICE_CASH_DRAWER, config.cashDrawer)
  writeBoolKey(KEY_DEVICE_PAYMENT_TERMINALS, config.paymentTerminals)
}
