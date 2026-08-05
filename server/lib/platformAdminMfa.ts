import { generateSync, verifySync } from 'otplib'

export function platformAdminMfaConfigured(): boolean {
  return Boolean(process.env.PLATFORM_ADMIN_TOTP_SECRET?.trim())
}

export function verifyPlatformAdminTotp(code: string): boolean {
  const secret = process.env.PLATFORM_ADMIN_TOTP_SECRET?.trim()
  if (!secret || !code.trim()) return false
  try {
    return verifySync({ secret, token: code.trim(), epochTolerance: 1 }).valid
  } catch {
    return false
  }
}

export function generatePlatformAdminTotp(): string {
  const secret = process.env.PLATFORM_ADMIN_TOTP_SECRET?.trim()
  if (!secret) throw new Error('PLATFORM_ADMIN_TOTP_SECRET manquant.')
  return generateSync({ secret })
}
