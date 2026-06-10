import type { NavViewId } from '../../navigation'
import type { PlanId } from './types'

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

/** Modules réservés aux paliers supérieurs. */
export const VIEW_MIN_PLAN: Partial<Record<NavViewId, PlanId>> = {
  kitchen: 'pro',
  tables: 'pro',
  promotions: 'pro',
  loyalty: 'pro',
  onlineOrders: 'pro',
  ticketsFactures: 'starter',
  comptabilite: 'pro',
  analytique: 'pro',
  network: 'business',
  crm: 'business',
  rh: 'business',
  integrations: 'business',
}

export function planAtLeast(current: PlanId, required: PlanId): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(required)
}

export function viewAllowedByPlan(view: NavViewId, planId: PlanId): boolean {
  const required = VIEW_MIN_PLAN[view]
  if (!required) return true
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
