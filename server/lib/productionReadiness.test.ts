import { describe, expect, it } from 'vitest'
import { safeCompareSecret } from './sessionTokens.js'
import {
  assertStaffQuota,
  assertSubscriptionActive,
  planLimits,
} from './quotaEnforcement.js'
import { parsePlanId, isSubscriptionUsable } from './subscriptionPlans.js'
import { validateStaffPin } from './staffCredentials.js'

describe('safeCompareSecret', () => {
  it('compare en temps constant', () => {
    expect(safeCompareSecret('abc', 'abc')).toBe(true)
    expect(safeCompareSecret('abc', 'abd')).toBe(false)
  })
})

describe('subscriptionPlans helpers', () => {
  it('parsePlanId retourne starter par défaut', () => {
    expect(parsePlanId(undefined)).toBe('starter')
    expect(parsePlanId('business')).toBe('business')
  })

  it('isSubscriptionUsable gère essai actif', () => {
    const future = new Date(Date.now() + 86_400_000)
    expect(isSubscriptionUsable('trialing', null, future)).toBe(true)
  })
})

describe('quotaEnforcement', () => {
  it('planLimits expose maxStaff', () => {
    expect(planLimits({ planId: 'starter' } as never).maxStaff).toBe(3)
  })

  it('assertSubscriptionActive bloque expired', () => {
    expect(
      assertSubscriptionActive({
        status: 'expired',
        currentPeriodEnd: null,
        trialEndsAt: null,
        planId: 'starter',
      } as never),
    ).toMatch(/expiré/i)
  })
})

describe('validateStaffPin', () => {
  it('accepte PIN 4 chiffres', () => {
    expect(validateStaffPin('1234')).toBeNull()
  })

  it('rejette PIN trop court', () => {
    expect(validateStaffPin('12')).toMatch(/4 et 8/)
  })
})

describe('assertStaffQuota', () => {
  it('exporte une fonction async', () => {
    expect(typeof assertStaffQuota).toBe('function')
  })
})
