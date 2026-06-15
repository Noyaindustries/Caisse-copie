import { prisma } from './prisma.js'

export async function findStorefrontOrderByExternalId(externalId: string) {
  return prisma.storefrontOrder.findUnique({ where: { externalId } })
}

export async function markStorefrontOrderPaid(
  externalId: string,
  extra?: {
    waveSessionId?: string | null
    waveTransactionId?: string | null
    notifyPayload?: unknown
  },
): Promise<boolean> {
  const row = await prisma.storefrontOrder.findUnique({ where: { externalId } })
  if (!row) return false
  if (row.status !== 'awaiting_payment') {
    return row.status === 'pending'
  }

  const basePayload =
    typeof row.payload === 'object' && row.payload !== null
      ? (row.payload as Record<string, unknown>)
      : {}

  const waveSessionId =
    extra?.waveSessionId ??
    (typeof basePayload.waveSessionId === 'string' ? basePayload.waveSessionId : null)

  await prisma.storefrontOrder.update({
    where: { id: row.id },
    data: {
      status: 'pending',
      payload: {
        ...basePayload,
        status: 'pending',
        paymentStatus: 'paid',
        paymentProvider: 'wave',
        waveSessionId,
        waveTransactionId: extra?.waveTransactionId ?? null,
        paidAt: new Date().toISOString(),
        paymentNotifyPayload: extra?.notifyPayload ?? null,
      },
    },
  })
  return true
}

export async function markStorefrontOrderPaymentRefused(
  externalId: string,
  notifyPayload?: unknown,
): Promise<boolean> {
  const row = await prisma.storefrontOrder.findUnique({ where: { externalId } })
  if (!row || row.status !== 'awaiting_payment') return false

  const basePayload =
    typeof row.payload === 'object' && row.payload !== null
      ? (row.payload as Record<string, unknown>)
      : {}

  await prisma.storefrontOrder.update({
    where: { id: row.id },
    data: {
      status: 'payment_failed',
      payload: {
        ...basePayload,
        status: 'payment_failed',
        paymentStatus: 'failed',
        paymentNotifyPayload: notifyPayload ?? null,
      },
    },
  })
  return true
}
