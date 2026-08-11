import type { StaffProfile } from './types'
import { isCloudApiConfigured } from '../lib/apiUrl'
import { clientEnv } from '../lib/clientEnv'
import { hasOrgAuth } from '../lib/subscription/authHeaders'

/** PIN provisoire pour un profil cloud dont le secret n’est pas encore connu localement. */
const REMOTE_PIN_PLACEHOLDER = '0000'

export class StaffCloudSyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StaffCloudSyncError'
  }
}

/** Profil admin créé automatiquement à l’inscription (prod) — PIN initial. */
export const OWNER_PROFILE_ID = 'profile-owner'
export const DEFAULT_OWNER_PIN = '1234'

/**
 * Profils démo — disponibles uniquement en développement local.
 */
const BUILTIN_STAFF_PROFILES: readonly StaffProfile[] = clientEnv.isDev()
  ? ([
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
      {
        id: 'profile-cuisinier',
        displayName: 'Bamba Ouattara',
        initials: 'BO',
        role: 'cuisinier',
        pin: '2468',
        password: 'cuisine',
      },
    ] as const)
  : []

const CLOUD_STAFF_KEY = 'caisseci-cloud-staff-v1'
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
    (v.role === 'admin' ||
      v.role === 'gerant' ||
      v.role === 'caissier' ||
      v.role === 'cuisinier') &&
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
  const byId = new Map<string, StaffProfile>()
  for (const p of [
    ...BUILTIN_STAFF_PROFILES,
    ...readCloudStaffProfiles(),
    ...readCustomProfiles(),
  ]) {
    const prev = byId.get(p.id)
    byId.set(p.id, prev ? { ...prev, ...p } : p)
  }
  return [...byId.values()].map((p) => ({
    ...p,
    active: p.active !== false,
    password: overrides[p.id] ?? p.password,
  }))
}

function readCloudStaffProfiles(): StaffProfile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(organizationStorageKey(CLOUD_STAFF_KEY))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isStaffProfile)
  } catch {
    return []
  }
}

function writeCloudStaffProfiles(profiles: StaffProfile[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(organizationStorageKey(CLOUD_STAFF_KEY), JSON.stringify(profiles))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Envoie les utilisateurs créés localement qui n’existent pas encore côté serveur. */
export async function pushPendingLocalStaffToCloud(): Promise<number> {
  if (typeof window === 'undefined' || !isCloudApiConfigured() || !hasOrgAuth()) {
    return 0
  }
  try {
    const { fetchRemoteStaff, createRemoteStaff } = await import('../lib/staff/api')
    const remote = await fetchRemoteStaff()
    const remoteIds = new Set(remote.map((row) => row.id))
    const pending = readCustomProfiles().filter(
      (profile) => profile.active !== false && !remoteIds.has(profile.id),
    )
    let pushed = 0
    for (const profile of pending) {
      try {
        await createRemoteStaff({
          profileId: profile.id,
          displayName: profile.displayName,
          role: profile.role,
          storeId: profile.storeId,
          pin: profile.pin,
          password: profile.password,
        })
        pushed += 1
      } catch {
        /* quota, doublon ou API indisponible */
      }
    }
    return pushed
  } catch {
    return 0
  }
}

/** Recharge la liste serveur (GET /org/staff) et la fusionne en local. */
export async function hydrateStaffFromRemote(): Promise<number> {
  if (typeof window === 'undefined' || !isCloudApiConfigured()) return 0
  if (!hasOrgAuth()) return 0
  try {
    const { fetchRemoteStaff } = await import('../lib/staff/api')
    const remote = await fetchRemoteStaff()
    if (remote.length === 0) return 0
    return mergeStaffFromCloud(remote)
  } catch {
    return 0
  }
}

export function mergeStaffFromCloud(
  remote: Array<{
    id: string
    displayName: string
    initials: string
    role: StaffProfile['role']
    storeId?: string | null
    active: boolean
  }>,
): number {
  const localCustom = readCustomProfiles()
  const existingCloud = readCloudStaffProfiles()
  const localById = new Map(
    [...existingCloud, ...localCustom].map((p) => [p.id, p] as const),
  )
  const merged: StaffProfile[] = remote.map((row) => {
    const local = localById.get(row.id)
    return {
      id: row.id,
      displayName: row.displayName,
      initials: row.initials,
      role: row.role,
      active: row.active,
      ...(row.storeId ? { storeId: row.storeId } : {}),
      pin:
        local?.pin && local.pin !== REMOTE_PIN_PLACEHOLDER
          ? local.pin
          : row.id === OWNER_PROFILE_ID
            ? DEFAULT_OWNER_PIN
            : REMOTE_PIN_PLACEHOLDER,
      ...(local?.password ? { password: local.password } : {}),
    }
  })
  writeCloudStaffProfiles(merged)
  return merged.length
}

/**
 * Crée le premier admin local si aucun profil actif (évite l’impasse en production
 * où les profils démo sont désactivés et Personnel n’est accessible qu’après login).
 */
export function ensureOwnerAdminProfile(orgName: string): StaffProfile | null {
  if (typeof window === 'undefined') return null
  if (listActiveStaffProfiles().length > 0) return null

  const rawName = orgName.trim()
  const displayName =
    rawName.length >= 3 ? rawName.slice(0, 80) : 'Administrateur'
  const created: StaffProfile = {
    id: OWNER_PROFILE_ID,
    displayName,
    initials: computeInitials(displayName),
    role: 'admin',
    active: true,
    pin: DEFAULT_OWNER_PIN,
  }

  const custom = readCustomProfiles().filter((p) => p.id !== OWNER_PROFILE_ID)
  custom.push(created)
  writeCustomProfiles(custom)
  swallowStaffCloudSync('create', {
    profileId: created.id,
    displayName: created.displayName,
    role: created.role,
    pin: created.pin,
  })
  return created
}

async function pushStaffToServer(
  action: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>,
): Promise<void> {
  if (!isCloudApiConfigured()) {
    throw new StaffCloudSyncError(
      'API cloud non configurée : l’utilisateur restera sur cet appareil.',
    )
  }
  if (!hasOrgAuth()) {
    throw new StaffCloudSyncError(
      'Session entreprise absente : reconnectez le magasin pour synchroniser le personnel.',
    )
  }
  const { createRemoteStaff, updateRemoteStaff, deleteRemoteStaff } = await import(
    '../lib/staff/api'
  )
  if (action === 'create') {
    await createRemoteStaff(payload as Parameters<typeof createRemoteStaff>[0])
  } else if (action === 'update') {
    await updateRemoteStaff(String(payload.profileId), payload.patch as never)
  } else {
    await deleteRemoteStaff(String(payload.profileId))
  }
}

function swallowStaffCloudSync(action: 'create' | 'update' | 'delete', payload: Record<string, unknown>): void {
  void pushStaffToServer(action, payload).catch(() => {
    /* hors ligne ou API indisponible */
  })
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

export async function createStaffProfile(input: {
  displayName: string
  role: StaffProfile['role']
  storeId?: string
  pin: string
  password?: string
  /** Plafond utilisateurs du plan (actifs). Si omis, pas de contrôle. */
  maxStaff?: number
}): Promise<StaffProfile> {
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
  const cloud = readCloudStaffProfiles().filter((p) => p.id !== created.id)
  cloud.push(created)
  writeCloudStaffProfiles(cloud)
  try {
    await pushStaffToServer('create', {
      profileId: created.id,
      displayName: created.displayName,
      role: created.role,
      storeId: created.storeId,
      pin: created.pin,
      password: created.password,
    })
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'Synchronisation cloud impossible.'
    throw new StaffCloudSyncError(
      `${detail} L’utilisateur est enregistré ici, mais n’apparaîtra pas sur les autres caisses tant que le serveur n’est pas joignable.`,
    )
  }
  return created
}

/** Mémorise un PIN / mot de passe validé par le serveur (autre appareil). */
export function rememberStaffSecret(profileId: string, secret: string): void {
  const value = secret.trim()
  if (!value) return
  const apply = (profile: StaffProfile): StaffProfile => {
    const next = { ...profile }
    if (/^\d{4,8}$/.test(value)) next.pin = value
    else next.password = value
    return next
  }
  const custom = readCustomProfiles()
  const customIdx = custom.findIndex((p) => p.id === profileId)
  if (customIdx >= 0) {
    custom[customIdx] = apply(custom[customIdx]!)
    writeCustomProfiles(custom)
  }
  const cloud = readCloudStaffProfiles()
  const cloudIdx = cloud.findIndex((p) => p.id === profileId)
  if (cloudIdx >= 0) {
    cloud[cloudIdx] = apply(cloud[cloudIdx]!)
    writeCloudStaffProfiles(cloud)
  }
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
  const cloud = readCloudStaffProfiles()
  const idx = custom.findIndex((p) => p.id === profileId)
  const cloudIdx = cloud.findIndex((p) => p.id === profileId)
  const current = (idx >= 0 ? custom[idx] : null) ?? (cloudIdx >= 0 ? cloud[cloudIdx] : null)
  if (!current) throw new Error('Profil introuvable.')
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

  if (idx >= 0) {
    custom[idx] = next
    writeCustomProfiles(custom)
  } else {
    custom.push(next)
    writeCustomProfiles(custom)
  }
  if (cloudIdx >= 0) {
    cloud[cloudIdx] = {
      ...cloud[cloudIdx]!,
      displayName: next.displayName,
      initials: next.initials,
      role: next.role,
      active: next.active,
      ...(next.storeId ? { storeId: next.storeId } : {}),
      pin: next.pin,
    }
    writeCloudStaffProfiles(cloud)
  }
  swallowStaffCloudSync('update', {
    profileId,
    patch: {
      displayName: next.displayName,
      role: next.role,
      storeId: next.storeId ?? null,
      pin: patch.pin,
      password: patch.password ?? undefined,
      active: next.active,
    },
  })
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
  const cloud = readCloudStaffProfiles().filter((p) => p.id !== profileId)
  writeCloudStaffProfiles(cloud)
  const overrides = readPasswordOverrides()
  if (overrides[profileId]) {
    delete overrides[profileId]
    writePasswordOverrides(overrides)
  }
  swallowStaffCloudSync('delete', { profileId })
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
  switch (role) {
    case 'admin':
      return 'Administrateur'
    case 'gerant':
      return 'Gérant'
    case 'caissier':
      return 'Caissier'
    case 'cuisinier':
      return 'Cuisinier'
    default: {
      const _exhaustive: never = role
      return _exhaustive
    }
  }
}
