import { prisma } from './prisma.js'

export type ResolvedPaymentSecrets = {
  waveApiKey: string | null
  waveWebhookSecret: string | null
  waveSigningSecret: string | null
  waveDemoMode: boolean
  cinetpayApiKey: string | null
  cinetpaySiteId: string | null
  cinetpayDemoMode: boolean
  /** Provenance pour l’admin (aide au diagnostic). */
  sources: {
    waveApiKey: 'db' | 'env' | 'none'
    waveWebhookSecret: 'db' | 'env' | 'none'
    waveSigningSecret: 'db' | 'env' | 'none'
    cinetpayApiKey: 'db' | 'env' | 'none'
    cinetpaySiteId: 'db' | 'env' | 'none'
  }
}

export type PaymentProvidersPublicStatus = {
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
    /** Via CinetPay (canal ORANGE_MONEY). */
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

export type PaymentProvidersUpdateInput = {
  waveApiKey?: string | null
  waveWebhookSecret?: string | null
  waveSigningSecret?: string | null
  waveDemoMode?: boolean
  cinetpayApiKey?: string | null
  cinetpaySiteId?: string | null
  cinetpayDemoMode?: boolean
}

const CONFIG_KEY = 'default'

let runtime: ResolvedPaymentSecrets = resolveFromEnvOnly()
let hydratePromise: Promise<ResolvedPaymentSecrets> | null = null

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim()
  return t ? t : null
}

function envFlag(name: string): boolean {
  const v = process.env[name]
  return v === 'true' || v === '1'
}

function maskSecret(value: string | null): string | null {
  if (!value) return null
  if (value.length <= 4) return '••••'
  return `••••${value.slice(-4)}`
}

function resolveFromEnvOnly(): ResolvedPaymentSecrets {
  const waveApiKey = trimOrNull(process.env.WAVE_API_KEY)
  const waveWebhookSecret = trimOrNull(process.env.WAVE_WEBHOOK_SECRET)
  const waveSigningSecret = trimOrNull(process.env.WAVE_SIGNING_SECRET)
  const cinetpayApiKey = trimOrNull(process.env.CINETPAY_API_KEY)
  const cinetpaySiteId = trimOrNull(process.env.CINETPAY_SITE_ID)
  const prod = process.env.NODE_ENV === 'production'

  return {
    waveApiKey,
    waveWebhookSecret,
    waveSigningSecret,
    waveDemoMode: prod ? false : envFlag('WAVE_DEMO_MODE'),
    cinetpayApiKey,
    cinetpaySiteId,
    cinetpayDemoMode: prod ? false : envFlag('CINETPAY_DEMO_MODE'),
    sources: {
      waveApiKey: waveApiKey ? 'env' : 'none',
      waveWebhookSecret: waveWebhookSecret ? 'env' : 'none',
      waveSigningSecret: waveSigningSecret ? 'env' : 'none',
      cinetpayApiKey: cinetpayApiKey ? 'env' : 'none',
      cinetpaySiteId: cinetpaySiteId ? 'env' : 'none',
    },
  }
}

function pickSecret(
  dbValue: string | null | undefined,
  envValue: string | null,
): { value: string | null; source: 'db' | 'env' | 'none' } {
  const fromDb = trimOrNull(dbValue)
  if (fromDb) return { value: fromDb, source: 'db' }
  if (envValue) return { value: envValue, source: 'env' }
  return { value: null, source: 'none' }
}

function mergeDbAndEnv(row: {
  waveApiKey: string | null
  waveWebhookSecret: string | null
  waveSigningSecret: string | null
  waveDemoMode: boolean
  cinetpayApiKey: string | null
  cinetpaySiteId: string | null
  cinetpayDemoMode: boolean
} | null): ResolvedPaymentSecrets {
  const env = resolveFromEnvOnly()
  const prod = process.env.NODE_ENV === 'production'

  const waveApiKey = pickSecret(row?.waveApiKey, env.waveApiKey)
  const waveWebhookSecret = pickSecret(row?.waveWebhookSecret, env.waveWebhookSecret)
  const waveSigningSecret = pickSecret(row?.waveSigningSecret, env.waveSigningSecret)
  const cinetpayApiKey = pickSecret(row?.cinetpayApiKey, env.cinetpayApiKey)
  const cinetpaySiteId = pickSecret(row?.cinetpaySiteId, env.cinetpaySiteId)

  return {
    waveApiKey: waveApiKey.value,
    waveWebhookSecret: waveWebhookSecret.value,
    waveSigningSecret: waveSigningSecret.value,
    waveDemoMode: prod
      ? false
      : row
        ? row.waveDemoMode
        : env.waveDemoMode,
    cinetpayApiKey: cinetpayApiKey.value,
    cinetpaySiteId: cinetpaySiteId.value,
    cinetpayDemoMode: prod
      ? false
      : row
        ? row.cinetpayDemoMode
        : env.cinetpayDemoMode,
    sources: {
      waveApiKey: waveApiKey.source,
      waveWebhookSecret: waveWebhookSecret.source,
      waveSigningSecret: waveSigningSecret.source,
      cinetpayApiKey: cinetpayApiKey.source,
      cinetpaySiteId: cinetpaySiteId.source,
    },
  }
}

function sourceSummary(
  ...parts: Array<'db' | 'env' | 'none'>
): 'db' | 'env' | 'none' | 'mixed' {
  const set = new Set(parts.filter((p) => p !== 'none'))
  if (set.size === 0) return 'none'
  if (set.size === 1) return [...set][0]!
  return 'mixed'
}

function publicBaseUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:4000'
  ).replace(/\/$/, '')
}

/** Lecture synchrone du cache (env au boot, DB après refresh). */
export function getPaymentSecrets(): ResolvedPaymentSecrets {
  return runtime
}

/** Charge / recharge la config DB (idempotent, partagé entre requêtes). */
export async function ensurePaymentConfigReady(): Promise<ResolvedPaymentSecrets> {
  if (!hydratePromise) {
    hydratePromise = refreshPaymentProviderSettings().finally(() => {
      /* garder le cache ; un nouvel upsert invalide via refresh explicite */
    })
  }
  return hydratePromise
}

export async function refreshPaymentProviderSettings(): Promise<ResolvedPaymentSecrets> {
  try {
    const row = await prisma.platformPaymentConfig.findUnique({
      where: { key: CONFIG_KEY },
    })
    runtime = mergeDbAndEnv(row)
  } catch (err) {
    console.warn(
      '[payment-providers] Lecture DB impossible, repli sur .env :',
      err instanceof Error ? err.message : err,
    )
    runtime = resolveFromEnvOnly()
  }
  hydratePromise = Promise.resolve(runtime)
  return runtime
}

export function getPaymentProvidersPublicStatus(): PaymentProvidersPublicStatus {
  const s = runtime
  const waveConfigured = Boolean(s.waveApiKey)
  const orangeConfigured = Boolean(s.cinetpayApiKey && s.cinetpaySiteId)
  const base = publicBaseUrl()

  return {
    wave: {
      configured: waveConfigured,
      demoMode: s.waveDemoMode,
      enabled: waveConfigured || s.waveDemoMode,
      apiKeyHint: maskSecret(s.waveApiKey),
      webhookSecretSet: Boolean(s.waveWebhookSecret),
      signingSecretSet: Boolean(s.waveSigningSecret),
      source: sourceSummary(
        s.sources.waveApiKey,
        s.sources.waveWebhookSecret,
        s.sources.waveSigningSecret,
      ),
    },
    orangeMoney: {
      configured: orangeConfigured,
      demoMode: s.cinetpayDemoMode,
      enabled: orangeConfigured || s.cinetpayDemoMode,
      apiKeyHint: maskSecret(s.cinetpayApiKey),
      siteIdHint: maskSecret(s.cinetpaySiteId),
      source: sourceSummary(s.sources.cinetpayApiKey, s.sources.cinetpaySiteId),
    },
    webhookUrls: {
      wave: `${base}/api/billing/wave/webhook`,
      cinetpay: `${base}/api/billing/cinetpay/notify`,
    },
  }
}

/**
 * Met à jour la config admin.
 * - string non vide : remplace
 * - null : efface (repli .env éventuel)
 * - undefined : conserve la valeur DB actuelle
 */
export async function updatePaymentProviderSettings(
  input: PaymentProvidersUpdateInput,
): Promise<PaymentProvidersPublicStatus> {
  const existing = await prisma.platformPaymentConfig.findUnique({
    where: { key: CONFIG_KEY },
  })

  const next = {
    waveApiKey:
      input.waveApiKey === undefined
        ? existing?.waveApiKey ?? null
        : trimOrNull(input.waveApiKey),
    waveWebhookSecret:
      input.waveWebhookSecret === undefined
        ? existing?.waveWebhookSecret ?? null
        : trimOrNull(input.waveWebhookSecret),
    waveSigningSecret:
      input.waveSigningSecret === undefined
        ? existing?.waveSigningSecret ?? null
        : trimOrNull(input.waveSigningSecret),
    waveDemoMode:
      input.waveDemoMode === undefined
        ? (existing?.waveDemoMode ?? false)
        : Boolean(input.waveDemoMode) && process.env.NODE_ENV !== 'production',
    cinetpayApiKey:
      input.cinetpayApiKey === undefined
        ? existing?.cinetpayApiKey ?? null
        : trimOrNull(input.cinetpayApiKey),
    cinetpaySiteId:
      input.cinetpaySiteId === undefined
        ? existing?.cinetpaySiteId ?? null
        : trimOrNull(input.cinetpaySiteId),
    cinetpayDemoMode:
      input.cinetpayDemoMode === undefined
        ? (existing?.cinetpayDemoMode ?? false)
        : Boolean(input.cinetpayDemoMode) &&
          process.env.NODE_ENV !== 'production',
  }

  await prisma.platformPaymentConfig.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, ...next },
    update: next,
  })

  hydratePromise = null
  await refreshPaymentProviderSettings()
  return getPaymentProvidersPublicStatus()
}
