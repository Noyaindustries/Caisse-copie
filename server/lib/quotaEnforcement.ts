import type { Organization } from '@prisma/client'
import {
  SUBSCRIPTION_PLANS,
  isSubscriptionUsable,
  parsePlanId,
  parseStatus,
  type PlanId,
} from './subscriptionPlans.js'
import { prisma } from './prisma.js'

export function orgSubscriptionUsable(org: Organization): boolean {
  return isSubscriptionUsable(
    parseStatus(org.status),
    org.currentPeriodEnd,
    org.trialEndsAt,
  )
}

export function orgPlan(org: Organization): PlanId {
  return parsePlanId(org.planId)
}

export function planLimits(org: Organization): { maxStaff: number; maxStores: number } {
  const plan = SUBSCRIPTION_PLANS[orgPlan(org)]
  return { maxStaff: plan.maxStaff, maxStores: plan.maxStores }
}

export async function countActiveStaff(organizationId: string): Promise<number> {
  return prisma.staffMember.count({
    where: { organizationId, active: true, revokedAt: null },
  })
}

export async function assertStaffQuota(
  org: Organization,
  additional = 1,
): Promise<string | null> {
  const { maxStaff } = planLimits(org)
  if (maxStaff <= 0) return null
  const active = await countActiveStaff(org.id)
  if (active + additional > maxStaff) {
    return `Limite d’utilisateurs atteinte (${maxStaff}). Passez à un plan supérieur.`
  }
  return null
}

export function assertSubscriptionActive(org: Organization): string | null {
  if (!orgSubscriptionUsable(org)) {
    return 'Abonnement expiré ou inactif. Renouvelez votre plan pour continuer.'
  }
  return null
}
