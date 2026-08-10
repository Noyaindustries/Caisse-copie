import { db } from '../db/db'
import type {
  CashOutflow,
  CrmInteraction,
  DayClosure,
  HrRequest,
  KitchenIngredientStock,
  LocationStock,
  LoyaltyCustomer,
  LoyaltyTransaction,
  RefundRecord,
  StockLocation,
  StockTransfer,
  TableReservation,
  TicketInvoice,
  TimePunch,
} from '../db/types'
import { apiUrl, isCloudApiConfigured } from './apiUrl'
import {
  getAppSettings,
  saveAppSettings,
  type AppSettings,
} from './appSettings'
import { parseApiResponse } from './parseApiResponse'
import { buildOrgAuthHeaders } from './subscription/authHeaders'
import { getOrganizationCredentials } from './subscription/store'

export type WorkspaceOpsCloud = {
  loyaltyCustomers: LoyaltyCustomer[]
  loyaltyTransactions: LoyaltyTransaction[]
  dayClosures: DayClosure[]
  cashOutflows: CashOutflow[]
  refunds: RefundRecord[]
  ticketInvoices: TicketInvoice[]
  tableReservations: TableReservation[]
  timePunches: TimePunch[]
  hrRequests: HrRequest[]
  crmInteractions: CrmInteraction[]
  kitchenIngredientStocks: KitchenIngredientStock[]
  stockLocations: StockLocation[]
  locationStocks: LocationStock[]
  stockTransfers: StockTransfer[]
  appSettings?: Partial<AppSettings>
  updatedAt: number
}

const APPLIED_AT_KEY = 'caisseci-workspace-ops-applied-at'

function canSyncCloud(): boolean {
  return Boolean(isCloudApiConfigured() && getOrganizationCredentials()?.licenseKey)
}

function getAppliedAt(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = localStorage.getItem(APPLIED_AT_KEY)
    const n = raw ? Number.parseInt(raw, 10) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function setAppliedAt(at: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(APPLIED_AT_KEY, String(at))
  } catch {
    /* ignore */
  }
}

function takeRecentByCreatedAt<T extends { createdAt: number }>(
  rows: T[],
  max: number,
): T[] {
  if (rows.length <= max) return rows
  return [...rows].sort((a, b) => b.createdAt - a.createdAt).slice(0, max)
}

export async function pushWorkspaceOpsToCloud(): Promise<boolean> {
  if (!canSyncCloud()) return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  try {
    const [
      loyaltyCustomers,
      loyaltyTransactions,
      dayClosures,
      cashOutflows,
      refunds,
      ticketInvoices,
      tableReservations,
      timePunches,
      hrRequests,
      crmInteractions,
      kitchenIngredientStocks,
      stockLocations,
      locationStocks,
      stockTransfers,
    ] = await Promise.all([
      db.loyaltyCustomers.toArray(),
      db.loyaltyTransactions.toArray(),
      db.dayClosures.toArray(),
      db.cashOutflows.toArray(),
      db.refunds.toArray(),
      db.ticketInvoices.toArray(),
      db.tableReservations.toArray(),
      db.timePunches.toArray(),
      db.hrRequests.toArray(),
      db.crmInteractions.toArray(),
      db.kitchenIngredientStocks.toArray(),
      db.stockLocations.toArray(),
      db.locationStocks.toArray(),
      db.stockTransfers.toArray(),
    ])

    const localHasOps =
      loyaltyCustomers.length +
        loyaltyTransactions.length +
        dayClosures.length +
        cashOutflows.length +
        refunds.length +
        ticketInvoices.length +
        tableReservations.length +
        timePunches.length +
        hrRequests.length +
        crmInteractions.length +
        kitchenIngredientStocks.length +
        stockLocations.length +
        locationStocks.length +
        stockTransfers.length >
      0

    if (!localHasOps && getAppliedAt() <= 0) {
      try {
        const probe = await fetch(apiUrl('/org/workspace-ops'), {
          headers: buildOrgAuthHeaders({ Accept: 'application/json' }),
        })
        if (probe.ok) {
          const remote = await parseApiResponse<WorkspaceOpsCloud>(probe)
          const remoteCount =
            (remote.loyaltyCustomers?.length ?? 0) +
            (remote.dayClosures?.length ?? 0) +
            (remote.ticketInvoices?.length ?? 0) +
            (remote.refunds?.length ?? 0) +
            (remote.timePunches?.length ?? 0) +
            (remote.hrRequests?.length ?? 0)
          if (remoteCount > 0) return false
        }
      } catch {
        return false
      }
    }

    const body = {
      loyaltyCustomers,
      loyaltyTransactions: takeRecentByCreatedAt(loyaltyTransactions, 10_000),
      dayClosures,
      cashOutflows: takeRecentByCreatedAt(cashOutflows, 5_000),
      refunds: takeRecentByCreatedAt(refunds, 5_000),
      ticketInvoices: takeRecentByCreatedAt(ticketInvoices, 3_000),
      tableReservations: takeRecentByCreatedAt(tableReservations, 3_000),
      timePunches: takeRecentByCreatedAt(timePunches, 10_000),
      hrRequests,
      crmInteractions: takeRecentByCreatedAt(crmInteractions, 5_000),
      kitchenIngredientStocks,
      stockLocations,
      locationStocks,
      stockTransfers: takeRecentByCreatedAt(stockTransfers, 5_000),
      appSettings: getAppSettings(),
    }

    const res = await fetch(apiUrl('/org/workspace-ops'), {
      method: 'PUT',
      headers: buildOrgAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify(body),
    })
    if (!res.ok) return false
    const data = await parseApiResponse<{ ok: boolean; updatedAt?: number }>(res)
    if (typeof data.updatedAt === 'number') setAppliedAt(data.updatedAt)
    return true
  } catch {
    return false
  }
}

let pushTimer: ReturnType<typeof setTimeout> | undefined

export function scheduleWorkspaceOpsPush(delayMs = 1_200): void {
  if (typeof window === 'undefined') return
  window.clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void pushWorkspaceOpsToCloud().catch(() => undefined)
  }, delayMs)
}

async function reconcileById<T extends { id: string }>(
  table: {
    toArray: () => Promise<T[]>
    bulkDelete: (ids: string[]) => Promise<void>
    put: (row: T) => Promise<string>
  },
  remote: T[] | undefined,
  authoritative: boolean,
): Promise<number> {
  if (!Array.isArray(remote)) return 0
  const remoteIds = new Set(remote.map((r) => r.id))
  if (authoritative) {
    const local = await table.toArray()
    const orphans = local.filter((r) => !remoteIds.has(r.id)).map((r) => r.id)
    if (orphans.length > 0) await table.bulkDelete(orphans)
  }
  let n = 0
  for (const row of remote) {
    if (!row?.id) continue
    await table.put(row)
    n += 1
  }
  return n
}

async function reconcileDayClosures(
  remote: DayClosure[] | undefined,
  authoritative: boolean,
): Promise<number> {
  if (!Array.isArray(remote)) return 0
  const remoteKeys = new Set(remote.map((r) => r.dateYmd))
  if (authoritative) {
    const local = await db.dayClosures.toArray()
    const orphans = local
      .filter((r) => !remoteKeys.has(r.dateYmd))
      .map((r) => r.dateYmd)
    if (orphans.length > 0) await db.dayClosures.bulkDelete(orphans)
  }
  let n = 0
  for (const row of remote) {
    if (!row?.dateYmd) continue
    await db.dayClosures.put(row)
    n += 1
  }
  return n
}

export async function mergeWorkspaceOpsFromCloud(
  remote: WorkspaceOpsCloud | null | undefined,
): Promise<number> {
  if (!remote) return 0
  const cloudAt = remote.updatedAt ?? 0
  const authoritative = cloudAt > getAppliedAt()
  let merged = 0

  merged += await reconcileById(
    db.loyaltyCustomers,
    remote.loyaltyCustomers,
    authoritative,
  )
  merged += await reconcileById(
    db.loyaltyTransactions,
    remote.loyaltyTransactions,
    authoritative,
  )
  merged += await reconcileDayClosures(remote.dayClosures, authoritative)
  merged += await reconcileById(db.cashOutflows, remote.cashOutflows, authoritative)
  merged += await reconcileById(db.refunds, remote.refunds, authoritative)
  merged += await reconcileById(
    db.ticketInvoices,
    remote.ticketInvoices,
    authoritative,
  )
  merged += await reconcileById(
    db.tableReservations,
    remote.tableReservations,
    authoritative,
  )
  merged += await reconcileById(db.timePunches, remote.timePunches, authoritative)
  merged += await reconcileById(db.hrRequests, remote.hrRequests, authoritative)
  merged += await reconcileById(
    db.crmInteractions,
    remote.crmInteractions,
    authoritative,
  )
  merged += await reconcileById(
    db.kitchenIngredientStocks,
    remote.kitchenIngredientStocks,
    authoritative,
  )
  merged += await reconcileById(
    db.stockLocations,
    remote.stockLocations,
    authoritative,
  )
  merged += await reconcileById(
    db.locationStocks,
    remote.locationStocks,
    authoritative,
  )
  merged += await reconcileById(
    db.stockTransfers,
    remote.stockTransfers,
    authoritative,
  )

  if (remote.appSettings && typeof remote.appSettings === 'object') {
    saveAppSettings(remote.appSettings as Partial<AppSettings>, {
      skipCloudPush: true,
    })
    merged += 1
  }

  if (cloudAt > 0) setAppliedAt(cloudAt)
  return merged
}
