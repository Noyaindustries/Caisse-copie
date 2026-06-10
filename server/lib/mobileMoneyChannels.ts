export type MobileMoneyChannelId =
  | 'orange_money'
  | 'wave'
  | 'mtn_momo'
  | 'moov'

export type MobileMoneyChannel = {
  id: MobileMoneyChannelId
  label: string
  description: string
  /** Code canal CinetPay (Côte d’Ivoire). */
  cinetpayCode: string
  prefixes: string[]
}

export const MOBILE_MONEY_CHANNELS_CI: MobileMoneyChannel[] = [
  {
    id: 'orange_money',
    label: 'Orange Money',
    description: 'Paiement via compte Orange Money',
    cinetpayCode: 'ORANGE_MONEY',
    prefixes: ['07'],
  },
  {
    id: 'wave',
    label: 'Wave',
    description: 'Paiement via portefeuille Wave',
    cinetpayCode: 'WAVE',
    prefixes: ['05', '01'],
  },
  {
    id: 'mtn_momo',
    label: 'MTN MoMo',
    description: 'Mobile Money MTN',
    cinetpayCode: 'MTN',
    prefixes: ['05'],
  },
  {
    id: 'moov',
    label: 'Moov Money',
    description: 'Paiement via Moov Money',
    cinetpayCode: 'MOOV',
    prefixes: ['01'],
  },
]

export function channelById(id: string): MobileMoneyChannel | null {
  return MOBILE_MONEY_CHANNELS_CI.find((c) => c.id === id) ?? null
}

/** Normalise un numéro ivoirien vers +225XXXXXXXXX */
export function normalizeCiPhone(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('225') && digits.length === 12) {
    return `+${digits}`
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return `+225${digits.slice(1)}`
  }
  if (digits.length === 9) {
    return `+225${digits}`
  }
  return null
}

export function splitCiPhone(e164: string): { prefix: string; number: string } {
  const digits = e164.replace(/\D/g, '')
  const local = digits.startsWith('225') ? digits.slice(3) : digits
  return {
    prefix: '225',
    number: local,
  }
}
