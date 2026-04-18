import type { UserRole } from './auth/types'

export type NavViewId =
  | 'caisse'
  | 'dash'
  | 'catalogue'
  | 'stocks'
  | 'onlineOrders'
  | 'journal'
  | 'personnel'
  | 'analytique'
  | 'integrations'
  | 'network'

export const VIEW_LABELS: Record<NavViewId, string> = {
  caisse: 'Caisse',
  dash: 'Tableau de bord',
  catalogue: 'Catalogue',
  stocks: 'Stocks',
  onlineOrders: 'Commandes en ligne',
  journal: 'Rapport journalier',
  personnel: 'Personnel',
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
  onlineOrders:
    'Validation des commandes web avant décrémentation stock et vente',
  journal: 'Synthèse du jour, paiements et reçus',
  personnel: 'Profils et rôles',
  analytique:
    'Périodes, top produits, heures de pointe, marges, exports CSV / Excel / PDF',
  integrations: 'Marketplace, API partenaires, app mobile gérant',
  network: 'Stocks par site, transferts, vue consolidée gérant',
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
      { id: 'onlineOrders', label: 'Commandes en ligne' },
      { id: 'network', label: 'Multi-magasins' },
      { id: 'journal', label: 'Rapport journalier' },
    ],
  },
  {
    title: 'Équipe',
    items: [
      { id: 'personnel', label: 'Personnel' },
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
    title: 'Articles',
    items: [
      { id: 'catalogue', label: 'Catalogue' },
      { id: 'network', label: 'Multi-magasins' },
    ],
  },
]

/** Gérant : comme l’admin sauf personnel, création de magasins (onglet) et intégrations. */
const NAV_SECTIONS_GERANT: readonly NavSection[] = [
  NAV_SECTIONS[0],
  NAV_SECTIONS[1],
  {
    title: 'Équipe',
    items: [{ id: 'analytique', label: 'Analytique' }],
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
