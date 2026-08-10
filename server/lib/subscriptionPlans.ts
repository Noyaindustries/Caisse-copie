export type PlanId = 'starter' | 'pro' | 'business'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'

export type PlanDefinition = {
  id: PlanId
  name: string
  description: string
  priceFcfa: number
  maxStores: number
  maxStaff: number
  features: string[]
}

export const PLAN_ORDER: PlanId[] = ['starter', 'pro', 'business']

export const SUBSCRIPTION_PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Caisse, catalogue et stocks pour un point de vente.',
    priceFcfa: 9_900,
    maxStores: 1,
    maxStaff: 3,
    features: [
      'Caisse & encaissement',
      'Catalogue & stocks',
      'Rapport journalier',
      '1 magasin · 3 utilisateurs',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Modules avancés pour restaurants et commerces actifs.',
    priceFcfa: 24_900,
    maxStores: 3,
    maxStaff: 10,
    features: [
      'Tout Starter',
      'Cuisine (KDS), tables, fidélité',
      'Commandes en ligne & promotions',
      'Analytique & comptabilité',
      '3 magasins · 10 utilisateurs',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    description: 'Multi-sites, CRM, RH et intégrations partenaires.',
    priceFcfa: 49_900,
    maxStores: 20,
    maxStaff: 50,
    features: [
      'Tout Pro',
      'Multi-magasins & transferts',
      'CRM clients & gestion RH',
      'Intégrations & webhooks',
      '20 magasins · 50 utilisateurs',
    ],
  },
}

/** Prix override (admin SaaS) — appliqués via setPlanPriceOverrides. */
let planPriceOverrides: Partial<Record<PlanId, number>> = {}

export function setPlanPriceOverrides(
  overrides: Partial<Record<PlanId, number>>,
): void {
  const next: Partial<Record<PlanId, number>> = {}
  for (const id of PLAN_ORDER) {
    const value = overrides[id]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      next[id] = Math.round(value)
    }
  }
  planPriceOverrides = next
}

export function getPlanPriceOverrides(): Partial<Record<PlanId, number>> {
  return { ...planPriceOverrides }
}

/** Plan avec prix effectif (défaut ou override admin). */
export function resolvePlan(planId: PlanId): PlanDefinition {
  const base = SUBSCRIPTION_PLANS[planId]
  const override = planPriceOverrides[planId]
  if (override == null) return base
  return { ...base, priceFcfa: override }
}

export function resolveAllPlans(): PlanDefinition[] {
  return PLAN_ORDER.map((id) => resolvePlan(id))
}

export function resolvePlansRecord(): Record<PlanId, PlanDefinition> {
  return {
    starter: resolvePlan('starter'),
    pro: resolvePlan('pro'),
    business: resolvePlan('business'),
  }
}

export const TRIAL_DAYS = 30
export const OFFLINE_GRACE_HOURS = 168

export function planAtLeast(current: PlanId, required: PlanId): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(required)
}

export function parsePlanId(value: string | undefined): PlanId {
  if (value === 'pro' || value === 'business') return value
  return 'starter'
}

export function parseStatus(value: string | undefined): SubscriptionStatus {
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

export function isSubscriptionUsable(
  status: SubscriptionStatus,
  periodEnd: Date | null,
  trialEndsAt: Date | null = null,
  now = new Date(),
): boolean {
  const nowMs = now.getTime()
  if (status === 'trialing') {
    return Boolean(trialEndsAt && trialEndsAt.getTime() > nowMs)
  }
  if (status === 'active') {
    return periodEnd == null || periodEnd.getTime() > nowMs
  }
  if (status === 'past_due' || status === 'canceled') {
    return Boolean(periodEnd && periodEnd.getTime() > nowMs)
  }
  return false
}
