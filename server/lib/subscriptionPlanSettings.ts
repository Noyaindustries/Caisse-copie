import { prisma } from './prisma.js'
import {
  SUBSCRIPTION_PLANS,
  resolveAllPlans,
  resolvePlansRecord,
  setPlanPriceOverrides,
  type PlanId,
  type PlanDefinition,
} from './subscriptionPlans.js'

const CONFIG_KEY = 'default'
const COLLECTION = 'PlatformSubscriptionPlans'

export type SubscriptionPlanPrices = Record<PlanId, number>

export type SubscriptionPlansAdminStatus = {
  plans: PlanDefinition[]
  prices: SubscriptionPlanPrices
  defaults: SubscriptionPlanPrices
  source: 'db' | 'defaults'
  updatedAt: string | null
}

type StoredPlanPricesDoc = {
  _id?: unknown
  key?: string
  starterPriceFcfa?: number | null
  proPriceFcfa?: number | null
  businessPriceFcfa?: number | null
  updatedAt?: Date | string | null
  createdAt?: Date | string | null
}

function defaultPrices(): SubscriptionPlanPrices {
  return {
    starter: SUBSCRIPTION_PLANS.starter.priceFcfa,
    pro: SUBSCRIPTION_PLANS.pro.priceFcfa,
    business: SUBSCRIPTION_PLANS.business.priceFcfa,
  }
}

function normalizePrice(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback
  }
  return Math.round(value)
}

async function findStoredDoc(): Promise<StoredPlanPricesDoc | null> {
  try {
    // Accès Mongo brut : évite d’exiger un prisma generate pendant que l’API tourne.
    const result = (await prisma.$runCommandRaw({
      find: COLLECTION,
      filter: { key: CONFIG_KEY },
      limit: 1,
    })) as { cursor?: { firstBatch?: StoredPlanPricesDoc[] } }
    const doc = result.cursor?.firstBatch?.[0]
    return doc ?? null
  } catch (error) {
    console.error('[subscriptionPlanSettings] find failed', error)
    return null
  }
}

export async function refreshSubscriptionPlanSettings(): Promise<SubscriptionPlanPrices> {
  const defaults = defaultPrices()
  try {
    const row = await findStoredDoc()
    if (
      !row ||
      (row.starterPriceFcfa == null &&
        row.proPriceFcfa == null &&
        row.businessPriceFcfa == null)
    ) {
      setPlanPriceOverrides({})
      return defaults
    }
    const prices: SubscriptionPlanPrices = {
      starter: normalizePrice(row.starterPriceFcfa, defaults.starter),
      pro: normalizePrice(row.proPriceFcfa, defaults.pro),
      business: normalizePrice(row.businessPriceFcfa, defaults.business),
    }
    setPlanPriceOverrides(prices)
    return prices
  } catch (error) {
    console.error('[subscriptionPlanSettings] refresh failed', error)
    setPlanPriceOverrides({})
    return defaults
  }
}

export async function getSubscriptionPlansAdminStatus(): Promise<SubscriptionPlansAdminStatus> {
  const defaults = defaultPrices()
  const row = await findStoredDoc()
  await refreshSubscriptionPlanSettings()
  const resolved = resolvePlansRecord()
  const updatedAt =
    row?.updatedAt instanceof Date
      ? row.updatedAt.toISOString()
      : typeof row?.updatedAt === 'string'
        ? row.updatedAt
        : null
  return {
    plans: resolveAllPlans(),
    prices: {
      starter: resolved.starter.priceFcfa,
      pro: resolved.pro.priceFcfa,
      business: resolved.business.priceFcfa,
    },
    defaults,
    source: row ? 'db' : 'defaults',
    updatedAt,
  }
}

export type SubscriptionPlanPricesUpdate = Partial<SubscriptionPlanPrices>

export async function updateSubscriptionPlanPrices(
  input: SubscriptionPlanPricesUpdate,
): Promise<SubscriptionPlansAdminStatus> {
  const defaults = defaultPrices()
  const existing = await findStoredDoc()

  const next = {
    starterPriceFcfa: normalizePrice(
      input.starter ?? existing?.starterPriceFcfa,
      defaults.starter,
    ),
    proPriceFcfa: normalizePrice(
      input.pro ?? existing?.proPriceFcfa,
      defaults.pro,
    ),
    businessPriceFcfa: normalizePrice(
      input.business ?? existing?.businessPriceFcfa,
      defaults.business,
    ),
  }

  for (const [label, value] of [
    ['Starter', next.starterPriceFcfa],
    ['Pro', next.proPriceFcfa],
    ['Business', next.businessPriceFcfa],
  ] as const) {
    if (value < 0 || value > 50_000_000) {
      throw new Error(`Prix ${label} invalide (0 – 50 000 000 FCFA).`)
    }
  }

  const now = new Date()
  await prisma.$runCommandRaw({
    update: COLLECTION,
    updates: [
      {
        q: { key: CONFIG_KEY },
        u: {
          $set: {
            key: CONFIG_KEY,
            ...next,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        upsert: true,
        multi: false,
      },
    ],
  })

  return getSubscriptionPlansAdminStatus()
}
