import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireOrg } from '../lib/orgAuth.js'
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

    const config = z.record(z.unknown()).parse(req.body?.config ?? req.body) as Prisma.InputJsonValue

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
