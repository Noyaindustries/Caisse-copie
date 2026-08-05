import type { PlanId, SubscriptionStatus } from '../subscription/types'
import { apiUrl } from '../apiUrl'
import { parseApiResponse } from '../parseApiResponse'
import {
  clearPlatformAdminSecret,
  getPlatformAdminSecret,
  setPlatformAdminSecret,
} from './session'

export type AdminOrganization = {
  id: string
  name: string
  email: string
  licenseKey: string
  storeCode: string | null
  planId: PlanId
  planName: string
  status: SubscriptionStatus
  usable: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  billingProvider: string | null
  billingPhone: string | null
  stripeSubId: string | null
  smsRemindersEnabled: boolean
  createdAt: string
  updatedAt: string
}

export type PlatformStats = {
  total: number
  byStatus: Record<string, number>
  byPlan: Record<string, number>
  recentSignups: number
  plans: Record<
    PlanId,
    {
      id: PlanId
      name: string
      priceFcfa: number
    }
  >
}

function adminHeaders(): HeadersInit {
  const secret = getPlatformAdminSecret()
  if (!secret) return { 'Content-Type': 'application/json' }
  return {
    'Content-Type': 'application/json',
    'X-Platform-Admin-Secret': secret,
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  return parseApiResponse<T>(res)
}

export async function fetchPlatformAdminStatus(): Promise<{
  configured: boolean
  mfaRequired?: boolean
}> {
  const res = await fetch(apiUrl('/platform-admin/status'))
  return parseJson(res)
}

export async function loginPlatformAdmin(secret: string, totpCode?: string): Promise<void> {
  const res = await fetch(apiUrl('/platform-admin/auth'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, totpCode: totpCode?.trim() || undefined }),
  })
  const data = await parseJson<{ ok: boolean; error?: string }>(res)
  if (!data.ok) throw new Error(data.error ?? 'Connexion refusée')
  setPlatformAdminSecret(secret)
}

export function logoutPlatformAdmin(): void {
  clearPlatformAdminSecret()
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const res = await fetch(apiUrl('/platform-admin/stats'), {
    headers: adminHeaders(),
  })
  return parseJson(res)
}

export async function fetchOrganizations(params?: {
  status?: string
  plan?: string
  q?: string
  limit?: number
}): Promise<{ organizations: AdminOrganization[]; count: number }> {
  const search = new URLSearchParams()
  if (params?.status) search.set('status', params.status)
  if (params?.plan) search.set('plan', params.plan)
  if (params?.q) search.set('q', params.q)
  if (params?.limit) search.set('limit', String(params.limit))
  const qs = search.toString()
  const res = await fetch(
    apiUrl(`/platform-admin/organizations${qs ? `?${qs}` : ''}`),
    { headers: adminHeaders() },
  )
  return parseJson(res)
}

export async function fetchOrganization(ref: string): Promise<AdminOrganization> {
  const res = await fetch(
    apiUrl(`/platform-admin/organizations/${encodeURIComponent(ref)}`),
    { headers: adminHeaders() },
  )
  const data = await parseJson<{ organization: AdminOrganization }>(res)
  return data.organization
}

export async function patchOrganization(
  ref: string,
  body: {
    planId?: PlanId
    status?: SubscriptionStatus
    activate?: { planId: PlanId; days?: number }
    extendTrialDays?: number
    extendPeriodDays?: number
    grantMobileMoney?: { planId: PlanId }
  },
): Promise<AdminOrganization> {
  const res = await fetch(
    apiUrl(`/platform-admin/organizations/${encodeURIComponent(ref)}`),
    {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify(body),
    },
  )
  const data = await parseJson<{ organization: AdminOrganization }>(res)
  return data.organization
}

export async function runPlatformReminders(organizationId?: string): Promise<{
  sent: number
  checked: number
}> {
  const res = await fetch(apiUrl('/platform-admin/reminders'), {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(organizationId ? { organizationId } : {}),
  })
  return parseJson(res)
}

export type PaymentProvidersStatus = {
  wave: {
    configured: boolean
    demoMode: boolean
    enabled: boolean
    apiKeyHint: string | null
    webhookSecretSet: boolean
    signingSecretSet: boolean
    source: 'db' | 'env' | 'none' | 'mixed'
  }
  orangeMoney: {
    configured: boolean
    demoMode: boolean
    enabled: boolean
    apiKeyHint: string | null
    siteIdHint: string | null
    source: 'db' | 'env' | 'none' | 'mixed'
  }
  webhookUrls: {
    wave: string
    cinetpay: string
  }
}

export type PaymentProvidersUpdateBody = {
  waveApiKey?: string | null
  waveWebhookSecret?: string | null
  waveSigningSecret?: string | null
  waveDemoMode?: boolean
  cinetpayApiKey?: string | null
  cinetpaySiteId?: string | null
  cinetpayDemoMode?: boolean
}

export async function fetchPaymentProviders(): Promise<PaymentProvidersStatus> {
  const res = await fetch(apiUrl('/platform-admin/payment-providers'), {
    headers: adminHeaders(),
  })
  return parseJson(res)
}

export async function savePaymentProviders(
  body: PaymentProvidersUpdateBody,
): Promise<PaymentProvidersStatus> {
  const res = await fetch(apiUrl('/platform-admin/payment-providers'), {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify(body),
  })
  return parseJson(res)
}
