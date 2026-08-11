import { prisma } from './prisma.js'
import { PLAN_ORDER, type PlanId } from './subscriptionPlans.js'
import { normalizeWavePaymentLink } from './wavePaymentLink.js'

export type WavePlanLinks = Record<PlanId, string | null>
export type WavePlanLinkSources = Record<PlanId, 'db' | 'env' | 'none'>

const EMPTY_PLAN_LINKS: WavePlanLinks = {
  starter: null,
  pro: null,
  business: null,
}

const EMPTY_PLAN_LINK_SOURCES: WavePlanLinkSources = {
  starter: 'none',
  pro: 'none',
  business: 'none',
}

const ENV_WAVE_LINK_BY_PLAN: Record<PlanId, string> = {
  starter: 'WAVE_PAYMENT_LINK_STARTER',
  pro: 'WAVE_PAYMENT_LINK_PRO',
  business: 'WAVE_PAYMENT_LINK_BUSINESS',
}

function emptyPlanLinks(): WavePlanLinks {
  return { ...EMPTY_PLAN_LINKS }
}

function emptyPlanLinkSources(): WavePlanLinkSources {
  return { ...EMPTY_PLAN_LINK_SOURCES }
}

export type ResolvedPaymentSecrets = {
  waveApiKey: string | null
  waveWebhookSecret: string | null
  waveSigningSecret: string | null
  waveDemoMode: boolean
  /** Lien générique (repli si une formule n’a pas de lien dédié). */
  wavePaymentLink: string | null
  /** Lien Wave Business par formule d’abonnement. */
  wavePaymentLinks: WavePlanLinks
  cinetpayApiKey: string | null
  cinetpaySiteId: string | null
  cinetpayDemoMode: boolean
  /** Provenance pour l’admin (aide au diagnostic). */
  sources: {
    waveApiKey: 'db' | 'env' | 'none'
    waveWebhookSecret: 'db' | 'env' | 'none'
    waveSigningSecret: 'db' | 'env' | 'none'
    wavePaymentLink: 'db' | 'env' | 'none'
    wavePaymentLinks: WavePlanLinkSources
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
    paymentLink: string | null
    paymentLinkSet: boolean
    paymentLinks: WavePlanLinks
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
  wavePaymentLink?: string | null
  wavePaymentLinks?: Partial<WavePlanLinks>
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

function parseWaveLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    return normalizeWavePaymentLink(raw)
  } catch {
    return null
  }
}

function envWavePaymentLink(): string | null {
  return parseWaveLink(process.env.WAVE_PAYMENT_LINK)
}

function envWavePaymentLinks(): {
  links: WavePlanLinks
  sources: WavePlanLinkSources
} {
  const links = emptyPlanLinks()
  const sources = emptyPlanLinkSources()
  for (const planId of PLAN_ORDER) {
    const value = parseWaveLink(process.env[ENV_WAVE_LINK_BY_PLAN[planId]])
    links[planId] = value
    sources[planId] = value ? 'env' : 'none'
  }
  return { links, sources }
}

function resolveFromEnvOnly(): ResolvedPaymentSecrets {
  const waveApiKey = trimOrNull(process.env.WAVE_API_KEY)
  const waveWebhookSecret = trimOrNull(process.env.WAVE_WEBHOOK_SECRET)
  const waveSigningSecret = trimOrNull(process.env.WAVE_SIGNING_SECRET)
  const wavePaymentLink = envWavePaymentLink()
  const envLinks = envWavePaymentLinks()
  const cinetpayApiKey = trimOrNull(process.env.CINETPAY_API_KEY)
  const cinetpaySiteId = trimOrNull(process.env.CINETPAY_SITE_ID)
  const prod = process.env.NODE_ENV === 'production'

  return {
    waveApiKey,
    waveWebhookSecret,
    waveSigningSecret,
    waveDemoMode: prod ? false : envFlag('WAVE_DEMO_MODE'),
    wavePaymentLink,
    wavePaymentLinks: envLinks.links,
    cinetpayApiKey,
    cinetpaySiteId,
    cinetpayDemoMode: prod ? false : envFlag('CINETPAY_DEMO_MODE'),
    sources: {
      waveApiKey: waveApiKey ? 'env' : 'none',
      waveWebhookSecret: waveWebhookSecret ? 'env' : 'none',
      waveSigningSecret: waveSigningSecret ? 'env' : 'none',
      wavePaymentLink: wavePaymentLink ? 'env' : 'none',
      wavePaymentLinks: envLinks.sources,
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

const PAYMENT_CONFIG_COLLECTION = 'PlatformPaymentConfig'

type StoredWaveLinks = {
  fallback: string | null
  links: WavePlanLinks
}

export function readStoredWaveLinks(raw: unknown): StoredWaveLinks {
  const links = emptyPlanLinks()
  if (!raw || typeof raw !== 'object') {
    return { fallback: null, links }
  }
  const rec = raw as Record<string, unknown>
  const nested =
    rec.wavePaymentLinks && typeof rec.wavePaymentLinks === 'object'
      ? (rec.wavePaymentLinks as Record<string, unknown>)
      : null
  for (const planId of PLAN_ORDER) {
    const fromNested = nested ? parseWaveLink(nested[planId]) : null
    const fromFlat = parseWaveLink(
      rec[`wavePaymentLink${planId.charAt(0).toUpperCase()}${planId.slice(1)}`],
    )
    links[planId] = fromNested ?? fromFlat
  }
  return { fallback: parseWaveLink(rec.wavePaymentLink), links }
}

async function mongoReadWaveLinks(): Promise<StoredWaveLinks> {
  try {
    const raw = await prisma.$runCommandRaw({
      find: PAYMENT_CONFIG_COLLECTION,
      filter: { key: CONFIG_KEY },
      limit: 1,
    })
    const batch = (raw as { cursor?: { firstBatch?: unknown[] } }).cursor
      ?.firstBatch
    return readStoredWaveLinks(batch?.[0])
  } catch (err) {
    console.warn(
      '[payment-providers] Lecture liens Wave impossible :',
      err instanceof Error ? err.message : err,
    )
    return { fallback: null, links: emptyPlanLinks() }
  }
}

async function mongoWriteWaveLinks(next: {
  fallback?: string | null
  links?: WavePlanLinks
}): Promise<void> {
  const $set: {
    key: string
    wavePaymentLink?: string | null
    wavePaymentLinks?: WavePlanLinks
  } = { key: CONFIG_KEY }
  if (next.fallback !== undefined) $set.wavePaymentLink = next.fallback
  if (next.links !== undefined) $set.wavePaymentLinks = next.links
  await prisma.$runCommandRaw({
    update: PAYMENT_CONFIG_COLLECTION,
    updates: [
      {
        q: { key: CONFIG_KEY },
        u: { $set },
        upsert: true,
      },
    ],
  })
}

function mergeDbAndEnv(row: {
  waveApiKey: string | null
  waveWebhookSecret: string | null
  waveSigningSecret: string | null
  waveDemoMode: boolean
  cinetpayApiKey: string | null
  cinetpaySiteId: string | null
  cinetpayDemoMode: boolean
} | null, stored?: StoredWaveLinks): ResolvedPaymentSecrets {
  const env = resolveFromEnvOnly()
  const prod = process.env.NODE_ENV === 'production'

  const waveApiKey = pickSecret(row?.waveApiKey, env.waveApiKey)
  const waveWebhookSecret = pickSecret(row?.waveWebhookSecret, env.waveWebhookSecret)
  const waveSigningSecret = pickSecret(row?.waveSigningSecret, env.waveSigningSecret)
  const wavePaymentLink = pickSecret(stored?.fallback, env.wavePaymentLink)
  const cinetpayApiKey = pickSecret(row?.cinetpayApiKey, env.cinetpayApiKey)
  const cinetpaySiteId = pickSecret(row?.cinetpaySiteId, env.cinetpaySiteId)

  const wavePaymentLinks = emptyPlanLinks()
  const wavePaymentLinkSources = emptyPlanLinkSources()
  for (const planId of PLAN_ORDER) {
    const picked = pickSecret(stored?.links?.[planId], env.wavePaymentLinks[planId])
    wavePaymentLinks[planId] = picked.value
    wavePaymentLinkSources[planId] = picked.source
  }

  return {
    waveApiKey: waveApiKey.value,
    waveWebhookSecret: waveWebhookSecret.value,
    waveSigningSecret: waveSigningSecret.value,
    waveDemoMode: prod
      ? false
      : row
        ? row.waveDemoMode
        : env.waveDemoMode,
    wavePaymentLink: wavePaymentLink.value,
    wavePaymentLinks,
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
      wavePaymentLink: wavePaymentLink.source,
      wavePaymentLinks: wavePaymentLinkSources,
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
    const [row, storedLinks] = await Promise.all([
      prisma.platformPaymentConfig.findUnique({
        where: { key: CONFIG_KEY },
      }),
      mongoReadWaveLinks(),
    ])
    runtime = mergeDbAndEnv(row, storedLinks)
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

export function getWaveSubscriptionPaymentLink(planId?: PlanId): string | null {
  if (planId) {
    return runtime.wavePaymentLinks[planId] ?? runtime.wavePaymentLink
  }
  for (const id of PLAN_ORDER) {
    if (runtime.wavePaymentLinks[id]) return runtime.wavePaymentLinks[id]
  }
  return runtime.wavePaymentLink
}

export function waveSubscriptionPaymentLinkConfigured(planId?: PlanId): boolean {
  return Boolean(getWaveSubscriptionPaymentLink(planId))
}

export function getPaymentProvidersPublicStatus(): PaymentProvidersPublicStatus {
  const s = runtime
  const waveConfigured = Boolean(s.waveApiKey)
  const orangeConfigured = Boolean(s.cinetpayApiKey && s.cinetpaySiteId)
  const paymentLink = getWaveSubscriptionPaymentLink()
  const paymentLinks: WavePlanLinks = {
    starter: getWaveSubscriptionPaymentLink('starter'),
    pro: getWaveSubscriptionPaymentLink('pro'),
    business: getWaveSubscriptionPaymentLink('business'),
  }
  const anyPlanLink = PLAN_ORDER.some((id) => Boolean(paymentLinks[id]))
  const base = publicBaseUrl()

  return {
    wave: {
      configured: waveConfigured,
      demoMode: s.waveDemoMode,
      enabled: waveConfigured || s.waveDemoMode || anyPlanLink,
      apiKeyHint: maskSecret(s.waveApiKey),
      webhookSecretSet: Boolean(s.waveWebhookSecret),
      signingSecretSet: Boolean(s.waveSigningSecret),
      paymentLink,
      paymentLinkSet: anyPlanLink,
      paymentLinks,
      source: sourceSummary(
        s.sources.waveApiKey,
        s.sources.waveWebhookSecret,
        s.sources.waveSigningSecret,
        s.sources.wavePaymentLink,
        ...PLAN_ORDER.map((id) => s.sources.wavePaymentLinks[id]),
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

  const storedLinks = await mongoReadWaveLinks()
  const nextLinks: WavePlanLinks = { ...storedLinks.links }
  let writeLinks = false
  if (input.wavePaymentLinks) {
    for (const planId of PLAN_ORDER) {
      if (input.wavePaymentLinks[planId] === undefined) continue
      nextLinks[planId] = normalizeWavePaymentLink(input.wavePaymentLinks[planId])
      writeLinks = true
    }
  }
  const nextFallback =
    input.wavePaymentLink === undefined
      ? undefined
      : normalizeWavePaymentLink(input.wavePaymentLink)
  if (writeLinks || nextFallback !== undefined) {
    await mongoWriteWaveLinks({
      fallback: nextFallback,
      links: writeLinks ? nextLinks : undefined,
    })
  }

  hydratePromise = null
  await refreshPaymentProviderSettings()
  return getPaymentProvidersPublicStatus()
}
