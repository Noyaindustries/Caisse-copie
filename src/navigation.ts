import type { UserRole } from './auth/types'

export type NavViewId =
  | 'caisse'
  | 'dash'
  | 'catalogue'
  | 'stocks'
  | 'comptabilite'
  | 'rh'
  | 'crm'
  | 'tables'
  | 'promotions'
  | 'loyalty'
  | 'kitchen'
  | 'ticketsFactures'
  | 'onlineOrders'
  | 'journal'
  | 'personnel'
  | 'pointage'
  | 'analytique'
  | 'integrations'
  | 'network'

export const VIEW_LABELS: Record<NavViewId, string> = {
  caisse: 'Caisse',
  dash: 'Tableau de bord',
  catalogue: 'Catalogue',
  stocks: 'Stocks',
  comptabilite: 'Comptabilité',
  rh: 'Gestion RH',
  crm: 'CRM clients',
  tables: 'Gestion des tables',
  promotions: 'Promotions',
  loyalty: 'Programme de fidélité',
  kitchen: 'Cuisine',
  ticketsFactures: 'Tickets & factures',
  onlineOrders: 'Commandes en ligne',
  journal: 'Rapport journalier',
  personnel: 'Personnel',
  pointage: 'Pointage',
  analytique: 'Analytique',
  integrations: 'Intégrations',
  network: 'Multi-magasins',
}

export const VIEW_SUBTITLES: Record<NavViewId, string> = {
  caisse: 'Scan, recherche, catégories, panier et TVA',
  dash: "Vue d'ensemble de l'activité",
  catalogue: 'Articles, prix et codes-barres',
  stocks:
    'Décrémentation à la vente, seuils d’alerte, inventaire manuel',
  comptabilite: 'Journaux comptables, ventilation HT/TVA et export des écritures',
  rh: 'Demandes RH, présence équipe et validations manager',
  crm: 'Suivi clients, interactions commerciales et relances',
  tables: 'Occupation, réservation et rotation des tables de service',
  promotions: 'Codes promo, fenêtres d’activation et seuils minimum panier',
  loyalty: 'Points clients, remises fidélité et historique des transactions',
  kitchen: 'Production cuisine, tickets et suivi des statuts de préparation',
  ticketsFactures:
    'Création, émission, suivi des règlements et archivage des tickets/factures',
  onlineOrders:
    'Validation des commandes web avant décrémentation stock et vente',
  journal: 'Synthèse du jour, paiements et reçus',
  personnel: 'Profils et rôles',
  pointage: 'Arrivées, départs et historique par magasin',
  analytique:
    'Périodes, top produits, heures de pointe, marges, exports CSV / Excel / PDF',
  integrations: 'Marketplace, API partenaires, app mobile gérant',
  network: 'Stocks par site, transferts, vue consolidée gérant',
}

export type ViewAccent = {
  icon: string
  iconActive: string
  labelActive: string
  chip: string
}

export const VIEW_ACCENTS: Record<NavViewId, ViewAccent> = {
  caisse: {
    icon: 'text-emerald-600 bg-emerald-50',
    iconActive: 'text-emerald-700 bg-emerald-100',
    labelActive: 'text-emerald-900',
    chip: 'bg-emerald-100 text-emerald-800',
  },
  dash: {
    icon: 'text-sky-600 bg-sky-50',
    iconActive: 'text-sky-700 bg-sky-100',
    labelActive: 'text-sky-900',
    chip: 'bg-sky-100 text-sky-800',
  },
  catalogue: {
    icon: 'text-indigo-600 bg-indigo-50',
    iconActive: 'text-indigo-700 bg-indigo-100',
    labelActive: 'text-indigo-900',
    chip: 'bg-indigo-100 text-indigo-800',
  },
  stocks: {
    icon: 'text-amber-600 bg-amber-50',
    iconActive: 'text-amber-700 bg-amber-100',
    labelActive: 'text-amber-900',
    chip: 'bg-amber-100 text-amber-800',
  },
  comptabilite: {
    icon: 'text-violet-600 bg-violet-50',
    iconActive: 'text-violet-700 bg-violet-100',
    labelActive: 'text-violet-900',
    chip: 'bg-violet-100 text-violet-800',
  },
  rh: {
    icon: 'text-fuchsia-600 bg-fuchsia-50',
    iconActive: 'text-fuchsia-700 bg-fuchsia-100',
    labelActive: 'text-fuchsia-900',
    chip: 'bg-fuchsia-100 text-fuchsia-800',
  },
  crm: {
    icon: 'text-cyan-600 bg-cyan-50',
    iconActive: 'text-cyan-700 bg-cyan-100',
    labelActive: 'text-cyan-900',
    chip: 'bg-cyan-100 text-cyan-800',
  },
  tables: {
    icon: 'text-orange-600 bg-orange-50',
    iconActive: 'text-orange-700 bg-orange-100',
    labelActive: 'text-orange-900',
    chip: 'bg-orange-100 text-orange-800',
  },
  promotions: {
    icon: 'text-rose-600 bg-rose-50',
    iconActive: 'text-rose-700 bg-rose-100',
    labelActive: 'text-rose-900',
    chip: 'bg-rose-100 text-rose-800',
  },
  loyalty: {
    icon: 'text-yellow-600 bg-yellow-50',
    iconActive: 'text-yellow-700 bg-yellow-100',
    labelActive: 'text-yellow-900',
    chip: 'bg-yellow-100 text-yellow-800',
  },
  kitchen: {
    icon: 'text-red-600 bg-red-50',
    iconActive: 'text-red-700 bg-red-100',
    labelActive: 'text-red-900',
    chip: 'bg-red-100 text-red-800',
  },
  ticketsFactures: {
    icon: 'text-teal-600 bg-teal-50',
    iconActive: 'text-teal-700 bg-teal-100',
    labelActive: 'text-teal-900',
    chip: 'bg-teal-100 text-teal-800',
  },
  onlineOrders: {
    icon: 'text-blue-600 bg-blue-50',
    iconActive: 'text-blue-700 bg-blue-100',
    labelActive: 'text-blue-900',
    chip: 'bg-blue-100 text-blue-800',
  },
  journal: {
    icon: 'text-zinc-600 bg-zinc-100',
    iconActive: 'text-zinc-800 bg-zinc-200',
    labelActive: 'text-zinc-900',
    chip: 'bg-zinc-200 text-zinc-800',
  },
  personnel: {
    icon: 'text-pink-600 bg-pink-50',
    iconActive: 'text-pink-700 bg-pink-100',
    labelActive: 'text-pink-900',
    chip: 'bg-pink-100 text-pink-800',
  },
  pointage: {
    icon: 'text-lime-600 bg-lime-50',
    iconActive: 'text-lime-700 bg-lime-100',
    labelActive: 'text-lime-900',
    chip: 'bg-lime-100 text-lime-800',
  },
  analytique: {
    icon: 'text-purple-600 bg-purple-50',
    iconActive: 'text-purple-700 bg-purple-100',
    labelActive: 'text-purple-900',
    chip: 'bg-purple-100 text-purple-800',
  },
  integrations: {
    icon: 'text-slate-600 bg-slate-100',
    iconActive: 'text-slate-800 bg-slate-200',
    labelActive: 'text-slate-900',
    chip: 'bg-slate-200 text-slate-800',
  },
  network: {
    icon: 'text-green-600 bg-green-50',
    iconActive: 'text-green-700 bg-green-100',
    labelActive: 'text-green-900',
    chip: 'bg-green-100 text-green-800',
  },
}

export type NavSection = {
  title: string
  items: {
    id: NavViewId
    label: string
    badge?: 'lowStock'
    /** Badges rupture + seuil (menu Stocks) */
    stockBadges?: boolean
  }[]
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: 'Ventes',
    items: [
      { id: 'caisse', label: 'Caisse' },
      { id: 'dash', label: 'Tableau de bord' },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { id: 'catalogue', label: 'Catalogue' },
      { id: 'stocks', label: 'Stocks', stockBadges: true },
      { id: 'comptabilite', label: 'Comptabilité' },
      { id: 'rh', label: 'Gestion RH' },
      { id: 'crm', label: 'CRM clients' },
      { id: 'tables', label: 'Gestion des tables' },
      { id: 'promotions', label: 'Promotions' },
      { id: 'loyalty', label: 'Programme de fidélité' },
      { id: 'kitchen', label: 'Cuisine' },
      { id: 'ticketsFactures', label: 'Tickets & factures' },
      { id: 'onlineOrders', label: 'Commandes en ligne' },
      { id: 'network', label: 'Multi-magasins' },
      { id: 'journal', label: 'Rapport journalier' },
    ],
  },
  {
    title: 'Équipe',
    items: [
      { id: 'personnel', label: 'Personnel' },
      { id: 'pointage', label: 'Pointage' },
      { id: 'analytique', label: 'Analytique' },
    ],
  },
  {
    title: 'Écosystème',
    items: [{ id: 'integrations', label: 'Intégrations' }],
  },
] as const

/** Caissier : caisse, commandes web (reçus), catalogue lecture, multi-magasins (vue), rapport du jour. */
const NAV_SECTIONS_CAISSIER: readonly NavSection[] = [
  {
    title: 'Ventes',
    items: [
      { id: 'caisse', label: 'Caisse' },
      { id: 'onlineOrders', label: 'Commandes en ligne' },
      { id: 'journal', label: 'Rapport journalier' },
    ],
  },
  {
    title: 'Temps',
    items: [{ id: 'pointage', label: 'Pointage' }],
  },
]

/** Gérant : comme l’admin sauf personnel, création de magasins (onglet) et intégrations. */
const NAV_SECTIONS_GERANT: readonly NavSection[] = [
  NAV_SECTIONS[0],
  NAV_SECTIONS[1],
  {
    title: 'Équipe',
    items: [
      { id: 'pointage', label: 'Pointage' },
      { id: 'analytique', label: 'Analytique' },
    ],
  },
] as const

export function navSectionsForRole(role: UserRole): readonly NavSection[] {
  if (role === 'caissier') return NAV_SECTIONS_CAISSIER
  if (role === 'gerant') return NAV_SECTIONS_GERANT
  return NAV_SECTIONS
}

export function flattenedNavViewIds(
  sections: readonly NavSection[],
): Set<NavViewId> {
  return new Set(sections.flatMap((s) => s.items.map((i) => i.id)))
}
