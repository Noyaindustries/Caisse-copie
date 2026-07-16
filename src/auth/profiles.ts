import type { StaffProfile } from './types'

/**
 * Profils démo — en production : API + politique mot de passe.
 * Connexion : même champ accepte le PIN ou le mot de passe si défini.
 */
const BUILTIN_STAFF_PROFILES: readonly StaffProfile[] = [
  {
    id: 'profile-caissier',
    displayName: 'Awa Konaté',
    initials: 'AK',
    role: 'caissier',
    pin: '1234',
    password: 'caisse',
  },
  {
    id: 'profile-gerant',
    displayName: 'Koffi N’Guessan',
    initials: 'KN',
    role: 'gerant',
    pin: '4321',
    password: 'gerant2024',
  },
  {
    id: 'profile-admin',
    displayName: 'Kouadio Yao',
    initials: 'KY',
    role: 'admin',
    pin: '5678',
    password: 'admin',
  },
] as const

const STORAGE_KEY = 'caisseci-custom-staff-profiles-v1'
const PASSWORD_OVERRIDES_KEY = 'caisseci-staff-password-overrides-v1'
const ORG_CREDENTIALS_KEY = 'caisseci-org-credentials-v1'
const LEGACY_PROFILE_OWNER_KEY = 'caisseci-legacy-profile-owner-v1'
const CHANGE_EVENT = 'caisseci-staff-profiles-changed'

function currentOrganizationId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ORG_CREDENTIALS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'organizationId' in parsed &&
      typeof parsed.organizationId === 'string'
    ) {
      return parsed.organizationId
    }
  } catch {
    return null
  }
  return null
}

function organizationStorageKey(baseKey: string): string {
  const organizationId = currentOrganizationId()
  if (!organizationId) return `${baseKey}:unassigned`

  const legacyOwner = localStorage.getItem(LEGACY_PROFILE_OWNER_KEY)
  if (!legacyOwner) {
    localStorage.setItem(LEGACY_PROFILE_OWNER_KEY, organizationId)
    return baseKey
  }
  return legacyOwner === organizationId ? baseKey : `${baseKey}:${organizationId}`
}

function isStaffProfile(value: unknown): value is StaffProfile {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<StaffProfile>
  return (
    typeof v.id === 'string' &&
    typeof v.displayName === 'string' &&
    typeof v.initials === 'string' &&
    (v.storeId === undefined || typeof v.storeId === 'string') &&
    (v.role === 'admin' || v.role === 'gerant' || v.role === 'caissier') &&
    typeof v.pin === 'string' &&
    (v.password === undefined || typeof v.password === 'string') &&
    (v.active === undefined || typeof v.active === 'boolean')
  )
}

function isBuiltinProfileId(id: string): boolean {
  return BUILTIN_STAFF_PROFILES.some((p) => p.id === id)
}

function readCustomProfiles(): StaffProfile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(organizationStorageKey(STORAGE_KEY))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isStaffProfile)
  } catch {
    return []
  }
}

function readPasswordOverrides(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(organizationStorageKey(PASSWORD_OVERRIDES_KEY))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === 'string' && typeof v === 'string' && v.trim() !== '') {
        out[k] = v
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeCustomProfiles(profiles: StaffProfile[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(organizationStorageKey(STORAGE_KEY), JSON.stringify(profiles))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function writePasswordOverrides(overrides: Record<string, string>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(
    organizationStorageKey(PASSWORD_OVERRIDES_KEY),
    JSON.stringify(overrides),
  )
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function listStaffProfiles(): StaffProfile[] {
  const overrides = readPasswordOverrides()
  return [...BUILTIN_STAFF_PROFILES, ...readCustomProfiles()].map((p) => ({
    ...p,
    active: p.active !== false,
    password: overrides[p.id] ?? p.password,
  }))
}

/** Profils autorisés à se connecter (actifs uniquement). */
export function listActiveStaffProfiles(): StaffProfile[] {
  return listStaffProfiles().filter((p) => p.active !== false)
}

export function countActiveStaffProfiles(): number {
  return listActiveStaffProfiles().length
}

export function isCustomStaffProfile(id: string): boolean {
  return !isBuiltinProfileId(id)
}

export function subscribeStaffProfiles(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = () => onChange()
  window.addEventListener(CHANGE_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

function computeInitials(displayName: string): string {
  const chunks = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (chunks.length === 0) return 'NN'
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase()
  return `${chunks[0][0] ?? ''}${chunks[1][0] ?? ''}`.toUpperCase()
}

export function createStaffProfile(input: {
  displayName: string
  role: StaffProfile['role']
  storeId?: string
  pin: string
  password?: string
  /** Plafond utilisateurs du plan (actifs). Si omis, pas de contrôle. */
  maxStaff?: number
}): StaffProfile {
  const displayName = input.displayName.trim()
  const storeId = input.storeId?.trim() || undefined
  const pin = input.pin.trim()
  const password = input.password?.trim() || undefined
  if (displayName.length < 3) {
    throw new Error('Le nom complet doit contenir au moins 3 caractères.')
  }
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('Le PIN doit contenir entre 4 et 8 chiffres.')
  }
  if (
    typeof input.maxStaff === 'number' &&
    input.maxStaff > 0 &&
    countActiveStaffProfiles() >= input.maxStaff
  ) {
    throw new Error(
      `Limite d’utilisateurs atteinte (${input.maxStaff}). Passez à un plan supérieur ou désactivez un compte.`,
    )
  }
  const all = listStaffProfiles()
  if (all.some((p) => p.pin === pin)) {
    throw new Error('Ce PIN est déjà utilisé par un autre profil.')
  }
  const created: StaffProfile = {
    id: `profile-custom-${crypto.randomUUID()}`,
    displayName,
    initials: computeInitials(displayName),
    role: input.role,
    active: true,
    ...(storeId ? { storeId } : {}),
    pin,
    ...(password ? { password } : {}),
  }
  const custom = readCustomProfiles()
  custom.push(created)
  writeCustomProfiles(custom)
  return created
}

export function updateStaffProfile(
  profileId: string,
  patch: {
    displayName?: string
    role?: StaffProfile['role']
    storeId?: string | null
    pin?: string
    password?: string | null
    active?: boolean
  },
): StaffProfile {
  if (isBuiltinProfileId(profileId)) {
    throw new Error(
      'Les profils de démonstration ne peuvent pas être modifiés. Créez un nouvel utilisateur.',
    )
  }
  const custom = readCustomProfiles()
  const idx = custom.findIndex((p) => p.id === profileId)
  if (idx < 0) throw new Error('Profil introuvable.')

  const current = custom[idx]!
  const next: StaffProfile = { ...current }

  if (patch.displayName !== undefined) {
    const displayName = patch.displayName.trim()
    if (displayName.length < 3) {
      throw new Error('Le nom complet doit contenir au moins 3 caractères.')
    }
    next.displayName = displayName
    next.initials = computeInitials(displayName)
  }
  if (patch.role !== undefined) next.role = patch.role
  if (patch.storeId !== undefined) {
    const storeId = patch.storeId?.trim() || undefined
    if (storeId) next.storeId = storeId
    else delete next.storeId
  }
  if (patch.pin !== undefined) {
    const pin = patch.pin.trim()
    if (!/^\d{4,8}$/.test(pin)) {
      throw new Error('Le PIN doit contenir entre 4 et 8 chiffres.')
    }
    const conflict = listStaffProfiles().some(
      (p) => p.id !== profileId && p.pin === pin,
    )
    if (conflict) throw new Error('Ce PIN est déjà utilisé par un autre profil.')
    next.pin = pin
  }
  if (patch.password !== undefined) {
    const password = patch.password?.trim() || undefined
    if (password) next.password = password
    else delete next.password
  }
  if (patch.active !== undefined) next.active = patch.active

  custom[idx] = next
  writeCustomProfiles(custom)
  return profileById(profileId) ?? next
}

/** Soft-delete : désactive un profil personnalisé (conservé pour l’historique). */
export function deactivateStaffProfile(profileId: string): void {
  updateStaffProfile(profileId, { active: false })
}

export function reactivateStaffProfile(profileId: string, maxStaff?: number): void {
  if (
    typeof maxStaff === 'number' &&
    maxStaff > 0 &&
    countActiveStaffProfiles() >= maxStaff
  ) {
    throw new Error(
      `Limite d’utilisateurs atteinte (${maxStaff}). Désactivez un autre compte ou changez de plan.`,
    )
  }
  updateStaffProfile(profileId, { active: true })
}

/** Suppression définitive (profils personnalisés uniquement). */
export function deleteStaffProfile(profileId: string): void {
  if (isBuiltinProfileId(profileId)) {
    throw new Error('Les profils de démonstration ne peuvent pas être supprimés.')
  }
  const custom = readCustomProfiles().filter((p) => p.id !== profileId)
  writeCustomProfiles(custom)
  const overrides = readPasswordOverrides()
  if (overrides[profileId]) {
    delete overrides[profileId]
    writePasswordOverrides(overrides)
  }
}

export function changeStaffPassword(input: {
  profileId: string
  currentSecret: string
  nextPassword: string
}): void {
  const profile = profileById(input.profileId)
  if (!profile) {
    throw new Error('Profil introuvable.')
  }
  const current = input.currentSecret.trim()
  const next = input.nextPassword.trim()
  if (current.length === 0) {
    throw new Error('Saisissez votre mot de passe (ou PIN) actuel.')
  }
  const currentOk = current === profile.pin || current === (profile.password ?? '')
  if (!currentOk) {
    throw new Error('Mot de passe actuel incorrect.')
  }
  if (next.length < 4) {
    throw new Error('Le nouveau mot de passe doit contenir au moins 4 caractères.')
  }
  if (next === profile.pin) {
    throw new Error('Le mot de passe ne doit pas être identique au PIN.')
  }
  const overrides = readPasswordOverrides()
  overrides[profile.id] = next
  writePasswordOverrides(overrides)
}

export function profileById(id: string): StaffProfile | undefined {
  return listStaffProfiles().find((p) => p.id === id)
}

export function roleLabel(role: StaffProfile['role']): string {
  if (role === 'admin') return 'Administrateur'
  if (role === 'gerant') return 'Gérant'
  return 'Caissier'
}
