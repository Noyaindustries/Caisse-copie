import type { StaffProfile, StaffPermissions, UserRole } from './types'

/** Permissions par défaut selon le rôle (granulaire). */
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, StaffPermissions> = {
  admin: {
    maxDiscountPct: 100,
    canViewDashboard: true,
    canViewAnalytique: true,
    canViewJournalReport: true,
    canManageCatalogFull: true,
    canEditPrices: true,
    canManageStocks: true,
    canDailyClosure: true,
    canProcessRefunds: true,
    canSwitchStore: true,
    canManagePersonnel: true,
    canViewTeamPointage: true,
    canConfigureStoresAdmin: true,
    canManageIntegrations: true,
    canConfigureAppSettings: true,
  },
  gerant: {
    maxDiscountPct: 20,
    canViewDashboard: true,
    canViewAnalytique: true,
    canViewJournalReport: true,
    canManageCatalogFull: true,
    canEditPrices: true,
    canManageStocks: true,
    canDailyClosure: true,
    canProcessRefunds: true,
    canSwitchStore: true,
    canManagePersonnel: true,
    canViewTeamPointage: true,
    canConfigureStoresAdmin: false,
    canManageIntegrations: false,
    canConfigureAppSettings: true,
  },
  caissier: {
    maxDiscountPct: 5,
    canViewDashboard: false,
    canViewAnalytique: false,
    canViewJournalReport: true,
    canManageCatalogFull: false,
    canEditPrices: false,
    canManageStocks: false,
    canDailyClosure: false,
    canProcessRefunds: false,
    canSwitchStore: false,
    canManagePersonnel: false,
    canViewTeamPointage: false,
    canConfigureStoresAdmin: false,
    canManageIntegrations: false,
    canConfigureAppSettings: false,
  },
  cuisinier: {
    maxDiscountPct: 0,
    canViewDashboard: false,
    canViewAnalytique: false,
    canViewJournalReport: false,
    canManageCatalogFull: false,
    canEditPrices: false,
    canManageStocks: false,
    canDailyClosure: false,
    canProcessRefunds: false,
    canSwitchStore: false,
    canManagePersonnel: false,
    canViewTeamPointage: false,
    canConfigureStoresAdmin: false,
    canManageIntegrations: false,
    canConfigureAppSettings: false,
  },
}

export function effectivePermissions(profile: StaffProfile): StaffPermissions {
  const base = ROLE_DEFAULT_PERMISSIONS[profile.role]
  return { ...base, ...profile.permissionOverrides }
}

/** Vérifie le secret : PIN ou mot de passe (si défini). */
export function profileSecretMatches(
  profile: StaffProfile,
  secret: string,
): boolean {
  const s = secret.trim()
  if (s === profile.pin) return true
  if (profile.password && s === profile.password) return true
  return false
}
