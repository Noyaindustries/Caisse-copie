import type {
  MobileMoneyChannel,
  MobileMoneyChannelId,
  MobileMoneyPaymentRecord,
  PlanDefinition,
  PlanId,
  SubscriptionSnapshot,
} from './types'

const API_BASE = '/api'

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : `Erreur HTTP ${res.status}`,
    )
  }
  return data
}

export async function fetchPlans(): Promise<{
  plans: PlanDefinition[]
  trialDays: number
  stripeEnabled: boolean
  mobileMoneyEnabled: boolean
}> {
  const res = await fetch(`${API_BASE}/billing/plans`)
  return parseJson(res)
}

export async function fetchMobileMoneyChannels(): Promise<{
  channels: MobileMoneyChannel[]
  enabled: boolean
  demo: boolean
}> {
  const res = await fetch(`${API_BASE}/billing/mobile-money/channels`)
  return parseJson(res)
}

export async function startMobileMoneyCheckout(
  licenseKey: string,
  input: { planId: string; channelId: MobileMoneyChannelId; phone: string },
): Promise<{ transactionId: string; paymentUrl: string; demo: boolean }> {
  const res = await fetch(`${API_BASE}/billing/mobile-money/checkout`, {
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
    `${API_BASE}/billing/mobile-money/verify/${encodeURIComponent(transactionId)}`,
    { headers: { 'x-license-key': licenseKey } },
  )
  return parseJson(res)
}

export async function fetchPaymentHistory(
  licenseKey: string,
): Promise<{ payments: MobileMoneyPaymentRecord[] }> {
  const res = await fetch(`${API_BASE}/billing/payments/history`, {
    headers: { 'x-license-key': licenseKey },
  })
  return parseJson(res)
}

export async function updateBillingSettings(
  licenseKey: string,
  input: { billingPhone?: string; smsRemindersEnabled?: boolean },
): Promise<SubscriptionSnapshot> {
  const res = await fetch(`${API_BASE}/billing/settings`, {
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
  const res = await fetch(`${API_BASE}/billing/register`, {
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
  const res = await fetch(`${API_BASE}/billing/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await parseJson<Omit<SubscriptionSnapshot, 'cachedAt'>>(res)
  return { ...data, cachedAt: Date.now() }
}

export async function attachStoreCode(storeCode: string): Promise<SubscriptionSnapshot> {
  const res = await fetch(`${API_BASE}/billing/attach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeCode }),
  })
  const data = await parseJson<Omit<SubscriptionSnapshot, 'cachedAt'>>(res)
  return { ...data, cachedAt: Date.now() }
}

export async function refreshSubscription(
  licenseKey: string,
): Promise<SubscriptionSnapshot> {
  const res = await fetch(`${API_BASE}/billing/status`, {
    headers: { 'x-license-key': licenseKey },
  })
  const data = await parseJson<Omit<SubscriptionSnapshot, 'cachedAt'>>(res)
  return { ...data, cachedAt: Date.now() }
}

export async function startCheckout(
  licenseKey: string,
  planId: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/billing/checkout`, {
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
  const res = await fetch(`${API_BASE}/billing/portal`, {
    method: 'POST',
    headers: { 'x-license-key': licenseKey },
  })
  const data = await parseJson<{ url: string }>(res)
  return data.url
}
