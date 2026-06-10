import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SALT_LEN = 16
const KEY_LEN = 64

export function normalizeOwnerEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isGmailAddress(email: string): boolean {
  const normalized = normalizeOwnerEmail(email)
  return /^[a-z0-9._%+-]+@gmail\.com$/.test(normalized)
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
