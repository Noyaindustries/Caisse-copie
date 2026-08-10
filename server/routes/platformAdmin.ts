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
  updateOrganizationSubscription,
  deleteOrganizationCompletely,
} from '../lib/adminSubscriptions.js'
import {
  platformAdminConfigured,
  requirePlatformAdmin,
  verifyPlatformAdminSecret,
} from '../lib/platformAdminAuth.js'
import {
  platformAdminMfaConfigured,
  verifyPlatformAdminTotp,
} from '../lib/platformAdminMfa.js'
import {
  getPaymentProvidersPublicStatus,
  refreshPaymentProviderSettings,
  updatePaymentProviderSettings,
  type PaymentProvidersUpdateInput,
} from '../lib/paymentProviderSettings.js'
import {
  getSiteBranding,
  siteBrandingUpdateSchema,
  updateSiteBranding,
} from '../lib/siteBranding.js'
import {
  isBlobStorageConfigured,
  parseImageDataUrl,
  uploadPlatformSiteLogo,
} from '../lib/blobStorage.js'
import { prisma } from '../lib/prisma.js'
import { resolvePlansRecord, type PlanId, type SubscriptionStatus } from '../lib/subscriptionPlans.js'
import { runSubscriptionReminders } from '../lib/subscriptionReminders.js'
import {
  getSubscriptionPlansAdminStatus,
  refreshSubscriptionPlanSettings,
  updateSubscriptionPlanPrices,
} from '../lib/subscriptionPlanSettings.js'

export const platformAdminRouter = Router()

platformAdminRouter.get('/platform-admin/status', (_req, res) => {
  res.json({
    configured: platformAdminConfigured(),
    mfaRequired: platformAdminMfaConfigured(),
  })
})

/** Branding public (page d’accueil) — pas d’auth. */
platformAdminRouter.get('/site-branding', async (_req, res) => {
  try {
    res.json(await getSiteBranding())
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Impossible de charger le branding.'
    res.status(500).json({ error: message })
  }
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
  const totpCode = typeof req.body?.totpCode === 'string' ? req.body.totpCode : ''

  if (!verifyPlatformAdminSecret(secret)) {
    res.status(401).json({ ok: false, error: 'Mot de passe incorrect.' })
    return
  }

  if (platformAdminMfaConfigured() && !verifyPlatformAdminTotp(totpCode)) {
    res.status(401).json({ ok: false, error: 'Code MFA invalide ou expiré.' })
    return
  }

  res.json({ ok: true, mfaRequired: platformAdminMfaConfigured() })
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
    plans: resolvePlansRecord(),
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

platformAdminRouter.delete(
  '/platform-admin/organizations/:ref',
  async (req: Request<{ ref: string }>, res: Response) => {
    const ref = req.params.ref
    const confirmName =
      typeof req.body?.confirmName === 'string' ? req.body.confirmName.trim() : ''

    try {
      const org = await requireOrganizationByRef(ref)
      if (!confirmName || confirmName.toLowerCase() !== org.name.trim().toLowerCase()) {
        res.status(400).json({
          error: `Confirmation invalide. Saisissez exactement le nom « ${org.name} ».`,
        })
        return
      }
      const result = await deleteOrganizationCompletely(org.licenseKey)
      res.json({ ok: true, deleted: result })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Suppression impossible.'
      res.status(400).json({ error: message })
    }
  },
)

type PatchBody = {
  planId?: string
  status?: string
  trialEndsAt?: string | null
  currentPeriodEnd?: string | null
  subscription?: {
    planId?: string
    status?: string
    trialEndsAt?: string | null
    currentPeriodEnd?: string | null
  }
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

      const subscriptionPatch = req.body.subscription ?? {
        planId: req.body.planId,
        status: req.body.status,
        trialEndsAt: req.body.trialEndsAt,
        currentPeriodEnd: req.body.currentPeriodEnd,
      }

      const hasSubscriptionField =
        subscriptionPatch.planId !== undefined ||
        subscriptionPatch.status !== undefined ||
        subscriptionPatch.trialEndsAt !== undefined ||
        subscriptionPatch.currentPeriodEnd !== undefined

      if (hasSubscriptionField) {
        await updateOrganizationSubscription(ref, subscriptionPatch)
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

platformAdminRouter.get('/platform-admin/payment-providers', async (_req, res) => {
  await refreshPaymentProviderSettings()
  res.json(getPaymentProvidersPublicStatus())
})

platformAdminRouter.put('/platform-admin/payment-providers', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    const input: PaymentProvidersUpdateInput = {}

    const readSecret = (raw: unknown): string | null | undefined => {
      if (raw === undefined) return undefined
      if (raw === null) return null
      if (typeof raw === 'string') return raw
      return undefined
    }

    const waveApiKey = readSecret(body.waveApiKey)
    if (waveApiKey !== undefined) input.waveApiKey = waveApiKey
    const waveWebhookSecret = readSecret(body.waveWebhookSecret)
    if (waveWebhookSecret !== undefined) input.waveWebhookSecret = waveWebhookSecret
    const waveSigningSecret = readSecret(body.waveSigningSecret)
    if (waveSigningSecret !== undefined) input.waveSigningSecret = waveSigningSecret
    const cinetpayApiKey = readSecret(body.cinetpayApiKey)
    if (cinetpayApiKey !== undefined) input.cinetpayApiKey = cinetpayApiKey
    const cinetpaySiteId = readSecret(body.cinetpaySiteId)
    if (cinetpaySiteId !== undefined) input.cinetpaySiteId = cinetpaySiteId

    if (typeof body.waveDemoMode === 'boolean') {
      input.waveDemoMode = body.waveDemoMode
    }
    if (typeof body.cinetpayDemoMode === 'boolean') {
      input.cinetpayDemoMode = body.cinetpayDemoMode
    }

    const status = await updatePaymentProviderSettings(input)
    res.json(status)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Enregistrement des clés impossible.'
    res.status(400).json({ error: message })
  }
})

platformAdminRouter.get('/platform-admin/site-branding', async (_req, res) => {
  try {
    res.json({
      ...(await getSiteBranding()),
      blobConfigured: isBlobStorageConfigured(),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Impossible de charger le branding.'
    res.status(500).json({ error: message })
  }
})

platformAdminRouter.put('/platform-admin/site-branding', async (req, res) => {
  try {
    const body = siteBrandingUpdateSchema.parse(req.body ?? {})
    const next = await updateSiteBranding(body)
    res.json({ ...next, blobConfigured: isBlobStorageConfigured() })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({ error: 'Données invalides.' })
      return
    }
    const message =
      error instanceof Error ? error.message : 'Enregistrement impossible.'
    res.status(400).json({ error: message })
  }
})

platformAdminRouter.post('/platform-admin/site-branding/logo', async (req, res) => {
  try {
    const dataUrl =
      typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : ''
    if (!dataUrl) {
      res.status(400).json({ error: 'Image manquante (dataUrl).' })
      return
    }

    // Valide le format / taille même sans Blob.
    parseImageDataUrl(dataUrl)

    let logoUrl: string
    if (isBlobStorageConfigured()) {
      logoUrl = await uploadPlatformSiteLogo({ dataUrl })
    } else {
      // Repli local / Render sans Blob : stocke la data URL en base.
      logoUrl = dataUrl
    }

    const next = await updateSiteBranding({ logoUrl })
    res.status(201).json({ ...next, blobConfigured: isBlobStorageConfigured() })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Upload du logo impossible.'
    const status = message.includes('non configuré') ? 503 : 400
    res.status(status).json({ error: message })
  }
})

platformAdminRouter.get('/platform-admin/subscription-plans', async (_req, res) => {
  try {
    res.json(await getSubscriptionPlansAdminStatus())
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Impossible de charger les prix.'
    res.status(500).json({ error: message })
  }
})

platformAdminRouter.put('/platform-admin/subscription-plans', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    const readPrice = (raw: unknown): number | undefined => {
      if (raw === undefined || raw === null || raw === '') return undefined
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/\s/g, ''))
      if (!Number.isFinite(n)) return undefined
      return n
    }
    const rawModules = body.moduleMinPlans
    const moduleMinPlans =
      rawModules && typeof rawModules === 'object' && !Array.isArray(rawModules)
        ? (rawModules as Record<string, 'starter' | 'pro' | 'business'>)
        : undefined
    const status = await updateSubscriptionPlanPrices({
      starter: readPrice(body.starter ?? body.starterPriceFcfa),
      pro: readPrice(body.pro ?? body.proPriceFcfa),
      business: readPrice(body.business ?? body.businessPriceFcfa),
      moduleMinPlans,
    })
    res.json(status)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Enregistrement des prix impossible.'
    res.status(400).json({ error: message })
  }
})

// Assure les prix en cache après boot (routes admin).
void refreshSubscriptionPlanSettings().catch(() => {
  /* ignore — retry au prochain GET */
})
