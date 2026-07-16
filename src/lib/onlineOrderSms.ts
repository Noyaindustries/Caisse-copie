import type { OnlineOrder } from '../db/types'
import { apiUrl } from './apiUrl'

type SmsSendResult =
  | { ok: true; mode: 'webhook' | 'demo' }
  | { ok: false; error: string }

function normalizePhone(raw?: string): string {
  return (raw ?? '').replace(/\D/g, '')
}

function buildApprovalMessage(order: OnlineOrder): string {
  if (order.customerMessage && order.customerMessage.trim()) {
    return order.customerMessage.trim()
  }
  const ref = order.id.slice(0, 8).toUpperCase()
  return `Bonjour ${order.customerName}, votre commande ${ref} a ete validee avec succes. Merci pour votre confiance.`
}

export async function sendOrderApprovedSms(
  order: OnlineOrder,
): Promise<SmsSendResult> {
  const phone = normalizePhone(order.customerPhone)
  if (!phone) {
    return { ok: false, error: 'Numero client absent.' }
  }
  const message = buildApprovalMessage(order)
  const explicitEndpoint = import.meta.env.VITE_SMS_WEBHOOK_URL?.trim()
  const endpoint = explicitEndpoint || apiUrl('/webhooks/sms')

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone,
        message,
        orderId: order.id,
        storeId: order.storeId,
        customerName: order.customerName,
      }),
    })
    if (!res.ok) {
      return { ok: false, error: `SMS HTTP ${res.status}` }
    }
    return { ok: true, mode: explicitEndpoint ? 'webhook' : 'demo' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
