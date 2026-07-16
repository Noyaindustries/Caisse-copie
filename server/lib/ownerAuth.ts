import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SALT_LEN = 16
const KEY_LEN = 64

/**
 * Canonicalise l’e-mail gérant : minuscules, trim,
 * et pour Gmail / Googlemail : ignore points + alias (+…) dans la partie locale.
 * Ex. jean.dupont+mag@gmail.com → jeandupont@gmail.com
 */
export function normalizeOwnerEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0) return trimmed

  let local = trimmed.slice(0, at)
  let domain = trimmed.slice(at + 1)

  if (domain === 'googlemail.com') {
    domain = 'gmail.com'
  }

  if (domain === 'gmail.com') {
    const plus = local.indexOf('+')
    if (plus >= 0) local = local.slice(0, plus)
    local = local.replace(/\./g, '')
  }

  return `${local}@${domain}`
}

export function isGmailAddress(email: string): boolean {
  const raw = email.trim().toLowerCase()
  if (!/^[a-z0-9._%+-]+@(gmail|googlemail)\.com$/.test(raw)) {
    return false
  }
  const normalized = normalizeOwnerEmail(email)
  return /^[a-z0-9]+@gmail\.com$/.test(normalized)
}

export function validateOwnerPassword(password: string): string | null {
  if (password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.'
  }
  if (password.length > 128) {
    return 'Le mot de passe est trop long.'
  }
  return null
}

export function hashOwnerPassword(password: string): string {
  const salt = randomBytes(SALT_LEN)
  const hash = scryptSync(password, salt, KEY_LEN)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyOwnerPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const actual = scryptSync(password, salt, KEY_LEN)
    if (expected.length !== actual.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
