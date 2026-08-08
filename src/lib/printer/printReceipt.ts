import { getDeviceConnectivityDemo } from '../integrationsConfig'
import { cmdInit, cmdOpenCashDrawer, concatBytes } from './escpos'
import {
  buildEscPosReceipt,
  buildEscPosTestPage,
  type ReceiptPrintSource,
} from './receiptEscPos'
import {
  connectToplinkPrinter,
  isWebSerialSupported,
  reconnectToplinkPrinter,
  sendRawToToplinkPrinter,
} from './toplinkSerial'

export type PrintReceiptResult = {
  mode: 'escpos' | 'browser'
  message: string
  drawerOpened?: boolean
}

/** True si un port ESC/POS Toplink est réellement ouvert / reconnectable. */
export async function isToplinkEscPosReady(): Promise<boolean> {
  if (!isWebSerialSupported()) return false
  try {
    return await reconnectToplinkPrinter()
  } catch {
    return false
  }
}

/**
 * Envoie uniquement la commande d’ouverture tiroir (ESC/POS).
 * Nécessite un port COM / Web Serial — inactif avec le seul pilote Windows GDI.
 */
export async function kickCashDrawer(): Promise<boolean> {
  if (!isWebSerialSupported()) return false
  try {
    const ready = await reconnectToplinkPrinter()
    if (!ready) return false
    await sendRawToToplinkPrinter(
      concatBytes(cmdInit(), cmdOpenCashDrawer(), cmdOpenCashDrawer()),
    )
    return true
  } catch {
    return false
  }
}

export const CASH_DRAWER_WINDOWS_HINT =
  'Tiroir via Windows : Paramètres → Imprimantes → POS-80 → Préférences d’impression → ouvrir le tiroir avant/après impression (broche 2). Ou branchez en mode USB Virtual COM pour l’ESC/POS.'

/**
 * Impression ticket : Toplink TL-R120 (ESC/POS via Web Serial) si déjà liée,
 * sinon dialogue d’impression navigateur (pilote Windows POS-80).
 */
export async function printReceipt(
  source: ReceiptPrintSource,
  options?: {
    preferBrowser?: boolean
    openCashDrawer?: boolean
    browserFallback?: () => void | Promise<void>
  },
): Promise<PrintReceiptResult> {
  const devices = getDeviceConnectivityDemo()
  if (!devices.receiptPrinters) {
    throw new Error('Les imprimantes tickets sont désactivées dans Paramètres.')
  }

  const wantDrawer =
    options?.openCashDrawer === true &&
    (devices.cashDrawer || devices.receiptPrinters)

  let toplinkError: Error | null = null
  let drawerOpened = false

  if (!options?.preferBrowser && isWebSerialSupported()) {
    try {
      const ready = await reconnectToplinkPrinter()
      if (ready) {
        const payload = buildEscPosReceipt(source, {
          openCashDrawer: wantDrawer,
        })
        await sendRawToToplinkPrinter(payload)
        return {
          mode: 'escpos',
          message: wantDrawer
            ? 'Ticket envoyé à l’imprimante (tiroir déclenché).'
            : 'Ticket envoyé à l’imprimante Toplink TL-R120.',
          drawerOpened: wantDrawer,
        }
      }
    } catch (err) {
      toplinkError =
        err instanceof Error
          ? err
          : new Error('Échec d’envoi vers la Toplink TL-R120.')
    }
  }

  // Impression Windows : tenter quand même le pulse ESC/POS si un COM existe.
  if (wantDrawer) {
    drawerOpened = await kickCashDrawer()
  }

  if (options?.browserFallback) {
    await options.browserFallback()
    const parts: string[] = [
      'Impression via le pilote Windows (POS-80).',
    ]
    if (wantDrawer && !drawerOpened) {
      parts.push(CASH_DRAWER_WINDOWS_HINT)
    } else if (wantDrawer && drawerOpened) {
      parts.push('Tiroir ouvert via ESC/POS.')
    }
    if (toplinkError) {
      parts.unshift(toplinkError.message)
    }
    return {
      mode: 'browser',
      message: parts.join(' '),
      drawerOpened,
    }
  }

  if (toplinkError) {
    throw toplinkError
  }

  return {
    mode: 'browser',
    message:
      'Impression via le pilote Windows / dialogue navigateur. Pour l’ESC/POS direct, liez la TL-R120 dans Paramètres → Périphériques (Chrome / Edge).',
    drawerOpened,
  }
}

export async function printToplinkTestPage(): Promise<string> {
  if (!isWebSerialSupported()) {
    throw new Error(
      'Web Serial requis (Chrome ou Edge sur localhost/HTTPS). Sinon, installez le pilote Windows de la TL-R120.',
    )
  }
  const ready = await reconnectToplinkPrinter()
  if (!ready) {
    await connectToplinkPrinter()
  }
  await sendRawToToplinkPrinter(buildEscPosTestPage())
  return 'Page de test imprimée sur Toplink TL-R120.'
}
