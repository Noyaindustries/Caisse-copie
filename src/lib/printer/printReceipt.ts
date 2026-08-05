import { getDeviceConnectivityDemo } from '../integrationsConfig'
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
}

/**
 * Impression ticket : Toplink TL-R120 (ESC/POS via Web Serial) si déjà liée,
 * sinon dialogue d’impression navigateur (pilote Windows).
 */
export async function printReceipt(
  source: ReceiptPrintSource,
  options?: {
    preferBrowser?: boolean
    openCashDrawer?: boolean
    browserFallback?: () => void
  },
): Promise<PrintReceiptResult> {
  const devices = getDeviceConnectivityDemo()
  if (!devices.receiptPrinters) {
    throw new Error('Les imprimantes tickets sont désactivées dans Paramètres.')
  }

  const openCashDrawer =
    options?.openCashDrawer === true && devices.cashDrawer

  if (!options?.preferBrowser && isWebSerialSupported()) {
    try {
      const ready = await reconnectToplinkPrinter()
      if (ready) {
        const payload = buildEscPosReceipt(source, { openCashDrawer })
        await sendRawToToplinkPrinter(payload)
        return {
          mode: 'escpos',
          message: 'Ticket envoyé à l’imprimante Toplink TL-R120.',
        }
      }
    } catch {
      /* bascule navigateur */
    }
  }

  if (options?.browserFallback) {
    options.browserFallback()
  }
  return {
    mode: 'browser',
    message:
      'Impression via le pilote Windows / dialogue navigateur. Pour l’ESC/POS direct, liez la TL-R120 dans Paramètres → Périphériques (Chrome / Edge).',
  }
}

export async function printToplinkTestPage(): Promise<string> {
  if (!isWebSerialSupported()) {
    throw new Error(
      'Web Serial requis (Chrome ou Edge). Sinon, installez le pilote Windows de la TL-R120.',
    )
  }
  const ready = await reconnectToplinkPrinter()
  if (!ready) {
    await connectToplinkPrinter()
  }
  await sendRawToToplinkPrinter(buildEscPosTestPage())
  return 'Page de test imprimée sur Toplink TL-R120.'
}
