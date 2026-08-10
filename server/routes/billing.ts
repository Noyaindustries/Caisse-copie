import { randomBytes } from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import type Stripe from 'stripe'
import type { Organization } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import {
  TRIAL_DAYS,
  resolveAllPlans,
  resolvePlan,
  type PlanId,
  type SubscriptionStatus,
  isSubscriptionUsable,
} from '../lib/subscriptionPlans.js'
import { MOBILE_MONEY_CHANNELS_CI } from '../lib/mobileMoneyChannels.js'
import { mobileMoneyEnabled } from '../lib/cinetpay.js'
import {
  asOrgPaymentFields,
  orgPaymentProvidersPublicStatus,
  updateOrganizationPaymentProviders,
  type OrgPaymentProvidersUpdateInput,
} from '../lib/orgPaymentCredentials.js'
import { ensurePaymentConfigReady } from '../lib/paymentProviderSettings.js'
import { waveEnabled } from '../lib/wave.js'
import { runSubscriptionReminders } from '../lib/subscriptionReminders.js'
import { getStripe, publicAppUrl, stripeConfigured } from '../lib/stripe.js'
import {
  subscriptionCancelUrl,
  subscriptionSuccessUrl,
} from '../lib/appUrls.js'
import {
  hashOwnerPassword,
  isGmailAddress,
  normalizeOwnerEmail,
  validateOwnerPassword,
  verifyOwnerPassword,
} from '../lib/ownerAuth.js'
import { resolveOrgFromRequest, readBearerToken } from '../lib/orgAuth.js'
import { createOrgSession, revokeOrgSession } from '../lib/sessionTokens.js'
import {
  allocateUniqueStoreSlug,
  ensureStorefrontIdentity,
  storefrontPublicKey,
} from '../lib/storeSlug.js'

export const billingRouter = Router()

function generateLicenseKey(): string {
  const chunk = () => randomBytes(3).toString('hex').toUpperCase()
  return `CC-${chunk()}-${chunk()}-${chunk()}`
}

async function generateStoreCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const suffix = randomBytes(2).toString('hex').toUpperCase()
    const code = `MAG-${suffix}`
    const exists = await prisma.organization.findUnique({ where: { storeCode: code } })
    if (!exists) return code
  }
  throw new Error('Impossible de générer un code magasin unique.')
}

export function normalizeStoreCode(input: string): string {
  const raw = input.trim().toUpperCase().replace(/\s/g, '')
  if (!raw) return ''
  if (raw.startsWith('MAG-')) return raw
  if (raw.startsWith('MAG')) return `MAG-${raw.slice(3).replace(/^-/, '')}`
  return `MAG-${raw}`
}

type OrgWithStoreCode = Organization & { storeCode: string; storeSlug: string }

async function ensureStoreCode(org: Organization): Promise<OrgWithStoreCode> {
  const identity = await ensureStorefrontIdentity(org)
  const fresh = await prisma.organization.findUniqueOrThrow({
    where: { id: org.id },
  })
  return {
    ...fresh,
    storeCode: identity.storeCode,
    storeSlug: identity.storeSlug,
  }
}

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

function orgPayload(org: {
  id: string
  name: string
  email: string
  licenseKey: string
  storeCode?: string | null
  storeSlug?: string | null
  planId: string
  status: string
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
  billingPhone?: string | null
  smsRemindersEnabled?: boolean
}, sessionToken?: string) {
  const planId = parsePlanId(org.planId)
  const status = parseStatus(org.status)
  const usable = isSubscriptionUsable(
    status,
    org.currentPeriodEnd,
    org.trialEndsAt,
  )
  const storeSlug = org.storeSlug?.trim() || null
  const storeCode = org.storeCode ?? null
  return {
    organizationId: org.id,
    name: org.name,
    email: org.email,
    licenseKey: org.licenseKey,
    sessionToken: sessionToken ?? undefined,
    storeCode,
    storeSlug,
    /** Clé d’URL boutique (nom d’entreprise) — préférer à storeCode côté client. */
    storefrontKey: storefrontPublicKey({ storeSlug, storeCode }),
    planId,
    plan: resolvePlan(planId),
    status,
    usable,
    trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
    stripeEnabled: stripeConfigured(),
    mobileMoneyEnabled: mobileMoneyEnabled(),
    waveEnabled: waveEnabled(),
    billingPhone: org.billingPhone ?? null,
    smsRemindersEnabled: org.smsRemindersEnabled ?? true,
  }
}

async function orgPayloadWithSession(org: Parameters<typeof orgPayload>[0]) {
  const sessionToken = await createOrgSession(org.id)
  return orgPayload(org, sessionToken)
}

function channelLabel(channelId: string): string {
  return MOBILE_MONEY_CHANNELS_CI.find((c) => c.id === channelId)?.label ?? channelId
}

async function findOrgByLicense(licenseKey: string) {
  const org = await prisma.organization.findUnique({ where: { licenseKey } })
  if (!org) return null
  return ensureStoreCode(org)
}

async function findOrgByStoreCode(storeCode: string) {
  const normalized = normalizeStoreCode(storeCode)
  if (!normalized) return null
  const org = await prisma.organization.findUnique({ where: { storeCode: normalized } })
  if (!org) return null
  return ensureStoreCode(org)
}

async function requireBillingOrg(req: Request, res: Response) {
  const org = await resolveOrgFromRequest(req)
  if (!org) {
    res.status(401).json({ error: 'Authentification requise.' })
    return null
  }
  return org
}

billingRouter.get('/billing/plans', async (_req, res) => {
  try {
    const { refreshSubscriptionPlanSettings } = await import(
      '../lib/subscriptionPlanSettings.js'
    )
    await refreshSubscriptionPlanSettings()
  } catch {
    /* conserve le cache mémoire */
  }
  res.json({
    plans: resolveAllPlans(),
    trialDays: TRIAL_DAYS,
    stripeEnabled: stripeConfigured(),
    mobileMoneyEnabled: mobileMoneyEnabled(),
    waveEnabled: waveEnabled(),
  })
})

billingRouter.post('/billing/register', async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const email = normalizeOwnerEmail(
      typeof req.body?.email === 'string' ? req.body.email : '',
    )
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Nom d’entreprise requis.' })
      return
    }
    if (!isGmailAddress(email)) {
      res.status(400).json({
        error: 'Utilisez une adresse Gmail (@gmail.com) pour créer votre compte.',
      })
      return
    }
    const passwordError = validateOwnerPassword(password)
    if (passwordError) {
      res.status(400).json({ error: passwordError })
      return
    }

    const existing = await prisma.organization.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({
        error: 'Un compte existe déjà avec cette adresse Gmail. Connectez-vous.',
      })
      return
    }

    const planId = parsePlanId(
      typeof req.body?.planId === 'string' ? req.body.planId : undefined,
    )
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS)
    const storeCode = await generateStoreCode()
    const storeSlug = await allocateUniqueStoreSlug(name, { storeCode })

    const org = await prisma.organization.create({
      data: {
        name,
        email,
        passwordHash: hashOwnerPassword(password),
        licenseKey: generateLicenseKey(),
        storeCode,
        storeSlug,
        planId,
        status: 'trialing',
        trialEndsAt,
      },
    })

    const { ensureOwnerStaffMember } = await import('../lib/ensureOwnerStaff.js')
    await ensureOwnerStaffMember(org, { ownerPassword: password })

    res.status(201).json(await orgPayloadWithSession(org))
  } catch (err) {
    console.error('[billing/register]', err)
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      res.status(409).json({
        error: 'Un compte existe déjà avec cette adresse Gmail. Connectez-vous.',
      })
      return
    }
    res.status(500).json({ error: 'Impossible de créer le compte.' })
  }
})

billingRouter.post('/billing/login', async (req, res) => {
  try {
    const email = normalizeOwnerEmail(
      typeof req.body?.email === 'string' ? req.body.email : '',
    )
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    if (!isGmailAddress(email)) {
      res.status(400).json({ error: 'Adresse Gmail invalide.' })
      return
    }
    if (!password) {
      res.status(400).json({ error: 'Mot de passe requis.' })
      return
    }

    const org = await prisma.organization.findUnique({ where: { email } })
    if (!org || !org.passwordHash) {
      res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' })
      return
    }
    if (!verifyOwnerPassword(password, org.passwordHash)) {
      res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' })
      return
    }

    const withCode = await ensureStoreCode(org)
    res.json(await orgPayloadWithSession(withCode))
  } catch (err) {
    console.error('[billing/login]', err)
    res.status(500).json({ error: 'Connexion impossible.' })
  }
})

billingRouter.post('/billing/attach', async (req, res) => {
  try {
    const storeCode =
      typeof req.body?.storeCode === 'string' ? req.body.storeCode.trim() : ''
    const licenseKey =
      typeof req.body?.licenseKey === 'string' ? req.body.licenseKey.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    if (!password) {
      res.status(400).json({ error: 'Mot de passe gérant requis.' })
      return
    }

    let org = null
    if (storeCode) {
      org = await findOrgByStoreCode(storeCode)
      if (!org) {
        res.status(401).json({ error: 'Code magasin ou mot de passe incorrect.' })
        return
      }
    } else if (licenseKey) {
      org = await findOrgByLicense(licenseKey)
      if (!org) {
        res.status(401).json({ error: 'Licence ou mot de passe incorrect.' })
        return
      }
    } else {
      res.status(400).json({ error: 'Code magasin ou clé de licence requis.' })
      return
    }

    if (!org.passwordHash || !verifyOwnerPassword(password, org.passwordHash)) {
      res.status(401).json({ error: 'Code magasin ou mot de passe incorrect.' })
      return
    }

    res.json(await orgPayloadWithSession(org))
  } catch (err) {
    console.error('[billing/attach]', err)
    res.status(500).json({ error: 'Impossible de valider la licence.' })
  }
})

billingRouter.post('/billing/logout', async (req, res) => {
  const token = readBearerToken(req)
  if (token) {
    await revokeOrgSession(token)
  }
  res.json({ ok: true })
})

billingRouter.get('/billing/status', async (req, res) => {
  try {
    await ensurePaymentConfigReady()
    const org = await resolveOrgFromRequest(req)
    if (!org) {
      res.status(401).json({ error: 'Authentification requise.' })
      return
    }

    let updated: OrgWithStoreCode = org
    if (
      org.status === 'trialing' &&
      org.trialEndsAt &&
      org.trialEndsAt.getTime() < Date.now() &&
      !org.stripeSubId
    ) {
      updated = await ensureStoreCode(
        await prisma.organization.update({
          where: { id: org.id },
          data: { status: 'expired' },
        }),
      )
    }

    void runSubscriptionReminders(org.id).catch((err) => {
      console.error('[billing/status:reminders]', err)
    })

    res.json(orgPayload(updated))
  } catch (err) {
    console.error('[billing/status]', err)
    res.status(500).json({ error: 'Impossible de lire le statut.' })
  }
})

billingRouter.patch('/billing/settings', async (req, res) => {
  try {
    const org = await requireBillingOrg(req, res)
    if (!org) return

    const data: { billingPhone?: string | null; smsRemindersEnabled?: boolean } = {}

    if (req.body?.billingPhone !== undefined) {
      const raw =
        typeof req.body.billingPhone === 'string' ? req.body.billingPhone.trim() : ''
      data.billingPhone = raw || null
    }
    if (typeof req.body?.smsRemindersEnabled === 'boolean') {
      data.smsRemindersEnabled = req.body.smsRemindersEnabled
    }

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data,
    })

    res.json(orgPayload(updated))
  } catch (err) {
    console.error('[billing/settings]', err)
    res.status(500).json({ error: 'Impossible de mettre à jour les paramètres.' })
  }
})

billingRouter.get('/billing/payments/history', async (req, res) => {
  try {
    const org = await requireBillingOrg(req, res)
    if (!org) return

    const payments = await prisma.mobileMoneyPayment.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    res.json({
      payments: payments.map((p) => ({
        id: p.id,
        transactionId: p.transactionId,
        planId: parsePlanId(p.planId),
        planName: resolvePlan(parsePlanId(p.planId)).name,
        channel: p.channel,
        channelLabel: channelLabel(p.channel),
        amountFcfa: p.amountFcfa,
        customerPhone: p.customerPhone,
        status: p.status,
        paymentMethod: p.paymentMethod,
        paidAt: p.paidAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[billing/payments/history]', err)
    res.status(500).json({ error: 'Historique indisponible.' })
  }
})

billingRouter.post('/billing/checkout', async (req, res) => {
  try {
    const planId = parsePlanId(
      typeof req.body?.planId === 'string' ? req.body.planId : undefined,
    )
    const org = await requireBillingOrg(req, res)
    if (!org) return

    const stripe = getStripe()
    if (!stripe) {
      res.status(503).json({
        error: 'Paiement en ligne indisponible. Contactez le support pour activer votre plan.',
      })
      return
    }

    let customerId = org.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org.email,
        name: org.name,
        metadata: { organizationId: org.id, licenseKey: org.licenseKey },
      })
      customerId = customer.id
      await prisma.organization.update({
        where: { id: org.id },
        data: { stripeCustomerId: customerId },
      })
    }

    const plan = resolvePlan(planId)
    const baseUrl = publicAppUrl(req)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: process.env.STRIPE_CURRENCY?.trim() || 'xof',
            product_data: {
              name: `CaisseCI ${plan.name}`,
              description: plan.description,
            },
            unit_amount: plan.priceFcfa,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          organizationId: org.id,
          planId,
          licenseKey: org.licenseKey,
        },
      },
      metadata: {
        organizationId: org.id,
        planId,
        licenseKey: org.licenseKey,
      },
      success_url: subscriptionSuccessUrl(baseUrl),
      cancel_url: subscriptionCancelUrl(baseUrl),
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('[billing/checkout]', err)
    res.status(500).json({ error: 'Impossible de démarrer le paiement.' })
  }
})

billingRouter.get('/billing/payment-providers', async (req, res) => {
  try {
    const org = await requireBillingOrg(req, res)
    if (!org) return
    res.json(orgPaymentProvidersPublicStatus(asOrgPaymentFields(org)))
  } catch (err) {
    console.error('[billing/payment-providers GET]', err)
    res.status(500).json({ error: 'Impossible de charger la config paiement.' })
  }
})

billingRouter.put('/billing/payment-providers', async (req, res) => {
  try {
    const org = await requireBillingOrg(req, res)
    if (!org) return

    const body = (req.body ?? {}) as Record<string, unknown>
    const input: OrgPaymentProvidersUpdateInput = {}
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
    if (typeof body.waveDemoMode === 'boolean') input.waveDemoMode = body.waveDemoMode
    if (typeof body.cinetpayDemoMode === 'boolean') {
      input.cinetpayDemoMode = body.cinetpayDemoMode
    }

    const status = await updateOrganizationPaymentProviders(org.id, input)
    res.json(status)
  } catch (err) {
    console.error('[billing/payment-providers PUT]', err)
    const message =
      err instanceof Error ? err.message : 'Enregistrement impossible.'
    res.status(400).json({ error: message })
  }
})

billingRouter.post('/billing/portal', async (req, res) => {
  try {
    const org = await requireBillingOrg(req, res)
    if (!org) return

    const stripe = getStripe()
    if (!stripe) {
      res.status(503).json({ error: 'Portail client indisponible.' })
      return
    }

    if (!org.stripeCustomerId) {
      res.status(400).json({ error: 'Aucun abonnement Stripe associé.' })
      return
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${publicAppUrl(req)}/abonnement`,
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('[billing/portal]', err)
    res.status(500).json({ error: 'Impossible d’ouvrir le portail client.' })
  }
})

function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const raw = subscription as Stripe.Subscription & {
    current_period_end?: number
    billing_schedules?: Array<{ current_period_end?: number }>
  }
  if (raw.current_period_end) {
    return new Date(raw.current_period_end * 1000)
  }
  const scheduleEnd = raw.billing_schedules?.[0]?.current_period_end
  if (scheduleEnd) return new Date(scheduleEnd * 1000)
  if (subscription.trial_end) return new Date(subscription.trial_end * 1000)
  return null
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as Stripe.Invoice & {
    subscription?: string | { id: string } | null
  }
  if (!raw.subscription) return null
  return typeof raw.subscription === 'string'
    ? raw.subscription
    : raw.subscription.id
}

async function applyStripeSubscription(
  organizationId: string,
  subscription: Stripe.Subscription,
) {
  const planId = parsePlanId(subscription.metadata.planId)
  const status = mapStripeStatus(subscription.status)
  const currentPeriodEnd = subscriptionPeriodEnd(subscription)

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      planId,
      status,
      stripeSubId: subscription.id,
      currentPeriodEnd,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
  })
}

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    default:
      return 'expired'
  }
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!stripe || !webhookSecret) {
    res.status(503).json({ error: 'Webhook Stripe non configuré.' })
    return
  }

  const signature = req.get('stripe-signature')
  if (!signature) {
    res.status(400).json({ error: 'Signature manquante.' })
    return
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret)
  } catch (err) {
    console.error('[billing/webhook] signature', err)
    res.status(400).json({ error: 'Signature invalide.' })
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const organizationId = session.metadata?.organizationId
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id
        if (organizationId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await applyStripeSubscription(organizationId, subscription)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const organizationId = subscription.metadata.organizationId
        if (organizationId) {
          if (event.type === 'customer.subscription.deleted') {
            await prisma.organization.update({
              where: { id: organizationId },
              data: {
                status: 'canceled',
                currentPeriodEnd: subscriptionPeriodEnd(subscription),
                stripeSubId: null,
              },
            })
          } else {
            await applyStripeSubscription(organizationId, subscription)
          }
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = invoiceSubscriptionId(invoice)
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId)
          const organizationId = subscription.metadata.organizationId
          if (organizationId) {
            await prisma.organization.update({
              where: { id: organizationId },
              data: { status: 'past_due' },
            })
          }
        }
        break
      }
      default:
        break
    }
    res.json({ received: true })
  } catch (err) {
    console.error('[billing/webhook]', err)
    res.status(500).json({ error: 'Traitement webhook échoué.' })
  }
}
