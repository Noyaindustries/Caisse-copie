import type { NavViewId } from '../../navigation'
import { NAV_SECTIONS, VIEW_LABELS, VIEW_SUBTITLES } from '../../navigation'
import { planLabel } from './plans'
import { resolveModuleMinPlan } from './modulePlanOverrides'
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

export function minPlanForModule(id: string): PlanId {
  return resolveModuleMinPlan(id)
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
export function getModuleSections(): ModuleSection[] {
  return NAV_SECTIONS.map((section) => ({
    title: section.title,
    modules: section.items
      .filter((item) => item.id !== 'subscription')
      .map((item) => buildModule(item.id)),
  }))
}

export function getAllModules(): ModuleEntry[] {
  return getModuleSections().flatMap((s) => s.modules)
}

/** @deprecated Préférer getModuleSections() pour refléter les overrides admin. */
export const MODULE_SECTIONS: ModuleSection[] = getModuleSections()

/** @deprecated Préférer getAllModules() pour refléter les overrides admin. */
export const ALL_MODULES: ModuleEntry[] = getAllModules()

const PLATFORM_FEATURE_DEFS: Omit<PlatformFeature, 'minPlan'>[] = [
  {
    id: 'offline',
    label: 'Mode hors ligne',
    description: 'Caisse et données locales sans connexion. Licence en cache 7 jours.',
  },
  {
    id: 'storeCode',
    label: 'Code magasin multi-postes',
    description: 'Déployez tablettes et PC avec un code court MAG-XXXX.',
  },
  {
    id: 'pin',
    label: 'Connexion PIN caissier',
    description: 'Authentification rapide par profil, rôles admin / gérant / caissier.',
  },
  {
    id: 'storefront',
    label: 'Boutique en ligne client',
    description: 'Vitrine e-commerce pour commandes web et validation en caisse.',
  },
  {
    id: 'mobileMoney',
    label: 'Paiement mobile money',
    description: 'Abonnement via Orange Money, Wave, MTN MoMo, Moov (CinetPay).',
  },
  {
    id: 'stripe',
    label: 'Paiement carte Stripe',
    description: 'Checkout et portail client pour facturation par carte bancaire.',
  },
  {
    id: 'sms',
    label: 'Rappels SMS abonnement',
    description: 'Alertes automatiques J-3 et J-1 avant fin d’essai ou de période.',
  },
  {
    id: 'sync',
    label: 'Synchronisation cloud',
    description: 'File de sync ventes et stocks vers votre backend (optionnel).',
  },
  {
    id: 'pwa',
    label: 'Application installable (PWA)',
    description: 'Installez CaisseCI sur tablette ou PC comme une app native.',
  },
]

export function getPlatformFeatures(): PlatformFeature[] {
  return PLATFORM_FEATURE_DEFS.map((f) => ({
    ...f,
    minPlan: minPlanForModule(f.id),
  }))
}

/** @deprecated Préférer getPlatformFeatures(). */
export const PLATFORM_FEATURES: PlatformFeature[] = getPlatformFeatures()

export function moduleIncludedInPlan(moduleMinPlan: PlanId, planId: PlanId): boolean {
  const order: PlanId[] = ['starter', 'pro', 'business']
  return order.indexOf(planId) >= order.indexOf(moduleMinPlan)
}

export function modulesForPlan(planId: PlanId): ModuleEntry[] {
  return getAllModules().filter((m) => moduleIncludedInPlan(m.minPlan, planId))
}

export function platformFeaturesForPlan(planId: PlanId): PlatformFeature[] {
  return getPlatformFeatures().filter((f) =>
    moduleIncludedInPlan(f.minPlan, planId),
  )
}

export function moduleCountForPlan(planId: PlanId): number {
  return modulesForPlan(planId).length + platformFeaturesForPlan(planId).length
}

export function planBadgeLabel(plan: PlanId): string {
  return planLabel(plan)
}
