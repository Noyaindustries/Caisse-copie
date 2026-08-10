import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireActiveOrg, requireOrg } from '../lib/orgAuth.js'
import { SUBSCRIPTION_PLANS, parsePlanId } from '../lib/subscriptionPlans.js'
import { logEvent } from '../lib/structuredLog.js'

export const orgRouter = Router()

orgRouter.get('/org/backup', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return

  const [staff, syncBatches, integration, payments] = await Promise.all([
    prisma.staffMember.findMany({
      where: { organizationId: org.id, revokedAt: null },
      select: {
        profileId: true,
        displayName: true,
        role: true,
        active: true,
        updatedAt: true,
      },
    }),
    prisma.syncBatch.findMany({
      where: { organizationId: org.id },
      orderBy: { receivedAt: 'desc' },
      take: 100,
      select: {
        batchId: true,
        sentAt: true,
        receivedAt: true,
        status: true,
        source: true,
      },
    }),
    prisma.orgIntegration.findUnique({ where: { organizationId: org.id } }),
    prisma.mobileMoneyPayment.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        transactionId: true,
        planId: true,
        channel: true,
        amountFcfa: true,
        status: true,
        createdAt: true,
        paidAt: true,
      },
    }),
  ])

  logEvent('info', 'org.backup.export', { organizationId: org.id })

  res.json({
    exportedAt: new Date().toISOString(),
    organization: {
      id: org.id,
      name: org.name,
      email: org.email,
      storeCode: org.storeCode,
      planId: parsePlanId(org.planId),
      plan: SUBSCRIPTION_PLANS[parsePlanId(org.planId)],
      status: org.status,
      trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
    },
    staff,
    syncBatches,
    integrations: integration?.config ?? {},
    payments,
  })
})

const resetDataSchema = z.object({
  confirmName: z.string().trim().min(1).max(200),
})

/**
 * Purge métier de l’organisation connectée.
 * Conserve compte (email/mdp), licence, storeCode/slug et abonnement.
 */
orgRouter.post('/org/reset-data', async (req, res) => {
  try {
    const org = await requireActiveOrg(req, res)
    if (!org) return

    const body = resetDataSchema.parse(req.body ?? {})
    if (body.confirmName.toLowerCase() !== org.name.trim().toLowerCase()) {
      res.status(400).json({
        error:
          'Confirmation invalide : saisissez exactement le nom de l’entreprise.',
      })
      return
    }

    const forceClientWipeAt = Date.now()

    await prisma.$transaction([
      prisma.storefrontOrder.deleteMany({ where: { organizationId: org.id } }),
      prisma.staffMember.deleteMany({ where: { organizationId: org.id } }),
      prisma.orgSession.deleteMany({ where: { organizationId: org.id } }),
      prisma.auditLog.deleteMany({ where: { organizationId: org.id } }),
      prisma.mobileMoneyPayment.deleteMany({ where: { organizationId: org.id } }),
      prisma.subscriptionReminderLog.deleteMany({
        where: { organizationId: org.id },
      }),
      prisma.syncBatch.deleteMany({ where: { organizationId: org.id } }),
    ])

    const existingIntegration = await prisma.orgIntegration.findUnique({
      where: { organizationId: org.id },
    })
    const prevConfig =
      existingIntegration?.config &&
      typeof existingIntegration.config === 'object' &&
      existingIntegration.config !== null &&
      !Array.isArray(existingIntegration.config)
        ? (existingIntegration.config as Record<string, unknown>)
        : {}
    const nextConfig = {
      ...prevConfig,
      forceClientWipeAt,
    } as Prisma.InputJsonValue

    await prisma.orgIntegration.upsert({
      where: { organizationId: org.id },
      update: { config: nextConfig },
      create: { organizationId: org.id, config: nextConfig },
    })

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        storefrontMenu: null,
        storefrontPublishedAt: null,
        waveApiKey: null,
        waveWebhookSecret: null,
        waveSigningSecret: null,
        waveDemoMode: false,
        cinetpayApiKey: null,
        cinetpaySiteId: null,
        cinetpayDemoMode: false,
        taxId: null,
        fiscalRegime: 'REEL',
        fneEnabled: false,
      },
    })

    logEvent('info', 'org.reset-data', {
      organizationId: org.id,
      forceClientWipeAt,
    })

    res.json({ ok: true, forceClientWipeAt })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Requête invalide.' })
      return
    }
    console.error('[org/reset-data]', err)
    res.status(500).json({ error: 'Réinitialisation impossible.' })
  }
})

orgRouter.get('/org/integrations', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return

  const row = await prisma.orgIntegration.findUnique({
    where: { organizationId: org.id },
  })

  res.json({ config: row?.config ?? {} })
})

orgRouter.put('/org/integrations', async (req, res) => {
  try {
    const org = await requireOrg(req, res)
    if (!org) return

    const incoming = z
      .record(z.unknown())
      .parse(req.body?.config ?? req.body) as Record<string, unknown>

    // Ne pas écraser un jeton de wipe plus récent déjà en base.
    const existing = await prisma.orgIntegration.findUnique({
      where: { organizationId: org.id },
    })
    const prev =
      existing?.config &&
      typeof existing.config === 'object' &&
      existing.config !== null &&
      !Array.isArray(existing.config)
        ? (existing.config as Record<string, unknown>)
        : {}
    const prevWipe =
      typeof prev.forceClientWipeAt === 'number' ? prev.forceClientWipeAt : 0
    const nextWipe =
      typeof incoming.forceClientWipeAt === 'number'
        ? incoming.forceClientWipeAt
        : 0
    const merged: Record<string, unknown> = { ...incoming }
    const wipeAt = Math.max(prevWipe, nextWipe)
    if (wipeAt > 0) merged.forceClientWipeAt = wipeAt
    else delete merged.forceClientWipeAt

    const config = merged as Prisma.InputJsonValue

    const row = await prisma.orgIntegration.upsert({
      where: { organizationId: org.id },
      update: { config },
      create: { organizationId: org.id, config },
    })

    res.json({ config: row.config })
  } catch {
    res.status(400).json({ error: 'Configuration invalide.' })
  }
})
