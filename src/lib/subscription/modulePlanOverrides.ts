import type { NavViewId } from '../../navigation'
import type { PlanId } from './types'

/** Défauts code — hors overrides admin. */
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

const FEATURE_DEFAULTS: Record<string, PlanId> = {
  offline: 'starter',
  storeCode: 'starter',
  pin: 'starter',
  storefront: 'starter',
  mobileMoney: 'starter',
  stripe: 'starter',
  sms: 'starter',
  sync: 'starter',
  pwa: 'starter',
}

/** Overrides admin (chargés via /billing/plans). */
let moduleMinPlanOverrides: Partial<Record<string, PlanId>> = {}

export function setModuleMinPlanOverrides(
  map: Partial<Record<string, PlanId>> | null | undefined,
): void {
  moduleMinPlanOverrides = map ? { ...map } : {}
}

export function getModuleMinPlanOverrides(): Partial<Record<string, PlanId>> {
  return { ...moduleMinPlanOverrides }
}

export function resolveModuleMinPlan(id: string): PlanId {
  const override = moduleMinPlanOverrides[id]
  if (override) return override
  const viewDefault = VIEW_MIN_PLAN[id as NavViewId]
  if (viewDefault) return viewDefault
  return FEATURE_DEFAULTS[id] ?? 'starter'
}
