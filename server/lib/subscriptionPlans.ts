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

export const TRIAL_DAYS = 30
export const OFFLINE_GRACE_HOURS = 168

export function planAtLeast(current: PlanId, required: PlanId): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(required)
}

export function isSubscriptionUsable(
  status: SubscriptionStatus,
  periodEnd: Date | null,
): boolean {
  if (status === 'active' || status === 'trialing') return true
  if (status === 'past_due') return true
  if (status === 'canceled' && periodEnd && periodEnd.getTime() > Date.now()) {
    return true
  }
  return false
}
