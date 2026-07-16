import { prisma } from './prisma.js'
import type { PlanId } from './subscriptionPlans.js'

const SUBSCRIPTION_DAYS = 30

export function calculateRenewalPeriodEnd(
  currentPeriodEnd: Date | null,
  now = new Date(),
): Date {
  const base =
    currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime()
      ? new Date(currentPeriodEnd)
      : new Date(now)
  base.setDate(base.getDate() + SUBSCRIPTION_DAYS)
  return base
}

export async function activateMobileMoneySubscription(
  organizationId: string,
  planId: PlanId,
  billingProvider: 'mobile_money' | 'wave' = 'mobile_money',
): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { currentPeriodEnd: true },
  })
  if (!organization) {
    throw new Error('Organisation introuvable lors de l’activation.')
  }
  const currentPeriodEnd = calculateRenewalPeriodEnd(
    organization.currentPeriodEnd,
  )

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      planId,
      status: 'active',
      currentPeriodEnd,
      billingProvider,
      trialEndsAt: null,
    },
  })
}
