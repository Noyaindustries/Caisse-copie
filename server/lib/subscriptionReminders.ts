import { prisma } from './prisma.js'
import { sendSms } from './sms.js'
import { SUBSCRIPTION_PLANS, type PlanId } from './subscriptionPlans.js'

export type ReminderKind = 'trial_3d' | 'trial_1d' | 'expiry_3d' | 'expiry_1d'

const REMINDER_WINDOWS_MS: Record<ReminderKind, number> = {
  trial_3d: 3 * 24 * 60 * 60 * 1000,
  trial_1d: 24 * 60 * 60 * 1000,
  expiry_3d: 3 * 24 * 60 * 60 * 1000,
  expiry_1d: 24 * 60 * 60 * 1000,
}

function parsePlanId(value: string): PlanId {
  if (value === 'pro' || value === 'business') return value
  return 'starter'
}

function formatExpiryFr(date: Date): string {
  return new Intl.DateTimeFormat('fr-CI', { dateStyle: 'long' }).format(date)
}

function buildReminderMessage(input: {
  orgName: string
  planId: PlanId
  kind: ReminderKind
  expiresAt: Date
}): string {
  const planName = SUBSCRIPTION_PLANS[input.planId].name
  const dateLabel = formatExpiryFr(input.expiresAt)
  const isTrial = input.kind.startsWith('trial_')
  const days = input.kind.endsWith('_3d') ? '3 jours' : '24 h'

  if (isTrial) {
    return `CaisseCI — Bonjour ${input.orgName}, votre essai ${planName} se termine le ${dateLabel} (dans ${days}). Renouvelez depuis Abonnement dans l'app.`
  }
  return `CaisseCI — Bonjour ${input.orgName}, votre abonnement ${planName} expire le ${dateLabel} (dans ${days}). Renouvelez par mobile money ou carte dans Abonnement.`
}

async function resolveBillingPhone(organizationId: string, billingPhone: string | null) {
  if (billingPhone?.trim()) return billingPhone.trim()
  const lastPayment = await prisma.mobileMoneyPayment.findFirst({
    where: { organizationId, status: 'accepted' },
    orderBy: { paidAt: 'desc' },
  })
  return lastPayment?.customerPhone ?? null
}

function reminderCandidates(
  status: string,
  trialEndsAt: Date | null,
  currentPeriodEnd: Date | null,
  now: number,
): Array<{ kind: ReminderKind; expiresAt: Date }> {
  const out: Array<{ kind: ReminderKind; expiresAt: Date }> = []

  if (status === 'trialing' && trialEndsAt) {
    const ms = trialEndsAt.getTime() - now
    if (ms > 0 && ms <= REMINDER_WINDOWS_MS.trial_3d) {
      out.push({ kind: 'trial_3d', expiresAt: trialEndsAt })
    }
    if (ms > 0 && ms <= REMINDER_WINDOWS_MS.trial_1d) {
      out.push({ kind: 'trial_1d', expiresAt: trialEndsAt })
    }
    return out
  }

  if (
    (status === 'active' || status === 'past_due' || status === 'canceled') &&
    currentPeriodEnd
  ) {
    const ms = currentPeriodEnd.getTime() - now
    if (ms > 0 && ms <= REMINDER_WINDOWS_MS.expiry_3d) {
      out.push({ kind: 'expiry_3d', expiresAt: currentPeriodEnd })
    }
    if (ms > 0 && ms <= REMINDER_WINDOWS_MS.expiry_1d) {
      out.push({ kind: 'expiry_1d', expiresAt: currentPeriodEnd })
    }
  }

  return out
}

export async function runSubscriptionReminders(organizationId?: string): Promise<{
  checked: number
  sent: number
}> {
  const now = Date.now()
  const orgs = await prisma.organization.findMany({
    where: {
      smsRemindersEnabled: true,
      ...(organizationId ? { id: organizationId } : {}),
      status: { in: ['trialing', 'active', 'past_due', 'canceled'] },
    },
  })

  let sent = 0

  for (const org of orgs) {
    const phone = await resolveBillingPhone(org.id, org.billingPhone)
    if (!phone) continue

    const candidates = reminderCandidates(
      org.status,
      org.trialEndsAt,
      org.currentPeriodEnd,
      now,
    )

    for (const candidate of candidates) {
      const existing = await prisma.subscriptionReminderLog.findUnique({
        where: {
          organizationId_kind_periodEnd: {
            organizationId: org.id,
            kind: candidate.kind,
            periodEnd: candidate.expiresAt,
          },
        },
      })
      if (existing) continue

      const message = buildReminderMessage({
        orgName: org.name,
        planId: parsePlanId(org.planId),
        kind: candidate.kind,
        expiresAt: candidate.expiresAt,
      })

      const result = await sendSms({
        to: phone,
        message,
        meta: {
          organizationId: org.id,
          reminderKind: candidate.kind,
          licenseKey: org.licenseKey,
        },
      })

      await prisma.subscriptionReminderLog.create({
        data: {
          organizationId: org.id,
          kind: candidate.kind,
          periodEnd: candidate.expiresAt,
          phone,
          message,
          status: result.ok ? 'sent' : 'failed',
          error: 'error' in result ? result.error : null,
        },
      })

      if (result.ok) sent += 1
    }
  }

  return { checked: orgs.length, sent }
}

export function startSubscriptionReminderScheduler(): void {
  const hours = Number(process.env.SUBSCRIPTION_REMINDER_INTERVAL_HOURS ?? 6)
  const intervalMs = Math.max(1, hours) * 60 * 60 * 1000

  const tick = () => {
    void runSubscriptionReminders().catch((err) => {
      console.error('[subscription-reminders]', err)
    })
  }

  setTimeout(tick, 45_000)
  setInterval(tick, intervalMs)
}
