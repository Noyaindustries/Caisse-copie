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
const CHANGE_EVENT = 'caisseci-staff-profiles-changed'

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
    (v.password === undefined || typeof v.password === 'string')
  )
}

function readCustomProfiles(): StaffProfile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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
    const raw = localStorage.getItem(PASSWORD_OVERRIDES_KEY)
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function writePasswordOverrides(overrides: Record<string, string>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PASSWORD_OVERRIDES_KEY, JSON.stringify(overrides))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function listStaffProfiles(): StaffProfile[] {
  const overrides = readPasswordOverrides()
  return [...BUILTIN_STAFF_PROFILES, ...readCustomProfiles()].map((p) => ({
    ...p,
    password: overrides[p.id] ?? p.password,
  }))
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
  const all = listStaffProfiles()
  if (all.some((p) => p.pin === pin)) {
    throw new Error('Ce PIN est déjà utilisé par un autre profil.')
  }
  const created: StaffProfile = {
    id: `profile-custom-${crypto.randomUUID()}`,
    displayName,
    initials: computeInitials(displayName),
    role: input.role,
    ...(storeId ? { storeId } : {}),
    pin,
    ...(password ? { password } : {}),
  }
  const custom = readCustomProfiles()
  custom.push(created)
  writeCustomProfiles(custom)
  return created
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
