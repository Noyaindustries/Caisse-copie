import { describe, expect, it } from 'vitest'
import { isGmailAddress, normalizeOwnerEmail } from './ownerAuth.js'

describe('normalizeOwnerEmail', () => {
  it('fusionne les points et alias Gmail', () => {
    expect(normalizeOwnerEmail(' Jean.Dupont+Boutique@Gmail.com ')).toBe(
      'jeandupont@gmail.com',
    )
  })

  it('normalise googlemail vers gmail', () => {
    expect(normalizeOwnerEmail('jean.dupont@googlemail.com')).toBe(
      'jeandupont@gmail.com',
    )
  })

  it('ne modifie pas la partie locale des autres domaines', () => {
    expect(normalizeOwnerEmail('Jean.Dupont+Tag@example.com')).toBe(
      'jean.dupont+tag@example.com',
    )
  })
})

describe('isGmailAddress', () => {
  it('accepte Gmail et Googlemail valides', () => {
    expect(isGmailAddress('client@gmail.com')).toBe(true)
    expect(isGmailAddress('client@googlemail.com')).toBe(true)
  })

  it('rejette les domaines et parties locales invalides', () => {
    expect(isGmailAddress('client@example.com')).toBe(false)
    expect(isGmailAddress('.+@gmail.com')).toBe(false)
  })
})
