import { describe, expect, it } from 'vitest'
import { readStoredWaveLinks } from './paymentProviderSettings.js'

describe('readStoredWaveLinks', () => {
  it('lit un lien générique historique', () => {
    const stored = readStoredWaveLinks({
      wavePaymentLink: 'https://pay.wave.com/m/M_ci_legacy',
    })
    expect(stored.fallback).toBe('https://pay.wave.com/m/M_ci_legacy')
    expect(stored.links.starter).toBeNull()
  })

  it('lit un lien par formule', () => {
    const stored = readStoredWaveLinks({
      wavePaymentLinks: {
        starter: 'https://pay.wave.com/m/M_ci_starter',
        pro: 'https://pay.wave.com/m/M_ci_pro',
        business: 'https://pay.wave.com/m/M_ci_biz',
      },
    })
    expect(stored.links.starter).toBe('https://pay.wave.com/m/M_ci_starter')
    expect(stored.links.pro).toBe('https://pay.wave.com/m/M_ci_pro')
    expect(stored.links.business).toBe('https://pay.wave.com/m/M_ci_biz')
  })
})
