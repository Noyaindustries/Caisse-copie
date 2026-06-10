import { randomBytes } from 'node:crypto'
import type { MobileMoneyChannelId } from './mobileMoneyChannels.js'
import { channelById, splitCiPhone } from './mobileMoneyChannels.js'

const CHECKOUT_URL = 'https://api-checkout.cinetpay.com/v2/payment'
const CHECK_URL = 'https://api-checkout.cinetpay.com/v2/payment/check'

export type CinetpayInitResult = {
  transactionId: string
  paymentToken: string | null
  paymentUrl: string
  demo: boolean
}

type CinetpayResponse<T> = {
  code: string
  message: string
  description?: string
  data?: T
}

export function cinetpayConfigured(): boolean {
  return Boolean(
    process.env.CINETPAY_API_KEY?.trim() && process.env.CINETPAY_SITE_ID?.trim(),
  )
}

export function cinetpayDemoMode(): boolean {
  return process.env.CINETPAY_DEMO_MODE === 'true' || process.env.CINETPAY_DEMO_MODE === '1'
}

export function mobileMoneyEnabled(): boolean {
  return cinetpayConfigured() || cinetpayDemoMode()
}

export function generateTransactionId(): string {
  const suffix = randomBytes(4).toString('hex').toUpperCase()
  return `CC${Date.now()}${suffix}`.slice(0, 30)
}

function apiKey(): string {
  const key = process.env.CINETPAY_API_KEY?.trim()
  if (!key) throw new Error('CINETPAY_API_KEY manquant')
  return key
}

function siteId(): string {
  const id = process.env.CINETPAY_SITE_ID?.trim()
  if (!id) throw new Error('CINETPAY_SITE_ID manquant')
  return id
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as T
  return data
}

export async function initCinetpayPayment(input: {
  transactionId: string
  amountFcfa: number
  description: string
  customerName: string
  customerEmail: string
  customerPhoneE164: string
  channelId: MobileMoneyChannelId
  notifyUrl: string
  returnUrl: string
  metadata: Record<string, string>
}): Promise<CinetpayInitResult> {
  if (cinetpayDemoMode() && !cinetpayConfigured()) {
    const base = process.env.APP_URL?.trim() || 'http://localhost:4000'
    return {
      transactionId: input.transactionId,
      paymentToken: null,
      paymentUrl: `${base}/api/billing/mobile-money/demo?transactionId=${encodeURIComponent(input.transactionId)}`,
      demo: true,
    }
  }

  const channel = channelById(input.channelId)
  const phone = splitCiPhone(input.customerPhoneE164)
  const nameParts = input.customerName.trim().split(/\s+/)
  const customerName = nameParts[0] ?? 'Client'
  const customerSurname = nameParts.slice(1).join(' ') || 'CaisseCI'

  const payload: Record<string, unknown> = {
    apikey: apiKey(),
    site_id: siteId(),
    transaction_id: input.transactionId,
    amount: input.amountFcfa,
    currency: 'XOF',
    description: input.description,
    customer_name: customerName,
    customer_surname: customerSurname,
    customer_email: input.customerEmail,
    customer_phone_number: phone.number,
    customer_address: 'Abidjan',
    customer_city: 'Abidjan',
    customer_country: 'CI',
    customer_state: 'CI',
    customer_zip_code: '00225',
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    channels: channel?.cinetpayCode ?? 'MOBILE_MONEY',
    lang: 'fr',
    metadata: JSON.stringify(input.metadata),
  }

  const response = await postJson<CinetpayResponse<{ payment_token?: string; payment_url?: string }>>(
    CHECKOUT_URL,
    payload,
  )

  if (response.code !== '201' || !response.data?.payment_url) {
    throw new Error(
      response.description || response.message || 'Initialisation CinetPay échouée',
    )
  }

  return {
    transactionId: input.transactionId,
    paymentToken: response.data.payment_token ?? null,
    paymentUrl: response.data.payment_url,
    demo: false,
  }
}

export type CinetpayCheckResult = {
  status: 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'UNKNOWN'
  amount: number | null
  operatorId: string | null
  paymentMethod: string | null
  raw: unknown
}

export async function checkCinetpayPayment(
  transactionId: string,
): Promise<CinetpayCheckResult> {
  if (cinetpayDemoMode() && !cinetpayConfigured()) {
    return {
      status: 'PENDING',
      amount: null,
      operatorId: null,
      paymentMethod: null,
      raw: { demo: true },
    }
  }

  const response = await postJson<
    CinetpayResponse<{
      status?: string
      amount?: number
      operator_id?: string
      payment_method?: string
    }>
  >(CHECK_URL, {
    apikey: apiKey(),
    site_id: siteId(),
    transaction_id: transactionId,
  })

  const statusRaw = (response.data?.status ?? '').toUpperCase()
  let status: CinetpayCheckResult['status'] = 'UNKNOWN'
  if (statusRaw === 'ACCEPTED') status = 'ACCEPTED'
  else if (statusRaw === 'REFUSED') status = 'REFUSED'
  else if (statusRaw === 'PENDING' || statusRaw === 'INITIATED') status = 'PENDING'

  return {
    status,
    amount: response.data?.amount ?? null,
    operatorId: response.data?.operator_id ?? null,
    paymentMethod: response.data?.payment_method ?? null,
    raw: response,
  }
}

export function parseNotifyStatus(body: Record<string, unknown>): {
  transactionId: string | null
  status: CinetpayCheckResult['status']
} {
  const transactionId =
    typeof body.cpm_trans_id === 'string'
      ? body.cpm_trans_id
      : typeof body.transaction_id === 'string'
        ? body.transaction_id
        : null

  const rawStatus = String(
    body.cpm_trans_status ?? body.cpm_result ?? body.status ?? '',
  ).toUpperCase()

  let status: CinetpayCheckResult['status'] = 'UNKNOWN'
  if (rawStatus.includes('ACCEPT') || rawStatus === '00' || rawStatus === 'SUCCES') {
    status = 'ACCEPTED'
  } else if (rawStatus.includes('REFUS') || rawStatus.includes('FAIL')) {
    status = 'REFUSED'
  } else if (rawStatus.includes('PEND') || rawStatus.includes('WAIT')) {
    status = 'PENDING'
  }

  return { transactionId, status }
}
