import type { StaffProfile } from './types'

/**
 * Profils démo — en production : API + politique mot de passe.
 * Connexion : même champ accepte le PIN ou le mot de passe si défini.
 */
export const STAFF_PROFILES: readonly StaffProfile[] = [
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

export function profileById(id: string): StaffProfile | undefined {
  return STAFF_PROFILES.find((p) => p.id === id)
}

export function roleLabel(role: StaffProfile['role']): string {
  if (role === 'admin') return 'Administrateur'
  if (role === 'gerant') return 'Gérant'
  return 'Caissier'
}
