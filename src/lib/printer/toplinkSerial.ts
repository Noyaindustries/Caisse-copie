const PRINTER_META_KEY = 'caisseci-toplink-printer-meta'

export type ToplinkPrinterMeta = {
  model: 'TL-R120'
  connectedAt: number | null
  lastUsedAt: number | null
  label: string
}

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open: (options: { baudRate: number }) => Promise<void>
  close: () => Promise<void>
  getInfo?: () => { usbVendorId?: number; usbProductId?: number }
}

type SerialApi = {
  requestPort: (options?: {
    filters?: Array<{ usbVendorId?: number; usbProductId?: number }>
  }) => Promise<SerialPortLike>
  getPorts: () => Promise<SerialPortLike[]>
}

declare global {
  interface Navigator {
    serial?: SerialApi
  }
}

let activePort: SerialPortLike | null = null
let openPromise: Promise<SerialPortLike> | null = null

function readMeta(): ToplinkPrinterMeta {
  try {
    const raw = localStorage.getItem(PRINTER_META_KEY)
    if (!raw) {
      return {
        model: 'TL-R120',
        connectedAt: null,
        lastUsedAt: null,
        label: 'Toplink TL-R120',
      }
    }
    const parsed = JSON.parse(raw) as Partial<ToplinkPrinterMeta>
    return {
      model: 'TL-R120',
      connectedAt:
        typeof parsed.connectedAt === 'number' ? parsed.connectedAt : null,
      lastUsedAt:
        typeof parsed.lastUsedAt === 'number' ? parsed.lastUsedAt : null,
      label:
        typeof parsed.label === 'string' && parsed.label.trim()
          ? parsed.label.trim()
          : 'Toplink TL-R120',
    }
  } catch {
    return {
      model: 'TL-R120',
      connectedAt: null,
      lastUsedAt: null,
      label: 'Toplink TL-R120',
    }
  }
}

function writeMeta(patch: Partial<ToplinkPrinterMeta>): ToplinkPrinterMeta {
  const next = { ...readMeta(), ...patch, model: 'TL-R120' as const }
  try {
    localStorage.setItem(PRINTER_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.serial)
}

export function getToplinkPrinterMeta(): ToplinkPrinterMeta {
  return readMeta()
}

export function isToplinkPrinterLinked(): boolean {
  return activePort != null || Boolean(readMeta().connectedAt)
}

async function ensurePortOpen(port: SerialPortLike): Promise<SerialPortLike> {
  if (port.writable) return port
  await port.open({ baudRate: 9600 })
  return port
}

/**
 * Demande à l'utilisateur de sélectionner le port série USB de la TL-R120.
 * Chrome / Edge uniquement (API Web Serial).
 */
export async function connectToplinkPrinter(): Promise<ToplinkPrinterMeta> {
  if (!navigator.serial) {
    throw new Error(
      'Web Serial indisponible. Utilisez Chrome ou Edge, ou imprimez via le pilote Windows.',
    )
  }
  const port = await navigator.serial.requestPort()
  await ensurePortOpen(port)
  activePort = port
  return writeMeta({
    connectedAt: Date.now(),
    lastUsedAt: Date.now(),
    label: 'Toplink TL-R120 (USB / série)',
  })
}

/** Réutilise un port déjà autorisé par le navigateur. */
export async function reconnectToplinkPrinter(): Promise<boolean> {
  if (!navigator.serial) return false
  if (activePort?.writable) return true
  const ports = await navigator.serial.getPorts()
  const port = ports[0]
  if (!port) return false
  await ensurePortOpen(port)
  activePort = port
  writeMeta({ lastUsedAt: Date.now(), connectedAt: Date.now() })
  return true
}

export async function disconnectToplinkPrinter(): Promise<void> {
  if (activePort) {
    try {
      await activePort.close()
    } catch {
      /* déjà fermé */
    }
  }
  activePort = null
  writeMeta({ connectedAt: null })
}

/**
 * Envoie des octets ESC/POS sur un port déjà autorisé.
 * Ne demande pas de nouveau sélecteur de port (pour l’impression vente).
 */
export async function sendRawToToplinkPrinter(
  data: Uint8Array,
): Promise<void> {
  if (openPromise) {
    await openPromise
  }
  openPromise = (async () => {
    if (activePort?.writable) return activePort
    const ok = await reconnectToplinkPrinter()
    if (!ok || !activePort?.writable) {
      throw new Error(
        'Imprimante Toplink non connectée. Liez-la dans Paramètres → Périphériques.',
      )
    }
    return activePort
  })()
  try {
    const port = await openPromise
    if (!port.writable) {
      throw new Error('Le port de l’imprimante n’est pas accessible en écriture.')
    }
    const writer = port.writable.getWriter()
    try {
      await writer.write(data)
      writeMeta({ lastUsedAt: Date.now() })
    } finally {
      writer.releaseLock()
    }
  } finally {
    openPromise = null
  }
}
