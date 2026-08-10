import type { NavViewId } from '../../navigation'
import type { PlanId } from './types'
import { resolveModuleMinPlan, VIEW_MIN_PLAN } from './modulePlanOverrides'

export { VIEW_MIN_PLAN }

export const PLAN_ORDER: PlanId[] = ['starter', 'pro', 'business']

export const DEFAULT_TRIAL_DAYS = 30

export const OFFLINE_GRACE_MS = 168 * 60 * 60 * 1000

/** Affiche « 1 mois », « 2 mois » ou « X jours » selon la durée d’essai. */
export function formatTrialPeriod(days: number = DEFAULT_TRIAL_DAYS): string {
  if (days % 30 === 0 && days >= 30) {
    const months = days / 30
    return months === 1 ? '1 mois' : `${months} mois`
  }
  return `${days} jours`
}

export function planAtLeast(current: PlanId, required: PlanId): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(required)
}

export function viewAllowedByPlan(view: NavViewId, planId: PlanId): boolean {
  const required = resolveModuleMinPlan(view)
  return planAtLeast(planId, required)
}

export function planLabel(planId: PlanId): string {
  switch (planId) {
    case 'starter':
      return 'Starter'
    case 'pro':
      return 'Pro'
    case 'business':
      return 'Business'
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'trialing':
      return 'Essai gratuit'
    case 'active':
      return 'Actif'
    case 'past_due':
      return 'Paiement en retard'
    case 'canceled':
      return 'Résilié'
    case 'expired':
      return 'Expiré'
    default:
      return status
  }
}
