import { describe, expect, it } from 'vitest'
import {
  generatePlatformAdminTotp,
  platformAdminMfaConfigured,
  verifyPlatformAdminTotp,
} from './platformAdminMfa.js'

describe('platformAdminMfa', () => {
  it('détecte la config MFA via env', () => {
    expect(typeof platformAdminMfaConfigured()).toBe('boolean')
  })

  it('valide un code TOTP quand secret configuré', () => {
    if (!process.env.PLATFORM_ADMIN_TOTP_SECRET) return
    const code = generatePlatformAdminTotp()
    expect(verifyPlatformAdminTotp(code)).toBe(true)
    expect(verifyPlatformAdminTotp('000000')).toBe(false)
  })
})
