import { Router, type Request, type Response } from 'express'
import {
  activateOrganizationSubscription,
  extendOrganizationPeriod,
  extendOrganizationTrial,
  findOrganizationByRef,
  grantMobileMoneyActivation,
  listOrganizations,
  requireOrganizationByRef,
  serializeOrganizationForAdmin,
  setOrganizationPlan,
  setOrganizationStatus,
} from '../lib/adminSubscriptions.js'
import {
  platformAdminConfigured,
  requirePlatformAdmin,
  verifyPlatformAdminSecret,
} from '../lib/platformAdminAuth.js'
import { prisma } from '../lib/prisma.js'
import { SUBSCRIPTION_PLANS, type PlanId, type SubscriptionStatus } from '../lib/subscriptionPlans.js'
import { runSubscriptionReminders } from '../lib/subscriptionReminders.js'

export const platformAdminRouter = Router()

platformAdminRouter.get('/platform-admin/status', (_req, res) => {
  res.json({ configured: platformAdminConfigured() })
})

platformAdminRouter.post('/platform-admin/auth', (req, res) => {
  if (!platformAdminConfigured()) {
    res.status(503).json({
      ok: false,
      error: 'Administration plateforme non configurée.',
    })
    return
  }

  const secret = typeof req.body?.secret === 'string' ? req.body.secret : ''
  if (!verifyPlatformAdminSecret(secret)) {
    res.status(401).json({ ok: false, error: 'Mot de passe incorrect.' })
    return
  }

  res.json({ ok: true })
})

platformAdminRouter.use('/platform-admin', requirePlatformAdmin)

platformAdminRouter.get('/platform-admin/stats', async (_req, res) => {
  const rows = await prisma.organization.findMany({
    select: { status: true, planId: true, createdAt: true },
  })

  const byStatus: Record<string, number> = {}
  const byPlan: Record<string, number> = {}
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  let recentSignups = 0

  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
    byPlan[row.planId] = (byPlan[row.planId] ?? 0) + 1
    if (row.createdAt.getTime() >= thirtyDaysAgo) recentSignups += 1
  }

  res.json({
    total: rows.length,
    byStatus,
    byPlan,
    recentSignups,
    plans: SUBSCRIPTION_PLANS,
  })
})

platformAdminRouter.get('/platform-admin/organizations', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const planId = typeof req.query.plan === 'string' ? req.query.plan : undefined
  const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : ''

  let orgs = await listOrganizations({
    status: status as SubscriptionStatus | undefined,
    planId: planId as PlanId | undefined,
    limit,
  })

  if (q) {
    orgs = orgs.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        org.email.toLowerCase().includes(q) ||
        org.licenseKey.toLowerCase().includes(q) ||
        (org.storeCode?.toLowerCase().includes(q) ?? false) ||
        org.id.toLowerCase().includes(q),
    )
  }

  res.json({
    organizations: orgs.map(serializeOrganizationForAdmin),
    count: orgs.length,
  })
})

platformAdminRouter.get('/platform-admin/organizations/:ref', async (req, res) => {
  const org = await findOrganizationByRef(req.params.ref)
  if (!org) {
    res.status(404).json({ error: 'Organisation introuvable.' })
    return
  }
  res.json({ organization: serializeOrganizationForAdmin(org) })
})

type PatchBody = {
  planId?: string
  status?: string
  activate?: { planId: string; days?: number }
  extendTrialDays?: number
  extendPeriodDays?: number
  grantMobileMoney?: { planId: string }
}

platformAdminRouter.patch(
  '/platform-admin/organizations/:ref',
  async (req: Request<{ ref: string }, unknown, PatchBody>, res: Response) => {
    const ref = req.params.ref

    try {
      await requireOrganizationByRef(ref)

      if (req.body.planId) {
        await setOrganizationPlan(ref, req.body.planId)
      }
      if (req.body.status) {
        await setOrganizationStatus(ref, req.body.status)
      }
      if (req.body.activate?.planId) {
        await activateOrganizationSubscription(
          ref,
          req.body.activate.planId,
          req.body.activate.days ?? 30,
        )
      }
      if (typeof req.body.extendTrialDays === 'number' && req.body.extendTrialDays > 0) {
        await extendOrganizationTrial(ref, req.body.extendTrialDays)
      }
      if (typeof req.body.extendPeriodDays === 'number' && req.body.extendPeriodDays > 0) {
        await extendOrganizationPeriod(ref, req.body.extendPeriodDays)
      }
      if (req.body.grantMobileMoney?.planId) {
        await grantMobileMoneyActivation(ref, req.body.grantMobileMoney.planId)
      }

      const updated = await requireOrganizationByRef(ref)
      res.json({ organization: serializeOrganizationForAdmin(updated) })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mise à jour impossible.'
      res.status(400).json({ error: message })
    }
  },
)

platformAdminRouter.post('/platform-admin/reminders', async (req, res) => {
  const organizationId =
    typeof req.body?.organizationId === 'string' ? req.body.organizationId : undefined
  const result = await runSubscriptionReminders(organizationId)
  res.json(result)
})
