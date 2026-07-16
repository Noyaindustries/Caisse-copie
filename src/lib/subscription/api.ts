import type {
  MobileMoneyChannel,
  MobileMoneyChannelId,
  MobileMoneyPaymentRecord,
  PlanDefinition,
  PlanId,
  SubscriptionSnapshot,
} from './types'
import { apiUrl } from '../apiUrl'
import { parseApiResponse } from '../parseApiResponse'

async function parseJson<T>(res: Response): Promise<T> {
  return parseApiResponse<T>(res)
}

export async function fetchPlans(): Promise<{
  plans: PlanDefinition[]
  trialDays: number
  stripeEnabled: boolean
  mobileMoneyEnabled: boolean
}> {
  const res = await fetch(apiUrl('/billing/plans'))
  return parseJson(res)
}

export async function fetchMobileMoneyChannels(): Promise<{
  channels: MobileMoneyChannel[]
  enabled: boolean
  demo: boolean
  waveEnabled: boolean
  waveDirect: boolean
  cinetpayEnabled: boolean
}> {
  const res = await fetch(apiUrl('/billing/mobile-money/channels'))
  return parseJson(res)
}

export async function startMobileMoneyCheckout(
  licenseKey: string,
  input: { planId: string; channelId: MobileMoneyChannelId; phone: string },
): Promise<{
  transactionId: string
  paymentUrl: string
  demo: boolean
  provider?: 'wave' | 'cinetpay'
}> {
  const res = await fetch(apiUrl('/billing/mobile-money/checkout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-license-key': licenseKey,
    },
    body: JSON.stringify(input),
  })
  return parseJson(res)
}

export async function verifyMobileMoneyPayment(
  licenseKey: string,
  transactionId: string,
): Promise<{ status: 'accepted' | 'refused' | 'pending'; planId?: string }> {
  const res = await fetch(
    apiUrl(`/billing/mobile-money/verify/${encodeURIComponent(transactionId)}`),
    { headers: { 'x-license-key': licenseKey } },
  )
  return parseJson(res)
}

export async function fetchPaymentHistory(
  licenseKey: string,
): Promise<{ payments: MobileMoneyPaymentRecord[] }> {
  const res = await fetch(apiUrl('/billing/payments/history'), {
    headers: { 'x-license-key': licenseKey },
  })
  return parseJson(res)
}

export async function updateBillingSettings(
  licenseKey: string,
  input: { billingPhone?: string; smsRemindersEnabled?: boolean },
): Promise<SubscriptionSnapshot> {
  const res = await fetch(apiUrl('/billing/settings'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-license-key': licenseKey,
    },
    body: JSON.stringify(input),
  })
  const data = await parseJson<Omit<SubscriptionSnapshot, 'cachedAt'>>(res)
  return { ...data, cachedAt: Date.now() }
}

export async function registerOrganization(input: {
  name: string
  email: string
  password: string
  planId: PlanId
}): Promise<SubscriptionSnapshot> {
  const res = await fetch(apiUrl('/billing/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await parseJson<Omit<SubscriptionSnapshot, 'cachedAt'>>(res)
  return { ...data, cachedAt: Date.now() }
}

export async function loginOrganization(input: {
  email: string
  password: string
}): Promise<SubscriptionSnapshot> {
  const res = await fetch(apiUrl('/billing/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await parseJson<Omit<SubscriptionSnapshot, 'cachedAt'>>(res)
  return { ...data, cachedAt: Date.now() }
}

export async function attachStoreCode(
  storeCode: string,
  password: string,
): Promise<SubscriptionSnapshot> {
  const res = await fetch(apiUrl('/billing/attach'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeCode, password }),
  })
  const data = await parseJson<Omit<SubscriptionSnapshot, 'cachedAt'>>(res)
  return { ...data, cachedAt: Date.now() }
}

export async function refreshSubscription(
  licenseKey: string,
): Promise<SubscriptionSnapshot> {
  const res = await fetch(apiUrl('/billing/status'), {
    headers: { 'x-license-key': licenseKey },
  })
  const data = await parseJson<Omit<SubscriptionSnapshot, 'cachedAt'>>(res)
  return { ...data, cachedAt: Date.now() }
}

export async function startCheckout(
  licenseKey: string,
  planId: string,
): Promise<string> {
  const res = await fetch(apiUrl('/billing/checkout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-license-key': licenseKey,
    },
    body: JSON.stringify({ planId }),
  })
  const data = await parseJson<{ url: string | null }>(res)
  if (!data.url) throw new Error('URL de paiement indisponible.')
  return data.url
}

export async function openBillingPortal(licenseKey: string): Promise<string> {
  const res = await fetch(apiUrl('/billing/portal'), {
    method: 'POST',
    headers: { 'x-license-key': licenseKey },
  })
  const data = await parseJson<{ url: string }>(res)
  return data.url
}
