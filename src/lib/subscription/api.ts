import { apiUrl } from '../apiUrl'
import { parseApiResponse } from '../parseApiResponse'
import { buildOrgAuthHeaders } from './authHeaders'
import type {
  MobileMoneyChannel,
  MobileMoneyChannelId,
  MobileMoneyPaymentRecord,
  PlanDefinition,
  PlanId,
  SubscriptionSnapshot,
} from './types'

async function parseJson<T>(res: Response): Promise<T> {
  return parseApiResponse<T>(res)
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return buildOrgAuthHeaders({
    'Content-Type': 'application/json',
    ...extra,
  })
}

export async function fetchPlans(): Promise<{
  plans: PlanDefinition[]
  trialDays: number
  stripeEnabled: boolean
  mobileMoneyEnabled: boolean
}> {
  const res = await fetch(apiUrl('/billing/plans'), {
    signal: AbortSignal.timeout(8_000),
  })
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
    headers: authHeaders({ 'x-license-key': licenseKey }),
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
    { headers: authHeaders({ 'x-license-key': licenseKey }) },
  )
  return parseJson(res)
}

export async function fetchPaymentHistory(
  _licenseKey: string,
): Promise<{ payments: MobileMoneyPaymentRecord[] }> {
  const res = await fetch(apiUrl('/billing/payments/history'), {
    // `_licenseKey` est conservé dans la signature pour compat. avec l’appelant,
    // mais l’auth dépend principalement des crédentials stockées localement.
    headers: buildOrgAuthHeaders({ 'x-license-key': _licenseKey }),
  })
  return parseJson(res)
}

export async function updateBillingSettings(
  _licenseKey: string,
  input: { billingPhone?: string; smsRemindersEnabled?: boolean },
): Promise<SubscriptionSnapshot> {
  const res = await fetch(apiUrl('/billing/settings'), {
    method: 'PATCH',
    headers: authHeaders(),
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
  _licenseKey: string,
): Promise<SubscriptionSnapshot> {
  const res = await fetch(apiUrl('/billing/status'), {
    headers: buildOrgAuthHeaders({ 'x-license-key': _licenseKey }),
  })
  const data = await parseJson<Omit<SubscriptionSnapshot, 'cachedAt'>>(res)
  return { ...data, cachedAt: Date.now() }
}

export async function logoutOrganization(): Promise<void> {
  await fetch(apiUrl('/billing/logout'), {
    method: 'POST',
    headers: buildOrgAuthHeaders(),
  }).catch(() => undefined)
}

export async function startCheckout(
  _licenseKey: string,
  planId: string,
): Promise<string> {
  const res = await fetch(apiUrl('/billing/checkout'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ planId }),
  })
  const data = await parseJson<{ url: string | null }>(res)
  if (!data.url) throw new Error('URL de paiement indisponible.')
  return data.url
}

export async function openBillingPortal(_licenseKey: string): Promise<string> {
  const res = await fetch(apiUrl('/billing/portal'), {
    method: 'POST',
    headers: buildOrgAuthHeaders({ 'x-license-key': _licenseKey }),
  })
  const data = await parseJson<{ url: string }>(res)
  return data.url
}

export type OrgPaymentProvidersStatus = {
  wave: {
    configured: boolean
    demoMode: boolean
    enabled: boolean
    apiKeyHint: string | null
    webhookSecretSet: boolean
    signingSecretSet: boolean
  }
  orangeMoney: {
    configured: boolean
    demoMode: boolean
    enabled: boolean
    apiKeyHint: string | null
    siteIdHint: string | null
  }
  webhookUrls: {
    wave: string
    cinetpay: string
  }
}

export type OrgPaymentProvidersUpdateBody = {
  waveApiKey?: string | null
  waveWebhookSecret?: string | null
  waveSigningSecret?: string | null
  waveDemoMode?: boolean
  cinetpayApiKey?: string | null
  cinetpaySiteId?: string | null
  cinetpayDemoMode?: boolean
}

export async function fetchOrgPaymentProviders(
  _licenseKey: string,
): Promise<OrgPaymentProvidersStatus> {
  const res = await fetch(apiUrl('/billing/payment-providers'), {
    headers: buildOrgAuthHeaders({ 'x-license-key': _licenseKey }),
  })
  return parseJson(res)
}

export async function saveOrgPaymentProviders(
  _licenseKey: string,
  body: OrgPaymentProvidersUpdateBody,
): Promise<OrgPaymentProvidersStatus> {
  const res = await fetch(apiUrl('/billing/payment-providers'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return parseJson(res)
}
