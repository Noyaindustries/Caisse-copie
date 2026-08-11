import { describe, expect, it } from 'vitest'
import {
  normalizeWavePaymentLink,
  waveAndroidIntentUrl,
} from './wavePaymentLink.js'

describe('normalizeWavePaymentLink', () => {
  it('accepte un lien pay.wave.com', () => {
    expect(
      normalizeWavePaymentLink('https://pay.wave.com/m/M_ci_abc123'),
    ).toBe('https://pay.wave.com/m/M_ci_abc123')
  })

  it('retourne null si vide', () => {
    expect(normalizeWavePaymentLink('  ')).toBeNull()
    expect(normalizeWavePaymentLink(null)).toBeNull()
  })

  it('refuse un hôte tiers', () => {
    expect(() =>
      normalizeWavePaymentLink('https://example.com/pay'),
    ).toThrow(/Wave/)
  })

  it('refuse http', () => {
    expect(() =>
      normalizeWavePaymentLink('http://pay.wave.com/m/M_ci_x'),
    ).toThrow(/https/)
  })

  it('construit un intent Android vers l’app Wave', () => {
    const https = 'https://pay.wave.com/m/M_ci_abc123'
    const intent = waveAndroidIntentUrl(https)
    expect(intent).toContain('intent://pay.wave.com/m/M_ci_abc123')
    expect(intent).toContain('package=com.wave.personal')
    expect(intent).toContain('scheme=https')
    expect(intent).toContain(encodeURIComponent(https))
  })
})
