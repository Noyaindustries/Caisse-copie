export type PlanId = 'starter' | 'pro' | 'business'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'

export type PlanDefinition = {
  id: PlanId
  name: string
  description: string
  priceFcfa: number
  maxStores: number
  maxStaff: number
  features: string[]
}

export type SubscriptionSnapshot = {
  organizationId: string
  name: string
  email: string
  licenseKey: string
  sessionToken?: string
  storeCode: string | null
  planId: PlanId
  plan: PlanDefinition
  status: SubscriptionStatus
  usable: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  stripeEnabled: boolean
  mobileMoneyEnabled: boolean
  billingPhone: string | null
  smsRemindersEnabled: boolean
  cachedAt: number
}

export type MobileMoneyPaymentRecord = {
  id: string
  transactionId: string
  planId: PlanId
  planName: string
  channel: string
  channelLabel: string
  amountFcfa: number
  customerPhone: string
  status: string
  paymentMethod: string | null
  paidAt: string | null
  createdAt: string
}

export type MobileMoneyChannelId =
  | 'orange_money'
  | 'wave'
  | 'mtn_momo'
  | 'moov'

export type MobileMoneyChannel = {
  id: MobileMoneyChannelId
  label: string
  description: string
  prefixes: string[]
  provider?: 'wave' | 'cinetpay' | null
}

export type OrganizationCredentials = {
  licenseKey: string
  sessionToken?: string
  organizationId: string
  name: string
  storeCode?: string | null
}
