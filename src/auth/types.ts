/** Rôles : administrateur, gérant (magasin), caissier. */
export type UserRole = 'admin' | 'gerant' | 'caissier'

/** Droits granulaires (fusionnés rôle + overrides profil). */
export interface StaffPermissions {
  /** Plafond remise panier (codes promo / remise %) — 0 = aucune. */
  maxDiscountPct: number
  canViewDashboard: boolean
  canViewAnalytique: boolean
  canViewJournalReport: boolean
  canManageCatalogFull: boolean
  /** Modifier prix vente & prix de revient (catalogue). */
  canEditPrices: boolean
  canManageStocks: boolean
  canDailyClosure: boolean
  canProcessRefunds: boolean
  canSwitchStore: boolean
  canManagePersonnel: boolean
  /** Voir et filtrer les pointages de toute l’équipe (sinon : uniquement le sien). */
  canViewTeamPointage: boolean
  /** Onglet création magasins / admin réseau. */
  canConfigureStoresAdmin: boolean
  canManageIntegrations: boolean
}

export interface StaffProfile {
  id: string
  displayName: string
  initials: string
  role: UserRole
  /** Magasin assigné (optionnel). */
  storeId?: string
  /** PIN court (caisse). */
  pin: string
  /** Mot de passe optionnel (même champ de saisie à la connexion). */
  password?: string
  /** Surcharge des droits du rôle (démo / cas particuliers). */
  permissionOverrides?: Partial<StaffPermissions>
}

export type StaffAuthMethod = 'pin' | 'password'

export interface StaffSession {
  profileId: string
  loggedAt: number
  /** Comment la session a été ouverte (audit léger). */
  authMethod?: StaffAuthMethod
}
