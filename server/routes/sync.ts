import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireActiveOrg } from '../lib/orgAuth.js'
import { assertSubscriptionActive } from '../lib/quotaEnforcement.js'
import { logEvent } from '../lib/structuredLog.js'
import { collectOrgSyncDeltas } from '../lib/syncMerge.js'
import { syncBatchSchema } from '../validators/sync.js'

export const syncRouter = Router()

syncRouter.post('/caisseci/sync', async (req, res) => {
  try {
    const org = await requireActiveOrg(req, res)
    if (!org) return

    const data = syncBatchSchema.parse(req.body)
    const source = req.header('x-source') ?? req.header('x-terminal-id') ?? null
    const raw = data as unknown as Prisma.InputJsonValue

    await prisma.syncBatch.upsert({
      where: { batchId: data.batchId },
      update: {
        sentAt: new Date(data.sentAt),
        source,
        raw,
        status: 'received',
        error: null,
      },
      create: {
        batchId: data.batchId,
        organizationId: org.id,
        sentAt: new Date(data.sentAt),
        source,
        raw,
        status: 'received',
        items: {
          create: data.items.map((item) => ({
            kind: item.kind,
            createdAt: new Date(item.createdAt),
            payload: item.payload as Prisma.InputJsonValue,
          })),
        },
      },
    })

    logEvent('info', 'sync.push', {
      organizationId: org.id,
      batchId: data.batchId,
      items: data.items.length,
    })

    return res.status(200).json({
      ok: true,
      processed: data.items.length,
      batchId: data.batchId,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        ok: false,
        message: 'Payload de synchronisation invalide',
        issues: error.issues,
      })
    }

    logEvent('error', 'sync.push.failed', {
      error: error instanceof Error ? error.message : 'unknown',
    })
    return res.status(500).json({
      ok: false,
      message: 'Erreur serveur lors de la synchronisation',
    })
  }
})

syncRouter.get('/caisseci/sync/pull', async (req, res) => {
  try {
    const org = await requireActiveOrg(req, res)
    if (!org) return

    const sinceRaw = req.query.since
    const since =
      typeof sinceRaw === 'string' && sinceRaw.trim()
        ? new Date(Number.parseInt(sinceRaw, 10))
        : new Date(0)

    if (Number.isNaN(since.getTime())) {
      return res.status(400).json({ ok: false, message: 'Paramètre since invalide.' })
    }

    const excludeTerminal = req.header('x-terminal-id')?.trim() ?? null
    const sinceMs = since.getTime()

    const [
      staffRows,
      orders,
      integration,
      deltas,
      catalogCategories,
      workspaceCatalog,
      workspaceOps,
    ] = await Promise.all([
      prisma.staffMember
        .findMany({
          where: { organizationId: org.id },
          orderBy: { updatedAt: 'desc' },
        })
        .then((rows) => rows.filter((row) => row.revokedAt == null)),
      prisma.storefrontOrder.findMany({
        where: {
          organizationId: org.id,
          updatedAt: { gte: since },
        },
        orderBy: { updatedAt: 'asc' },
        take: 200,
      }),
      prisma.orgIntegration.findUnique({ where: { organizationId: org.id } }),
      collectOrgSyncDeltas(org.id, sinceMs, excludeTerminal),
      import('../lib/catalogCategories.js').then((m) =>
        m.getOrgCatalogCategories(org.id),
      ),
      import('../lib/workspaceCatalog.js').then((m) =>
        m.getOrgWorkspaceCatalog(org.id),
      ),
      import('../lib/workspaceOps.js').then((m) => m.getOrgWorkspaceOps(org.id)),
    ])

    const blocked = assertSubscriptionActive(org)
    if (blocked) {
      return res.status(402).json({ ok: false, message: blocked })
    }

    return res.status(200).json({
      ok: true,
      pulledAt: Date.now(),
      staff: staffRows.map((row) => ({
        id: row.profileId,
        displayName: row.displayName,
        initials: row.initials,
        role: row.role,
        storeId: row.storeId,
        active: row.active,
        updatedAt: row.updatedAt.getTime(),
      })),
      storefrontOrders: orders.map((order) => ({
        id: order.externalId,
        status: order.status,
        payload: order.payload,
        createdAt: order.createdAt.getTime(),
        updatedAt: order.updatedAt.getTime(),
      })),
      integrations: integration?.config ?? {},
      catalogCategories,
      workspaceCatalog,
      workspaceOps,
      sales: deltas.sales,
      stockUpdates: deltas.stockUpdates,
      organization: {
        storeCode: org.storeCode,
        planId: org.planId,
        status: org.status,
        storefrontPublishedAt: org.storefrontPublishedAt?.getTime() ?? null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    logEvent('error', 'sync.pull.failed', { error: message })
    console.error('[sync/pull]', error)
    return res.status(500).json({
      ok: false,
      message: 'Erreur serveur lors du téléchargement cloud',
    })
  }
})
