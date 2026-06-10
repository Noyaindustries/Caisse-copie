import type { NavViewId } from '../../navigation'
import { NAV_SECTIONS, VIEW_LABELS, VIEW_SUBTITLES } from '../../navigation'
import { VIEW_MIN_PLAN, planLabel } from './plans'
import type { PlanId } from './types'

export type ModuleEntry = {
  id: NavViewId
  label: string
  description: string
  minPlan: PlanId
}

export type ModuleSection = {
  title: string
  modules: ModuleEntry[]
}

export type PlatformFeature = {
  id: string
  label: string
  description: string
  minPlan: PlanId
}

export function minPlanForModule(id: NavViewId): PlanId {
  return VIEW_MIN_PLAN[id] ?? 'starter'
}

function buildModule(id: NavViewId): ModuleEntry {
  return {
    id,
    label: VIEW_LABELS[id],
    description: VIEW_SUBTITLES[id],
    minPlan: minPlanForModule(id),
  }
}

/** Tous les modules applicatifs, groupés comme dans la navigation. */
export const MODULE_SECTIONS: ModuleSection[] = NAV_SECTIONS.map((section) => ({
  title: section.title,
  modules: section.items.map((item) => buildModule(item.id)),
}))

export const ALL_MODULES: ModuleEntry[] = MODULE_SECTIONS.flatMap((s) => s.modules)

/** Fonctionnalités plateforme (hors menu latéral). */
export const PLATFORM_FEATURES: PlatformFeature[] = [
  {
    id: 'offline',
    label: 'Mode hors ligne',
    description: 'Caisse et données locales sans connexion. Licence en cache 7 jours.',
    minPlan: 'starter',
  },
  {
    id: 'storeCode',
    label: 'Code magasin multi-postes',
    description: 'Déployez tablettes et PC avec un code court MAG-XXXX.',
    minPlan: 'starter',
  },
  {
    id: 'pin',
    label: 'Connexion PIN caissier',
    description: 'Authentification rapide par profil, rôles admin / gérant / caissier.',
    minPlan: 'starter',
  },
  {
    id: 'storefront',
    label: 'Boutique en ligne client',
    description: 'Vitrine e-commerce pour commandes web et validation en caisse.',
    minPlan: 'starter',
  },
  {
    id: 'mobileMoney',
    label: 'Paiement mobile money',
    description: 'Abonnement via Orange Money, Wave, MTN MoMo, Moov (CinetPay).',
    minPlan: 'starter',
  },
  {
    id: 'stripe',
    label: 'Paiement carte Stripe',
    description: 'Checkout et portail client pour facturation par carte bancaire.',
    minPlan: 'starter',
  },
  {
    id: 'sms',
    label: 'Rappels SMS abonnement',
    description: 'Alertes automatiques J-3 et J-1 avant fin d’essai ou de période.',
    minPlan: 'starter',
  },
  {
    id: 'sync',
    label: 'Synchronisation cloud',
    description: 'File de sync ventes et stocks vers votre backend (optionnel).',
    minPlan: 'starter',
  },
  {
    id: 'pwa',
    label: 'Application installable (PWA)',
    description: 'Installez CaisseCI sur tablette ou PC comme une app native.',
    minPlan: 'starter',
  },
]

export function moduleIncludedInPlan(moduleMinPlan: PlanId, planId: PlanId): boolean {
  const order: PlanId[] = ['starter', 'pro', 'business']
  return order.indexOf(planId) >= order.indexOf(moduleMinPlan)
}

export function modulesForPlan(planId: PlanId): ModuleEntry[] {
  return ALL_MODULES.filter((m) => moduleIncludedInPlan(m.minPlan, planId))
}

export function platformFeaturesForPlan(planId: PlanId): PlatformFeature[] {
  return PLATFORM_FEATURES.filter((f) => moduleIncludedInPlan(f.minPlan, planId))
}

export function moduleCountForPlan(planId: PlanId): number {
  return modulesForPlan(planId).length + platformFeaturesForPlan(planId).length
}

export function planBadgeLabel(plan: PlanId): string {
  return planLabel(plan)
}
