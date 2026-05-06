import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export const webhookRouter = Router()

type NormalizedOrder = {
  externalOrderRef: string
  customerName: string
  customerPhone?: string
  customerAddress?: string
  totalTTC: number
  currency?: string
  fulfillmentMode: 'delivery' | 'pickup'
  sourcePlatform: string
  rawStatus?: string
}

function asObject(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input != null
    ? (input as Record<string, unknown>)
    : {}
}

function asString(input: unknown): string | undefined {
  return typeof input === 'string' && input.trim() ? input.trim() : undefined
}

function asNumber(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) return input
  if (typeof input === 'string') {
    const n = Number(input.replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function normalizePayload(
  sourcePlatform: string,
  payload: Record<string, unknown>,
): NormalizedOrder | null {
  const order = asObject(payload.order ?? payload.data ?? payload)
  const customer = asObject(order.customer)
  const shipping = asObject(order.shippingAddress ?? order.deliveryAddress)
  const total =
    asNumber(order.totalTTC) ??
    asNumber(order.total) ??
    asNumber(order.amount) ??
    0
  const externalOrderRef =
    asString(order.id) ??
    asString(order.orderId) ??
    asString(order.reference) ??
    asString(payload.id)
  const customerName =
    asString(customer.name) ??
    asString(order.customerName) ??
    asString(order.name) ??
    'Client web'
  const fulfillmentRaw =
    asString(order.fulfillmentMode) ?? asString(order.fulfillment)
  const fulfillmentMode =
    fulfillmentRaw === 'pickup' || fulfillmentRaw === 'retrait'
      ? 'pickup'
      : 'delivery'

  if (!externalOrderRef || total <= 0) return null

  return {
    externalOrderRef,
    customerName,
    customerPhone: asString(customer.phone) ?? asString(order.customerPhone),
    customerAddress: asString(shipping.address) ?? asString(order.customerAddress),
    totalTTC: Math.round(total),
    currency: asString(order.currency),
    fulfillmentMode,
    sourcePlatform,
    rawStatus: asString(order.status),
  }
}

async function storeWebhookEvent(reqBody: unknown, source: string): Promise<string> {
  const payload = asObject(reqBody)
  const eventType = asString(payload.type) ?? 'order.received'
  const externalId = asString(payload.id)
  const normalizedOrder = normalizePayload(source, payload)
  const eventPayload: Record<string, unknown> = {
    ...payload,
    normalizedOrder,
    receivedVia: 'webhook',
  }
  const event = await prisma.webhookEvent.create({
    data: {
      source,
      eventType,
      externalId: externalId ?? normalizedOrder?.externalOrderRef,
      payload: eventPayload as Prisma.InputJsonValue,
    },
  })
  return event.id
}

function isAuthorized(reqToken: string | undefined): boolean {
  const expected = process.env.WEBHOOK_TOKEN
  if (!expected || expected.trim() === '') return true
  return reqToken != null && reqToken === expected
}

webhookRouter.post('/webhooks/orders', async (req, res) => {
  try {
    const token = req.header('x-webhook-token') ?? undefined
    if (!isAuthorized(token)) {
      return res.status(401).json({
        ok: false,
        message: 'Webhook non autorisé',
      })
    }
    const source =
      req.header('x-platform') ??
      req.query.source?.toString() ??
      'external-platform'
    const eventId = await storeWebhookEvent(req.body, source)
    return res.status(202).json({
      ok: true,
      webhookEventId: eventId,
    })
  } catch (error) {
    console.error('[webhook:orders] erreur', error)
    return res.status(500).json({
      ok: false,
      message: 'Erreur serveur lors de la réception webhook commandes',
    })
  }
})

webhookRouter.post('/webhooks/caisseci', async (req, res) => {
  try {
    const eventId = await storeWebhookEvent(req.body, 'caisseci')
    return res.status(201).json({
      ok: true,
      webhookEventId: eventId,
    })
  } catch (error) {
    console.error('[webhook] erreur', error)
    return res.status(500).json({
      ok: false,
      message: 'Erreur serveur lors de la réception webhook',
    })
  }
})
