import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { publicAppUrl } from '../lib/stripe.js'
import {
  isSubscriptionUsable,
  type PlanId,
  type SubscriptionStatus,
} from '../lib/subscriptionPlans.js'
import { normalizeStoreCode } from './billing.js'

export const storefrontRouter = Router()

function parsePlanId(value: string | undefined): PlanId {
  if (value === 'pro' || value === 'business') return value
  return 'starter'
}

function parseStatus(value: string | undefined): SubscriptionStatus {
  if (
    value === 'active' ||
    value === 'trialing' ||
    value === 'past_due' ||
    value === 'canceled' ||
    value === 'expired'
  ) {
    return value
  }
  return 'expired'
}

const publishedProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceTTC: z.number().nonnegative(),
  category: z.string().min(1),
  vatRatePct: z.number().nonnegative(),
  imageDataUrl: z.string().optional(),
  stock: z.number().nonnegative(),
  barcode: z.string().optional(),
  lowStockThreshold: z.number().nonnegative().optional(),
})

const publishMenuSchema = z.object({
  storeId: z.string().min(1),
  storeName: z.string().min(1),
  products: z.array(publishedProductSchema),
})

const orderLineSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  unitPriceTTC: z.number().nonnegative(),
  qty: z.number().int().positive(),
  vatRatePct: z.number().nonnegative(),
})

const submitOrderSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  customerNote: z.string().optional(),
  desiredTimeSlot: z.string().optional(),
  paymentMethod: z.enum(['cash', 'card', 'mobile', 'mixed']),
  fulfillmentMode: z.enum(['pickup', 'delivery']),
  lines: z.array(orderLineSchema).min(1),
  subtotalHT: z.number().nonnegative(),
  tva: z.number().nonnegative(),
  totalTTC: z.number().nonnegative(),
  netProductsTTC: z.number().nonnegative(),
  discountPct: z.number().optional(),
  promoCode: z.string().optional(),
  deliveryFeeTTC: z.number().optional(),
})

function readLicenseKey(req: Request): string | null {
  const header = req.get('x-license-key')?.trim()
  if (header) return header
  const query = typeof req.query.licenseKey === 'string' ? req.query.licenseKey.trim() : ''
  return query || null
}

function storefrontPath(storeCode: string): string {
  return `/boutique/${encodeURIComponent(storeCode)}`
}

function publicStorefrontUrl(req: Request, storeCode: string): string {
  return `${publicAppUrl(req)}${storefrontPath(storeCode)}`
}

async function findOrgByStoreCodeParam(raw: string) {
  const normalized = normalizeStoreCode(raw)
  if (!normalized) return null
  return prisma.organization.findUnique({ where: { storeCode: normalized } })
}

storefrontRouter.get('/billing/storefront/:storeCode', async (req, res) => {
  try {
    const org = await findOrgByStoreCodeParam(req.params.storeCode)
    if (!org || !org.storeCode) {
      res.status(404).json({ error: 'Boutique introuvable.' })
      return
    }
    const status = parseStatus(org.status)
    const usable = isSubscriptionUsable(status, org.currentPeriodEnd)
    res.json({
      organizationId: org.id,
      name: org.name,
      storeCode: org.storeCode,
      usable,
      planId: parsePlanId(org.planId),
      storefrontUrl: publicStorefrontUrl(req, org.storeCode),
      menuPublished: Boolean(org.storefrontMenu),
      publishedAt: org.storefrontPublishedAt?.toISOString() ?? null,
    })
  } catch (err) {
    console.error('[storefront/info]', err)
    res.status(500).json({ error: 'Impossible de charger la boutique.' })
  }
})

storefrontRouter.get('/billing/storefront/:storeCode/menu', async (req, res) => {
  try {
    const org = await findOrgByStoreCodeParam(req.params.storeCode)
    if (!org || !org.storeCode) {
      res.status(404).json({ error: 'Boutique introuvable.' })
      return
    }
    if (!org.storefrontMenu) {
      res.status(404).json({ error: 'Menu non publié. Le commerçant doit publier son catalogue.' })
      return
    }
    res.json({
      organizationId: org.id,
      name: org.name,
      storeCode: org.storeCode,
      publishedAt: org.storefrontPublishedAt?.toISOString() ?? null,
      menu: org.storefrontMenu,
    })
  } catch (err) {
    console.error('[storefront/menu]', err)
    res.status(500).json({ error: 'Impossible de charger le menu.' })
  }
})

storefrontRouter.post('/billing/storefront/:storeCode/orders', async (req, res) => {
  try {
    const org = await findOrgByStoreCodeParam(req.params.storeCode)
    if (!org || !org.storeCode) {
      res.status(404).json({ error: 'Boutique introuvable.' })
      return
    }
    const status = parseStatus(org.status)
    if (!isSubscriptionUsable(status, org.currentPeriodEnd)) {
      res.status(403).json({ error: 'Cette boutique n’accepte pas de commandes pour le moment.' })
      return
    }
    const body = submitOrderSchema.parse(req.body)
    const externalId = randomUUID()
    const createdAt = Date.now()
    const payload = {
      ...body,
      id: externalId,
      createdAt,
      storeId: typeof (org.storefrontMenu as { storeId?: string } | null)?.storeId === 'string'
        ? (org.storefrontMenu as { storeId: string }).storeId
        : 'store-main',
      storeName: typeof (org.storefrontMenu as { storeName?: string } | null)?.storeName === 'string'
        ? (org.storefrontMenu as { storeName: string }).storeName
        : org.name,
      storeCode: org.storeCode,
      source: 'public_storefront',
      status: 'pending',
    }

    await prisma.storefrontOrder.create({
      data: {
        organizationId: org.id,
        storeCode: org.storeCode,
        externalId,
        status: 'pending',
        payload,
      },
    })

    res.status(201).json({
      orderId: externalId,
      reference: externalId.slice(0, 8).toUpperCase(),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Commande invalide.' })
      return
    }
    console.error('[storefront/orders]', err)
    res.status(500).json({ error: 'Impossible d’enregistrer la commande.' })
  }
})

storefrontRouter.post('/billing/storefront/publish', async (req, res) => {
  try {
    const licenseKey = readLicenseKey(req)
    if (!licenseKey) {
      res.status(401).json({ error: 'Clé de licence requise.' })
      return
    }
    const org = await prisma.organization.findUnique({ where: { licenseKey } })
    if (!org || !org.storeCode) {
      res.status(404).json({ error: 'Organisation introuvable.' })
      return
    }
    const menu = publishMenuSchema.parse(req.body)
    const publishedAt = new Date()
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        storefrontMenu: { ...menu, publishedAt: publishedAt.toISOString() },
        storefrontPublishedAt: publishedAt,
      },
    })
    res.json({
      ok: true,
      publishedAt: publishedAt.toISOString(),
      storefrontUrl: publicStorefrontUrl(req, org.storeCode),
      productCount: menu.products.length,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Catalogue invalide.' })
      return
    }
    console.error('[storefront/publish]', err)
    res.status(500).json({ error: 'Publication impossible.' })
  }
})

storefrontRouter.get('/billing/storefront/orders/inbox', async (req, res) => {
  try {
    const licenseKey = readLicenseKey(req)
    if (!licenseKey) {
      res.status(401).json({ error: 'Clé de licence requise.' })
      return
    }
    const org = await prisma.organization.findUnique({ where: { licenseKey } })
    if (!org) {
      res.status(404).json({ error: 'Organisation introuvable.' })
      return
    }
    const status =
      typeof req.query.status === 'string' && req.query.status.trim()
        ? req.query.status.trim()
        : 'pending'
    const rows = await prisma.storefrontOrder.findMany({
      where: { organizationId: org.id, status },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    res.json({
      orders: rows.map((row) => ({
        id: row.externalId,
        serverId: row.id,
        createdAt: row.createdAt.getTime(),
        status: row.status,
        ...(typeof row.payload === 'object' && row.payload !== null ? row.payload : {}),
      })),
    })
  } catch (err) {
    console.error('[storefront/inbox]', err)
    res.status(500).json({ error: 'Impossible de charger les commandes web.' })
  }
})

storefrontRouter.patch('/billing/storefront/orders/:externalId', async (req, res) => {
  try {
    const licenseKey = readLicenseKey(req)
    if (!licenseKey) {
      res.status(401).json({ error: 'Clé de licence requise.' })
      return
    }
    const org = await prisma.organization.findUnique({ where: { licenseKey } })
    if (!org) {
      res.status(404).json({ error: 'Organisation introuvable.' })
      return
    }
    const nextStatus =
      typeof req.body?.status === 'string' ? req.body.status.trim() : ''
    if (!nextStatus) {
      res.status(400).json({ error: 'Statut requis.' })
      return
    }
    const row = await prisma.storefrontOrder.findFirst({
      where: { externalId: req.params.externalId, organizationId: org.id },
    })
    if (!row) {
      res.status(404).json({ error: 'Commande introuvable.' })
      return
    }
    const payload =
      typeof row.payload === 'object' && row.payload !== null
        ? { ...(row.payload as Record<string, unknown>), status: nextStatus }
        : { status: nextStatus }
    await prisma.storefrontOrder.update({
      where: { id: row.id },
      data: { status: nextStatus, payload },
    })
    res.json({ ok: true, status: nextStatus })
  } catch (err) {
    console.error('[storefront/order-patch]', err)
    res.status(500).json({ error: 'Mise à jour impossible.' })
  }
})
