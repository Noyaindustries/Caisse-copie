import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from './prisma.js'

/** Schémas souples : validation structurelle, champs métier hors sync queue. */
const idStr = z.string().min(1).max(80)
const looseRecord = z.record(z.unknown())

export const workspaceOpsPayloadSchema = z.object({
  loyaltyCustomers: z.array(looseRecord).max(5_000).default([]),
  loyaltyTransactions: z.array(looseRecord).max(20_000).default([]),
  dayClosures: z.array(looseRecord).max(3_000).default([]),
  cashOutflows: z.array(looseRecord).max(10_000).default([]),
  refunds: z.array(looseRecord).max(10_000).default([]),
  ticketInvoices: z.array(looseRecord).max(5_000).default([]),
  tableReservations: z.array(looseRecord).max(5_000).default([]),
  timePunches: z.array(looseRecord).max(20_000).default([]),
  hrRequests: z.array(looseRecord).max(5_000).default([]),
  crmInteractions: z.array(looseRecord).max(10_000).default([]),
  kitchenIngredientStocks: z.array(looseRecord).max(10_000).default([]),
  stockLocations: z.array(looseRecord).max(1_000).default([]),
  locationStocks: z.array(looseRecord).max(50_000).default([]),
  stockTransfers: z.array(looseRecord).max(10_000).default([]),
  appSettings: looseRecord.optional(),
})

export type WorkspaceOpsDto = z.infer<typeof workspaceOpsPayloadSchema> & {
  updatedAt: number
}

function asConfigObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) }
  }
  return {}
}

function asArray(raw: unknown, max: number): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return []
  const out: Record<string, unknown>[] = []
  for (const item of raw) {
    if (out.length >= max) break
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const row = item as Record<string, unknown>
      if (typeof row.id === 'string' || typeof row.dateYmd === 'string') {
        out.push(row)
      }
    }
  }
  return out
}

export const WORKSPACE_OPS_CONFIG_KEYS = [
  'workspaceOps',
  'workspaceOpsUpdatedAt',
] as const

export function readWorkspaceOpsFromConfig(
  config: Record<string, unknown>,
): WorkspaceOpsDto {
  const raw =
    config.workspaceOps &&
    typeof config.workspaceOps === 'object' &&
    !Array.isArray(config.workspaceOps)
      ? (config.workspaceOps as Record<string, unknown>)
      : {}
  const updatedAt =
    typeof config.workspaceOpsUpdatedAt === 'number' &&
    Number.isFinite(config.workspaceOpsUpdatedAt)
      ? config.workspaceOpsUpdatedAt
      : 0
  return {
    loyaltyCustomers: asArray(raw.loyaltyCustomers, 5_000),
    loyaltyTransactions: asArray(raw.loyaltyTransactions, 20_000),
    dayClosures: asArray(raw.dayClosures, 3_000),
    cashOutflows: asArray(raw.cashOutflows, 10_000),
    refunds: asArray(raw.refunds, 10_000),
    ticketInvoices: asArray(raw.ticketInvoices, 5_000),
    tableReservations: asArray(raw.tableReservations, 5_000),
    timePunches: asArray(raw.timePunches, 20_000),
    hrRequests: asArray(raw.hrRequests, 5_000),
    crmInteractions: asArray(raw.crmInteractions, 10_000),
    kitchenIngredientStocks: asArray(raw.kitchenIngredientStocks, 10_000),
    stockLocations: asArray(raw.stockLocations, 1_000),
    locationStocks: asArray(raw.locationStocks, 50_000),
    stockTransfers: asArray(raw.stockTransfers, 10_000),
    appSettings:
      raw.appSettings &&
      typeof raw.appSettings === 'object' &&
      !Array.isArray(raw.appSettings)
        ? (raw.appSettings as Record<string, unknown>)
        : undefined,
    updatedAt,
  }
}

export async function getOrgWorkspaceOps(
  organizationId: string,
): Promise<WorkspaceOpsDto> {
  const row = await prisma.orgIntegration.findUnique({
    where: { organizationId },
  })
  return readWorkspaceOpsFromConfig(asConfigObject(row?.config))
}

export async function saveOrgWorkspaceOps(
  organizationId: string,
  payload: z.infer<typeof workspaceOpsPayloadSchema>,
): Promise<WorkspaceOpsDto> {
  const parsed = workspaceOpsPayloadSchema.parse(payload)
  const updatedAt = Date.now()
  const existing = await prisma.orgIntegration.findUnique({
    where: { organizationId },
  })
  const prev = asConfigObject(existing?.config)
  const nextConfig = {
    ...prev,
    workspaceOps: parsed,
    workspaceOpsUpdatedAt: updatedAt,
  } as Prisma.InputJsonValue

  await prisma.orgIntegration.upsert({
    where: { organizationId },
    update: { config: nextConfig },
    create: { organizationId, config: nextConfig },
  })

  return { ...parsed, updatedAt }
}

export function stripWorkspaceOpsFromConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...config }
  for (const key of WORKSPACE_OPS_CONFIG_KEYS) {
    delete next[key]
  }
  return next
}

/** Garde idStr exporté pour éventuelle validation stricte future. */
export { idStr }
