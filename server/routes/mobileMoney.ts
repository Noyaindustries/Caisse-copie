import { Router, type Request, type Response } from 'express'
import {
  checkCinetpayPayment,
  cinetpayDemoMode,
  generateTransactionId,
  initCinetpayPayment,
  mobileMoneyEnabled,
  parseNotifyStatus,
} from '../lib/cinetpay.js'
import {
  MOBILE_MONEY_CHANNELS_CI,
  channelById,
  normalizeCiPhone,
  type MobileMoneyChannelId,
} from '../lib/mobileMoneyChannels.js'
import { prisma } from '../lib/prisma.js'
import { activateMobileMoneySubscription } from '../lib/subscriptionActivation.js'
import { SUBSCRIPTION_PLANS, type PlanId } from '../lib/subscriptionPlans.js'
import { publicAppUrl } from '../lib/stripe.js'

export const mobileMoneyRouter = Router()

function parsePlanId(value: string | undefined): PlanId {
  if (value === 'pro' || value === 'business') return value
  return 'starter'
}

function readLicenseKey(req: Request): string | null {
  return req.get('x-license-key')?.trim() ?? null
}

async function markPaymentAccepted(paymentId: string, extra?: {
  operatorId?: string | null
  paymentMethod?: string | null
  notifyPayload?: unknown
}) {
  const payment = await prisma.mobileMoneyPayment.update({
    where: { id: paymentId },
    data: {
      status: 'accepted',
      paidAt: new Date(),
      operatorId: extra?.operatorId ?? undefined,
      paymentMethod: extra?.paymentMethod ?? undefined,
      notifyPayload: extra?.notifyPayload as object | undefined,
    },
  })
  await activateMobileMoneySubscription(
    payment.organizationId,
    parsePlanId(payment.planId),
  )
  const org = await prisma.organization.findUnique({
    where: { id: payment.organizationId },
    select: { billingPhone: true },
  })
  if (org && !org.billingPhone) {
    await prisma.organization.update({
      where: { id: payment.organizationId },
      data: { billingPhone: payment.customerPhone },
    })
  }
  return payment
}

mobileMoneyRouter.get('/billing/mobile-money/channels', (_req, res) => {
  res.json({
    channels: MOBILE_MONEY_CHANNELS_CI,
    enabled: mobileMoneyEnabled(),
    demo: cinetpayDemoMode() && !process.env.CINETPAY_API_KEY?.trim(),
    country: 'CI',
  })
})

mobileMoneyRouter.post('/billing/mobile-money/checkout', async (req, res) => {
  try {
    if (!mobileMoneyEnabled()) {
      res.status(503).json({
        error: 'Mobile money indisponible. Configurez CinetPay ou le mode démo.',
      })
      return
    }

    const licenseKey = readLicenseKey(req)
    const planId = parsePlanId(
      typeof req.body?.planId === 'string' ? req.body.planId : undefined,
    )
    const channelId = typeof req.body?.channelId === 'string' ? req.body.channelId : ''
    const phoneRaw = typeof req.body?.phone === 'string' ? req.body.phone : ''

    if (!licenseKey) {
      res.status(401).json({ error: 'Clé de licence manquante.' })
      return
    }
    if (!channelById(channelId)) {
      res.status(400).json({ error: 'Opérateur mobile money invalide.' })
      return
    }

    const phone = normalizeCiPhone(phoneRaw)
    if (!phone) {
      res.status(400).json({
        error: 'Numéro invalide. Utilisez un mobile ivoirien (ex. 07 XX XX XX XX).',
      })
      return
    }

    const org = await prisma.organization.findUnique({ where: { licenseKey } })
    if (!org) {
      res.status(404).json({ error: 'Licence introuvable.' })
      return
    }

    const plan = SUBSCRIPTION_PLANS[planId]
    const transactionId = generateTransactionId()
    const baseUrl = publicAppUrl(req)
    const notifyUrl = `${baseUrl}/api/billing/cinetpay/notify`
    const returnUrl = `${baseUrl}/staff?subscription=success&tx=${encodeURIComponent(transactionId)}`

    const payment = await prisma.mobileMoneyPayment.create({
      data: {
        organizationId: org.id,
        planId,
        transactionId,
        channel: channelId,
        amountFcfa: plan.priceFcfa,
        customerPhone: phone,
        status: 'pending',
      },
    })

    const init = await initCinetpayPayment({
      transactionId,
      amountFcfa: plan.priceFcfa,
      description: `CaisseCI ${plan.name} — 1 mois`,
      customerName: org.name,
      customerEmail: org.email,
      customerPhoneE164: phone,
      channelId: channelId as MobileMoneyChannelId,
      notifyUrl,
      returnUrl,
      metadata: {
        organizationId: org.id,
        planId,
        licenseKey: org.licenseKey,
        paymentId: payment.id,
      },
    })

    await prisma.mobileMoneyPayment.update({
      where: { id: payment.id },
      data: { paymentToken: init.paymentToken },
    })

    res.json({
      transactionId: init.transactionId,
      paymentUrl: init.paymentUrl,
      demo: init.demo,
      channel: channelId,
      amountFcfa: plan.priceFcfa,
    })
  } catch (err) {
    console.error('[mobile-money/checkout]', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Paiement mobile money impossible.',
    })
  }
})

mobileMoneyRouter.get('/billing/mobile-money/verify/:transactionId', async (req, res) => {
  try {
    const licenseKey = readLicenseKey(req)
    const transactionId = req.params.transactionId?.trim()
    if (!licenseKey || !transactionId) {
      res.status(400).json({ error: 'Paramètres manquants.' })
      return
    }

    const org = await prisma.organization.findUnique({ where: { licenseKey } })
    if (!org) {
      res.status(404).json({ error: 'Licence introuvable.' })
      return
    }

    const payment = await prisma.mobileMoneyPayment.findFirst({
      where: { transactionId, organizationId: org.id },
    })
    if (!payment) {
      res.status(404).json({ error: 'Transaction introuvable.' })
      return
    }

    if (payment.status === 'accepted') {
      res.json({ status: 'accepted', planId: payment.planId })
      return
    }

    const check = await checkCinetpayPayment(transactionId)
    if (check.status === 'ACCEPTED') {
      await markPaymentAccepted(payment.id, {
        operatorId: check.operatorId,
        paymentMethod: check.paymentMethod,
        notifyPayload: check.raw,
      })
      res.json({ status: 'accepted', planId: payment.planId })
      return
    }

    if (check.status === 'REFUSED') {
      await prisma.mobileMoneyPayment.update({
        where: { id: payment.id },
        data: { status: 'refused', notifyPayload: check.raw as object },
      })
      res.json({ status: 'refused' })
      return
    }

    res.json({ status: 'pending' })
  } catch (err) {
    console.error('[mobile-money/verify]', err)
    res.status(500).json({ error: 'Vérification impossible.' })
  }
})

export async function handleCinetpayNotify(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    const { transactionId, status } = parseNotifyStatus(body)
    if (!transactionId) {
      res.status(400).send('transaction_id manquant')
      return
    }

    const payment = await prisma.mobileMoneyPayment.findUnique({
      where: { transactionId },
    })
    if (!payment) {
      res.status(404).send('transaction inconnue')
      return
    }

    if (payment.status === 'accepted') {
      res.status(200).send('OK')
      return
    }

    if (status === 'ACCEPTED') {
      const check = await checkCinetpayPayment(transactionId)
      if (check.status === 'ACCEPTED') {
        await markPaymentAccepted(payment.id, {
          operatorId: check.operatorId,
          paymentMethod: check.paymentMethod,
          notifyPayload: { notify: body, check: check.raw },
        })
      }
    } else if (status === 'REFUSED') {
      await prisma.mobileMoneyPayment.update({
        where: { id: payment.id },
        data: { status: 'refused', notifyPayload: body as object },
      })
    }

    res.status(200).send('OK')
  } catch (err) {
    console.error('[cinetpay/notify]', err)
    res.status(500).send('ERR')
  }
}

mobileMoneyRouter.get('/billing/mobile-money/demo', async (req, res) => {
  if (!cinetpayDemoMode()) {
    res.status(404).send('Mode démo désactivé')
    return
  }

  const transactionId =
    typeof req.query.transactionId === 'string' ? req.query.transactionId : ''
  if (!transactionId) {
    res.status(400).send('transactionId manquant')
    return
  }

  const payment = await prisma.mobileMoneyPayment.findUnique({
    where: { transactionId },
    include: { organization: true },
  })
  if (!payment) {
    res.status(404).send('Transaction introuvable')
    return
  }

  const plan = SUBSCRIPTION_PLANS[parsePlanId(payment.planId)]
  const channel = channelById(payment.channel)

  res.type('html').send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CaisseCI — Démo mobile money</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 3rem auto; padding: 0 1rem; color: #18181b; }
    .card { border: 1px solid #e4e4e7; border-radius: 16px; padding: 1.5rem; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    p { color: #52525b; font-size: .95rem; line-height: 1.5; }
    .amount { font-size: 1.5rem; font-weight: 700; margin: 1rem 0; }
    button { width: 100%; padding: .85rem 1rem; border: 0; border-radius: 10px; font-weight: 600; cursor: pointer; margin-top: .5rem; }
    .ok { background: #059669; color: white; }
    .ko { background: #f4f4f5; color: #18181b; }
    .badge { display: inline-block; background: #fff7ed; color: #9a3412; padding: .2rem .5rem; border-radius: 999px; font-size: .75rem; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Mode démo CinetPay</span>
    <h1>${channel?.label ?? 'Mobile Money'} — ${plan.name}</h1>
    <p>${payment.organization.name}<br />${payment.customerPhone}</p>
    <div class="amount">${plan.priceFcfa.toLocaleString('fr-CI')} F CFA</div>
    <p>Simulez la confirmation USSM / push sur le téléphone du client.</p>
    <form method="post" action="/api/billing/mobile-money/demo/${encodeURIComponent(transactionId)}/accept">
      <button class="ok" type="submit">Confirmer le paiement</button>
    </form>
    <form method="post" action="/api/billing/mobile-money/demo/${encodeURIComponent(transactionId)}/refuse">
      <button class="ko" type="submit">Refuser</button>
    </form>
  </div>
</body>
</html>`)
})

mobileMoneyRouter.post(
  '/billing/mobile-money/demo/:transactionId/accept',
  async (req, res) => {
    if (!cinetpayDemoMode()) {
      res.status(404).send('Mode démo désactivé')
      return
    }
    const transactionId = req.params.transactionId
    const payment = await prisma.mobileMoneyPayment.findUnique({
      where: { transactionId },
    })
    if (!payment) {
      res.status(404).send('Transaction introuvable')
      return
    }
    await markPaymentAccepted(payment.id, {
      paymentMethod: 'demo',
      notifyPayload: { demo: true, action: 'accept' },
    })
    const returnUrl = `${publicAppUrl(req)}/staff?subscription=success&tx=${encodeURIComponent(transactionId)}`
    res.redirect(returnUrl)
  },
)

mobileMoneyRouter.post(
  '/billing/mobile-money/demo/:transactionId/refuse',
  async (req, res) => {
    if (!cinetpayDemoMode()) {
      res.status(404).send('Mode démo désactivé')
      return
    }
    const transactionId = req.params.transactionId
    await prisma.mobileMoneyPayment.updateMany({
      where: { transactionId },
      data: { status: 'refused', notifyPayload: { demo: true, action: 'refuse' } },
    })
    res.redirect(`${publicAppUrl(req)}/staff?subscription=cancel`)
  },
)
