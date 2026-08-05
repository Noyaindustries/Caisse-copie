import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SALT_LEN = 16
const KEY_LEN = 64

export function hashStaffPin(pin: string): string {
  const salt = randomBytes(SALT_LEN)
  const hash = scryptSync(pin, salt, KEY_LEN)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyStaffPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const actual = scryptSync(pin, salt, KEY_LEN)
    if (expected.length !== actual.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function hashStaffPassword(password: string): string {
  return hashStaffPin(password)
}

export function verifyStaffPassword(password: string, stored: string): boolean {
  return verifyStaffPin(password, stored)
}

export function validateStaffPin(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin.trim())) {
    return 'Le PIN doit contenir entre 4 et 8 chiffres.'
  }
  return null
}
