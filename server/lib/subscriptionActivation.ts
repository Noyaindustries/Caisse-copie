import { prisma } from './prisma.js'
import type { PlanId } from './subscriptionPlans.js'

const SUBSCRIPTION_DAYS = 30

export async function activateMobileMoneySubscription(
  organizationId: string,
  planId: PlanId,
): Promise<void> {
  const currentPeriodEnd = new Date()
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + SUBSCRIPTION_DAYS)

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      planId,
      status: 'active',
      currentPeriodEnd,
      billingProvider: 'mobile_money',
      trialEndsAt: null,
    },
  })
}
