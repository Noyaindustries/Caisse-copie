import type { PlanId } from './subscriptionPlans.js'

export type ModuleKind = 'view' | 'feature'

export type ModuleCatalogEntry = {
  id: string
  label: string
  description: string
  section: string
  kind: ModuleKind
  /** Plan minimum par défaut (code). */
  defaultMinPlan: PlanId
}

/**
 * Modules applicatifs + capacités plateforme.
 * Les vues absentes de VIEW_MIN_PLAN côté client = Starter par défaut.
 */
export const DEFAULT_MODULE_MIN_PLANS: Record<string, PlanId> = {
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

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    id: 'caisse',
    label: 'Caisse',
    description: 'Encaissement et tickets.',
    section: 'Ventes',
    kind: 'view',
    defaultMinPlan: 'starter',
  },
  {
    id: 'dash',
    label: 'Tableau de bord',
    description: 'Vue d’ensemble de l’activité.',
    section: 'Ventes',
    kind: 'view',
    defaultMinPlan: 'starter',
  },
  {
    id: 'catalogue',
    label: 'Catalogue',
    description: 'Produits et catégories.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'starter',
  },
  {
    id: 'stocks',
    label: 'Stocks',
    description: 'Inventaire et alertes.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'starter',
  },
  {
    id: 'comptabilite',
    label: 'Comptabilité',
    description: 'Suivi comptable.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'pro',
  },
  {
    id: 'rh',
    label: 'Gestion RH',
    description: 'Ressources humaines.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'business',
  },
  {
    id: 'crm',
    label: 'CRM clients',
    description: 'Fiches et historique clients.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'business',
  },
  {
    id: 'tables',
    label: 'Gestion des tables',
    description: 'Plan de salle et ouvertures.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'pro',
  },
  {
    id: 'promotions',
    label: 'Promotions',
    description: 'Offres et réductions.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'pro',
  },
  {
    id: 'loyalty',
    label: 'Programme de fidélité',
    description: 'Points et récompenses.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'pro',
  },
  {
    id: 'kitchen',
    label: 'Cuisine',
    description: 'Écran cuisine (KDS).',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'pro',
  },
  {
    id: 'ticketsFactures',
    label: 'Tickets & factures',
    description: 'Histor historique des tickets.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'starter',
  },
  {
    id: 'onlineOrders',
    label: 'Commandes en ligne',
    description: 'Commandes web / boutique.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'pro',
  },
  {
    id: 'network',
    label: 'Multi-magasins',
    description: 'Réseau de magasins.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'business',
  },
  {
    id: 'journal',
    label: 'Rapport journalier',
    description: 'Clôture et rapports du jour.',
    section: 'Gestion',
    kind: 'view',
    defaultMinPlan: 'starter',
  },
  {
    id: 'personnel',
    label: 'Personnel',
    description: 'Équipe et profils.',
    section: 'Équipe',
    kind: 'view',
    defaultMinPlan: 'starter',
  },
  {
    id: 'pointage',
    label: 'Pointage',
    description: 'Présences et horaires.',
    section: 'Équipe',
    kind: 'view',
    defaultMinPlan: 'starter',
  },
  {
    id: 'analytique',
    label: 'Analytique',
    description: 'Indicateurs et tendances.',
    section: 'Équipe',
    kind: 'view',
    defaultMinPlan: 'pro',
  },
  {
    id: 'parametres',
    label: 'Paramètres',
    description: 'Configuration du magasin.',
    section: 'Écosystème',
    kind: 'view',
    defaultMinPlan: 'starter',
  },
  {
    id: 'integrations',
    label: 'Intégrations',
    description: 'Webhooks et partenaires.',
    section: 'Écosystème',
    kind: 'view',
    defaultMinPlan: 'business',
  },
  {
    id: 'offline',
    label: 'Mode hors ligne',
    description: 'Caisse et données locales sans connexion.',
    section: 'Plateforme',
    kind: 'feature',
    defaultMinPlan: 'starter',
  },
  {
    id: 'storeCode',
    label: 'Code magasin multi-postes',
    description: 'Déploiement tablettes / PC via MAG-XXXX.',
    section: 'Plateforme',
    kind: 'feature',
    defaultMinPlan: 'starter',
  },
  {
    id: 'pin',
    label: 'Connexion PIN caissier',
    description: 'Auth rapide par profil.',
    section: 'Plateforme',
    kind: 'feature',
    defaultMinPlan: 'starter',
  },
  {
    id: 'storefront',
    label: 'Boutique en ligne client',
    description: 'Vitrine e-commerce.',
    section: 'Plateforme',
    kind: 'feature',
    defaultMinPlan: 'starter',
  },
  {
    id: 'mobileMoney',
    label: 'Paiement mobile money',
    description: 'Orange Money, Wave, MTN, Moov.',
    section: 'Plateforme',
    kind: 'feature',
    defaultMinPlan: 'starter',
  },
  {
    id: 'stripe',
    label: 'Paiement carte Stripe',
    description: 'Checkout et portail client.',
    section: 'Plateforme',
    kind: 'feature',
    defaultMinPlan: 'starter',
  },
  {
    id: 'sms',
    label: 'Rappels SMS abonnement',
    description: 'Alertes J-3 et J-1.',
    section: 'Plateforme',
    kind: 'feature',
    defaultMinPlan: 'starter',
  },
  {
    id: 'sync',
    label: 'Synchronisation cloud',
    description: 'Sync ventes et stocks.',
    section: 'Plateforme',
    kind: 'feature',
    defaultMinPlan: 'starter',
  },
  {
    id: 'pwa',
    label: 'Application installable (PWA)',
    description: 'Installable sur tablette ou PC.',
    section: 'Plateforme',
    kind: 'feature',
    defaultMinPlan: 'starter',
  },
]

const VALID_PLANS = new Set<PlanId>(['starter', 'pro', 'business'])

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && VALID_PLANS.has(value as PlanId)
}

export function defaultMinPlanForModule(id: string): PlanId {
  return DEFAULT_MODULE_MIN_PLANS[id] ?? 'starter'
}
