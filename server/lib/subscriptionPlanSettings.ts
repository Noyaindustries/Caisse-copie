import { prisma } from './prisma.js'
import {
  MODULE_CATALOG,
  defaultMinPlanForModule,
  isPlanId,
  type ModuleCatalogEntry,
} from './modulePlanCatalog.js'
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
export type ModuleMinPlansMap = Record<string, PlanId>

export type AdminModuleRow = ModuleCatalogEntry & {
  minPlan: PlanId
}

export type SubscriptionPlansAdminStatus = {
  plans: PlanDefinition[]
  prices: SubscriptionPlanPrices
  defaults: SubscriptionPlanPrices
  source: 'db' | 'defaults'
  updatedAt: string | null
  modules: AdminModuleRow[]
  moduleMinPlans: ModuleMinPlansMap
  moduleDefaults: ModuleMinPlansMap
  modulesSource: 'db' | 'defaults'
}

type StoredPlanPricesDoc = {
  _id?: unknown
  key?: string
  starterPriceFcfa?: number | null
  proPriceFcfa?: number | null
  businessPriceFcfa?: number | null
  moduleMinPlans?: Record<string, unknown> | null
  updatedAt?: Date | string | null
  createdAt?: Date | string | null
}

/** Cache mémoire des min plans modules (serveur). */
let moduleMinPlanOverrides: ModuleMinPlansMap = {}

function defaultPrices(): SubscriptionPlanPrices {
  return {
    starter: SUBSCRIPTION_PLANS.starter.priceFcfa,
    pro: SUBSCRIPTION_PLANS.pro.priceFcfa,
    business: SUBSCRIPTION_PLANS.business.priceFcfa,
  }
}

function defaultModuleMinPlans(): ModuleMinPlansMap {
  const map: ModuleMinPlansMap = {}
  for (const entry of MODULE_CATALOG) {
    map[entry.id] = entry.defaultMinPlan
  }
  return map
}

function normalizePrice(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback
  }
  return Math.round(value)
}

function normalizeModuleMinPlans(
  raw: unknown,
): { map: ModuleMinPlansMap; hasStored: boolean } {
  const defaults = defaultModuleMinPlans()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { map: defaults, hasStored: false }
  }
  const input = raw as Record<string, unknown>
  const keys = Object.keys(input)
  if (keys.length === 0) {
    return { map: defaults, hasStored: false }
  }

  const map: ModuleMinPlansMap = { ...defaults }
  let applied = 0
  for (const [id, value] of Object.entries(input)) {
    if (!MODULE_CATALOG.some((m) => m.id === id)) continue
    if (!isPlanId(value)) continue
    map[id] = value
    applied += 1
  }
  return { map, hasStored: applied > 0 }
}

export function setModuleMinPlanOverrides(map: ModuleMinPlansMap): void {
  moduleMinPlanOverrides = { ...map }
}

export function resolveModuleMinPlans(): ModuleMinPlansMap {
  const defaults = defaultModuleMinPlans()
  return { ...defaults, ...moduleMinPlanOverrides }
}

export function resolveModuleMinPlan(moduleId: string): PlanId {
  return (
    moduleMinPlanOverrides[moduleId] ??
    defaultMinPlanForModule(moduleId)
  )
}

async function findStoredDoc(): Promise<StoredPlanPricesDoc | null> {
  try {
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

function applyDocToMemory(row: StoredPlanPricesDoc | null): {
  prices: SubscriptionPlanPrices
  modules: ModuleMinPlansMap
  modulesSource: 'db' | 'defaults'
} {
  const priceDefaults = defaultPrices()
  if (
    !row ||
    (row.starterPriceFcfa == null &&
      row.proPriceFcfa == null &&
      row.businessPriceFcfa == null)
  ) {
    setPlanPriceOverrides({})
  } else {
    const prices: SubscriptionPlanPrices = {
      starter: normalizePrice(row.starterPriceFcfa, priceDefaults.starter),
      pro: normalizePrice(row.proPriceFcfa, priceDefaults.pro),
      business: normalizePrice(row.businessPriceFcfa, priceDefaults.business),
    }
    setPlanPriceOverrides(prices)
  }

  const { map, hasStored } = normalizeModuleMinPlans(row?.moduleMinPlans)
  setModuleMinPlanOverrides(map)

  const resolved = resolvePlansRecord()
  return {
    prices: {
      starter: resolved.starter.priceFcfa,
      pro: resolved.pro.priceFcfa,
      business: resolved.business.priceFcfa,
    },
    modules: map,
    modulesSource: hasStored ? 'db' : 'defaults',
  }
}

export async function refreshSubscriptionPlanSettings(): Promise<SubscriptionPlanPrices> {
  try {
    const row = await findStoredDoc()
    return applyDocToMemory(row).prices
  } catch (error) {
    console.error('[subscriptionPlanSettings] refresh failed', error)
    setPlanPriceOverrides({})
    setModuleMinPlanOverrides(defaultModuleMinPlans())
    return defaultPrices()
  }
}

function buildAdminModules(moduleMinPlans: ModuleMinPlansMap): AdminModuleRow[] {
  return MODULE_CATALOG.map((entry) => ({
    ...entry,
    minPlan: moduleMinPlans[entry.id] ?? entry.defaultMinPlan,
  }))
}

export async function getSubscriptionPlansAdminStatus(): Promise<SubscriptionPlansAdminStatus> {
  const defaults = defaultPrices()
  const moduleDefaults = defaultModuleMinPlans()
  const row = await findStoredDoc()
  const applied = applyDocToMemory(row)
  const updatedAt =
    row?.updatedAt instanceof Date
      ? row.updatedAt.toISOString()
      : typeof row?.updatedAt === 'string'
        ? row.updatedAt
        : null
  return {
    plans: resolveAllPlans(),
    prices: applied.prices,
    defaults,
    source: row ? 'db' : 'defaults',
    updatedAt,
    modules: buildAdminModules(applied.modules),
    moduleMinPlans: applied.modules,
    moduleDefaults,
    modulesSource: applied.modulesSource,
  }
}

export type SubscriptionPlanPricesUpdate = Partial<SubscriptionPlanPrices> & {
  moduleMinPlans?: ModuleMinPlansMap
}

export async function updateSubscriptionPlanPrices(
  input: SubscriptionPlanPricesUpdate,
): Promise<SubscriptionPlansAdminStatus> {
  const defaults = defaultPrices()
  const existing = await findStoredDoc()

  const nextPrices = {
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
    ['Starter', nextPrices.starterPriceFcfa],
    ['Pro', nextPrices.proPriceFcfa],
    ['Business', nextPrices.businessPriceFcfa],
  ] as const) {
    if (value < 0 || value > 50_000_000) {
      throw new Error(`Prix ${label} invalide (0 – 50 000 000 FCFA).`)
    }
  }

  let nextModules: ModuleMinPlansMap
  if (input.moduleMinPlans) {
    const { map } = normalizeModuleMinPlans(input.moduleMinPlans)
    // Si l’admin envoie une map, on enregistre exactement les IDs catalogue
    // (tous les modules) pour une source de vérité claire.
    nextModules = map
    for (const entry of MODULE_CATALOG) {
      const requested = input.moduleMinPlans[entry.id]
      if (isPlanId(requested)) {
        nextModules[entry.id] = requested
      }
    }
  } else {
    nextModules = normalizeModuleMinPlans(existing?.moduleMinPlans).map
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
            ...nextPrices,
            moduleMinPlans: nextModules,
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
