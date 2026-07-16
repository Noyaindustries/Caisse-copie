import { describe, expect, it } from 'vitest'
import { calculateRenewalPeriodEnd } from './subscriptionActivation.js'
import { isSubscriptionUsable } from './subscriptionPlans.js'

const NOW = new Date('2026-07-16T12:00:00.000Z')

describe('isSubscriptionUsable', () => {
  it('refuse un essai expiré', () => {
    expect(
      isSubscriptionUsable(
        'trialing',
        null,
        new Date('2026-07-15T12:00:00.000Z'),
        NOW,
      ),
    ).toBe(false)
  })

  it('accepte un essai encore valide', () => {
    expect(
      isSubscriptionUsable(
        'trialing',
        null,
        new Date('2026-07-17T12:00:00.000Z'),
        NOW,
      ),
    ).toBe(true)
  })

  it('refuse un abonnement actif dont la période est terminée', () => {
    expect(
      isSubscriptionUsable(
        'active',
        new Date('2026-07-15T12:00:00.000Z'),
        null,
        NOW,
      ),
    ).toBe(false)
  })
})

describe('calculateRenewalPeriodEnd', () => {
  it('ajoute trente jours à la période encore disponible', () => {
    expect(
      calculateRenewalPeriodEnd(
        new Date('2026-07-26T12:00:00.000Z'),
        NOW,
      ).toISOString(),
    ).toBe('2026-08-25T12:00:00.000Z')
  })

  it('repart de maintenant lorsque la période est expirée', () => {
    expect(
      calculateRenewalPeriodEnd(
        new Date('2026-07-10T12:00:00.000Z'),
        NOW,
      ).toISOString(),
    ).toBe('2026-08-15T12:00:00.000Z')
  })
})
