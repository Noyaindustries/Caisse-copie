import type { StaffProfile } from './types'
import { isCloudApiConfigured } from '../lib/apiUrl'
import { clientEnv } from '../lib/clientEnv'
import { hasOrgAuth } from '../lib/subscription/authHeaders'
import {
  createRemoteStaff,
  deleteRemoteStaff,
  fetchRemoteStaff,
  updateRemoteStaff,
} from '../lib/staff/api'

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
const DELETED_STAFF_KEY = 'caisseci-staff-deleted-ids-v1'
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

/** Les profils démo ne s’affichent pas dès qu’un magasin est connecté. */
function demoStaffProfiles(): readonly StaffProfile[] {
  if (currentOrganizationId()) return []
  return BUILTIN_STAFF_PROFILES
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
    ...demoStaffProfiles(),
    ...readCloudStaffProfiles(),
    ...readCustomProfiles(),
  ]) {
    const prev = byId.get(p.id)
    byId.set(p.id, prev ? { ...prev, ...p } : p)
  }
  const deleted = readDeletedStaffIds()
  return [...byId.values()]
    .filter((p) => !deleted.has(p.id))
    .map((p) => ({
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

function readDeletedStaffIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(organizationStorageKey(DELETED_STAFF_KEY))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function writeDeletedStaffIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(
    organizationStorageKey(DELETED_STAFF_KEY),
    JSON.stringify([...ids]),
  )
}

function rememberDeletedStaffId(profileId: string): void {
  const ids = readDeletedStaffIds()
  ids.add(profileId)
  writeDeletedStaffIds(ids)
}

function forgetDeletedStaffId(profileId: string): void {
  const ids = readDeletedStaffIds()
  if (!ids.delete(profileId)) return
  writeDeletedStaffIds(ids)
}

function pruneLocalStaffIds(profileIds: string[]): void {
  if (profileIds.length === 0 || typeof window === 'undefined') return
  const remove = new Set(profileIds)
  localStorage.setItem(
    organizationStorageKey(STORAGE_KEY),
    JSON.stringify(readCustomProfiles().filter((p) => !remove.has(p.id))),
  )
  localStorage.setItem(
    organizationStorageKey(CLOUD_STAFF_KEY),
    JSON.stringify(readCloudStaffProfiles().filter((p) => !remove.has(p.id))),
  )
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function isRemoteStaffGoneError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /introuvable|404|supprim|410|gone|révoqu|revoqu/i.test(message)
}

export type StaffCloudSyncResult = {
  pulled: number
  pushed: number
  error?: string
}

/**
 * Pousse les comptes locaux manquants puis recharge la liste serveur.
 * À appeler à l’ouverture de la caisse, pas seulement dans Personnel.
 */
export async function syncStaffWithCloud(): Promise<StaffCloudSyncResult> {
  if (typeof window === 'undefined') return { pulled: 0, pushed: 0 }
  if (!isCloudApiConfigured()) {
    return { pulled: 0, pushed: 0, error: 'API cloud non configurée.' }
  }
  if (!hasOrgAuth()) {
    return {
      pulled: 0,
      pushed: 0,
      error: 'Session entreprise absente. Reconnectez le magasin.',
    }
  }

  try {
    let remote = await fetchRemoteStaff()
    const deletedIds = readDeletedStaffIds()
    const stillPresent = remote.filter((row) => deletedIds.has(row.id))
    for (const row of stillPresent) {
      try {
        await deleteRemoteStaff(row.id)
      } catch (error) {
        if (/dernier administrateur/i.test(error instanceof Error ? error.message : '')) {
          forgetDeletedStaffId(row.id)
        }
      }
    }
    if (stillPresent.length > 0) {
      remote = await fetchRemoteStaff()
    }
    const remoteIds = new Set(remote.map((row) => row.id))
    const knownCloudIds = new Set(readCloudStaffProfiles().map((p) => p.id))
    const customIds = new Set(readCustomProfiles().map((p) => p.id))
    // Un compte créé ici (custom) n’est pas « disparu » : il doit être poussé,
    // pas effacé, si le POST cloud a échoué au tour précédent.
    const vanished = [...knownCloudIds].filter(
      (id) => !remoteIds.has(id) && !customIds.has(id),
    )
    if (vanished.length > 0) {
      for (const id of vanished) rememberDeletedStaffId(id)
      pruneLocalStaffIds(vanished)
    }
    let pushed = 0
    let lastPushError: string | undefined
    const skipIds = readDeletedStaffIds()
    for (const profile of readCustomProfiles()) {
      if (
        profile.active === false ||
        remoteIds.has(profile.id) ||
        skipIds.has(profile.id)
      ) {
        continue
      }
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
        remoteIds.add(profile.id)
        forgetDeletedStaffId(profile.id)
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Impossible d’envoyer un utilisateur vers le cloud.'
        if (isRemoteStaffGoneError(error)) {
          rememberDeletedStaffId(profile.id)
          pruneLocalStaffIds([profile.id])
          continue
        }
        if (/déjà|already|existe/i.test(message)) {
          remoteIds.add(profile.id)
          continue
        }
        if (/limite d[’']utilisateurs|quota/i.test(message)) {
          pruneLocalStaffIds([profile.id])
          lastPushError = message
          break
        }
        lastPushError = message
        console.error('[staff-sync] push failed', profile.id, error)
      }
    }
    if (pushed > 0) {
      remote = await fetchRemoteStaff()
    }
    const pulled = mergeStaffFromCloud(remote)
    return {
      pulled,
      pushed,
      ...(lastPushError ? { error: lastPushError } : {}),
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Synchronisation du personnel impossible.'
    console.error('[staff-sync]', error)
    return { pulled: 0, pushed: 0, error: message }
  }
}

/** Envoie les utilisateurs créés localement qui n’existent pas encore côté serveur. */
export async function pushPendingLocalStaffToCloud(): Promise<number> {
  const result = await syncStaffWithCloud()
  return result.pushed
}

/** Recharge la liste serveur (GET /org/staff) et la fusionne en local. */
export async function hydrateStaffFromRemote(): Promise<number> {
  const result = await syncStaffWithCloud()
  return result.pulled
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
  const deletedIds = readDeletedStaffIds()
  const visibleRemote = remote.filter((row) => !deletedIds.has(row.id))
  const remoteIds = new Set(visibleRemote.map((row) => row.id))
  const staleLocal = [...readCustomProfiles(), ...readCloudStaffProfiles()]
    .map((profile) => profile.id)
    .filter((id) => deletedIds.has(id))
  if (staleLocal.length > 0) pruneLocalStaffIds(staleLocal)
  const existingCloud = readCloudStaffProfiles()
  const customIds = new Set(readCustomProfiles().map((p) => p.id))
  const vanished = existingCloud
    .map((profile) => profile.id)
    .filter((id) => !remoteIds.has(id) && !customIds.has(id))
  if (vanished.length > 0) {
    for (const id of vanished) rememberDeletedStaffId(id)
    pruneLocalStaffIds(vanished)
  }
  const localById = new Map(
    [...readCloudStaffProfiles(), ...readCustomProfiles()].map(
      (profile) => [profile.id, profile] as const,
    ),
  )
  const merged: StaffProfile[] = visibleRemote.map((row) => {
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
  if (readDeletedStaffIds().has(OWNER_PROFILE_ID)) return null
  // Magasin connecté : le serveur est source de vérité (ne pas recréer un owner supprimé).
  if (hasOrgAuth()) return null

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
  const previousCustom = readCustomProfiles()
  const custom = [...previousCustom, created]
  writeCustomProfiles(custom)
  try {
    await pushStaffToServer('create', {
      profileId: created.id,
      displayName: created.displayName,
      role: created.role,
      storeId: created.storeId,
      pin: created.pin,
      password: created.password,
    })
    const cloud = readCloudStaffProfiles().filter((p) => p.id !== created.id)
    cloud.push(created)
    writeCloudStaffProfiles(cloud)
    forgetDeletedStaffId(created.id)
  } catch (error) {
    console.error('[staff-create] cloud push failed', error)
    const detail =
      error instanceof Error ? error.message : 'Synchronisation cloud impossible.'
    const quotaBlocked = /limite d[’']utilisateurs|quota/i.test(detail)
    if (quotaBlocked || isRemoteStaffGoneError(error)) {
      writeCustomProfiles(previousCustom)
      throw new StaffCloudSyncError(detail)
    }
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
  if (
    current.role === 'admin' &&
    current.active !== false &&
    (patch.active === false || (patch.role !== undefined && patch.role !== 'admin'))
  ) {
    assertNotLastActiveAdmin(profileId)
  }
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

const LAST_ADMIN_ERROR =
  'Impossible de supprimer ou désactiver le dernier administrateur. Créez-en un autre d’abord.'

function assertNotLastActiveAdmin(profileId: string): void {
  const profile = profileById(profileId)
  if (profile?.role !== 'admin' || profile.active === false) return
  const activeAdmins = listActiveStaffProfiles().filter((p) => p.role === 'admin')
  if (activeAdmins.length <= 1) {
    throw new Error(LAST_ADMIN_ERROR)
  }
}

/** Soft-delete : désactive un profil personnalisé (conservé pour l’historique). */
export function deactivateStaffProfile(profileId: string): void {
  assertNotLastActiveAdmin(profileId)
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
export async function deleteStaffProfile(profileId: string): Promise<void> {
  if (isBuiltinProfileId(profileId)) {
    throw new Error('Les profils de démonstration ne peuvent pas être supprimés.')
  }
  assertNotLastActiveAdmin(profileId)
  const previousCustom = readCustomProfiles()
  const previousCloud = readCloudStaffProfiles()
  const previousDeleted = readDeletedStaffIds()
  const custom = previousCustom.filter((p) => p.id !== profileId)
  writeCustomProfiles(custom)
  const cloud = previousCloud.filter((p) => p.id !== profileId)
  writeCloudStaffProfiles(cloud)
  const overrides = readPasswordOverrides()
  if (overrides[profileId]) {
    delete overrides[profileId]
    writePasswordOverrides(overrides)
  }
  rememberDeletedStaffId(profileId)
  try {
    await pushStaffToServer('delete', { profileId })
  } catch (error) {
    if (isRemoteStaffGoneError(error)) return
    writeCustomProfiles(previousCustom)
    writeCloudStaffProfiles(previousCloud)
    writeDeletedStaffIds(previousDeleted)
    throw error instanceof StaffCloudSyncError
      ? error
      : new StaffCloudSyncError(
          error instanceof Error
            ? error.message
            : 'Impossible de supprimer l’utilisateur sur le serveur.',
        )
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
