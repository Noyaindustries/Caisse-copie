import { db } from '../db/db'
import type {
  DiningTable,
  KitchenIngredient,
  Product,
  ProductRecipeIngredient,
  Promotion,
  Store,
} from '../db/types'
import { apiUrl, isCloudApiConfigured } from './apiUrl'
import { parseApiResponse } from './parseApiResponse'
import { buildOrgAuthHeaders } from './subscription/authHeaders'
import { getOrganizationCredentials } from './subscription/store'

export type CatalogProductCloud = Omit<Product, 'imageDataUrl'> & {
  updatedAt: number
}

export type WorkspaceCatalogCloud = {
  products: CatalogProductCloud[]
  stores: Array<Store & { updatedAt?: number }>
  promotions: Promotion[]
  diningTables: Array<DiningTable & { updatedAt?: number }>
  kitchenIngredients: Array<KitchenIngredient & { updatedAt?: number }>
  productRecipes: ProductRecipeIngredient[]
  updatedAt: number
}

const APPLIED_AT_KEY = 'caisseci-workspace-catalog-applied-at'

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

/** Sérialise un produit pour le cloud (sans data-URL locale trop lourde). */
export function productToCloud(p: Product): CatalogProductCloud {
  const { imageDataUrl: _drop, ...rest } = p
  return {
    ...rest,
    updatedAt:
      typeof p.updatedAt === 'number' && Number.isFinite(p.updatedAt)
        ? p.updatedAt
        : Date.now(),
  }
}

export async function pushWorkspaceCatalogToCloud(): Promise<boolean> {
  if (!canSyncCloud()) return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  try {
    const [
      products,
      stores,
      promotions,
      diningTables,
      kitchenIngredients,
      productRecipes,
    ] = await Promise.all([
      db.products.toArray(),
      db.stores.toArray(),
      db.promotions.toArray(),
      db.diningTables.toArray(),
      db.kitchenIngredients.toArray(),
      db.productRecipeIngredients.toArray(),
    ])

    const localHasCatalog =
      products.length > 0 ||
      promotions.length > 0 ||
      diningTables.length > 0 ||
      kitchenIngredients.length > 0 ||
      productRecipes.length > 0 ||
      stores.length > 1

    // Nouveau terminal vide : ne pas écraser un catalogue cloud déjà rempli.
    // Si on a déjà synchronisé (appliedAt > 0), un snapshot vide peut propager des suppressions.
    if (!localHasCatalog && getAppliedAt() <= 0) {
      try {
        const probe = await fetch(apiUrl('/org/workspace-catalog'), {
          headers: buildOrgAuthHeaders({ Accept: 'application/json' }),
        })
        if (probe.ok) {
          const remote = await parseApiResponse<WorkspaceCatalogCloud>(probe)
          const remoteHas =
            (remote.products?.length ?? 0) > 0 ||
            (remote.promotions?.length ?? 0) > 0 ||
            (remote.diningTables?.length ?? 0) > 0 ||
            (remote.kitchenIngredients?.length ?? 0) > 0 ||
            (remote.productRecipes?.length ?? 0) > 0 ||
            (remote.stores?.length ?? 0) > 1
          if (remoteHas) return false
        }
      } catch {
        return false
      }
    }

    const body = {
      products: products.map(productToCloud),
      stores,
      promotions,
      diningTables,
      kitchenIngredients,
      productRecipes,
    }

    const res = await fetch(apiUrl('/org/workspace-catalog'), {
      method: 'PUT',
      headers: buildOrgAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify(body),
    })
    if (!res.ok) return false
    const data = await parseApiResponse<{ ok: boolean; updatedAt?: number }>(
      res,
    )
    if (typeof data.updatedAt === 'number') setAppliedAt(data.updatedAt)
    return true
  } catch {
    return false
  }
}

let pushTimer: ReturnType<typeof setTimeout> | undefined

/** Debounce : évite de saturer l’API à chaque frappe / import. */
export function scheduleWorkspaceCatalogPush(delayMs = 900): void {
  if (typeof window === 'undefined') return
  window.clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void pushWorkspaceCatalogToCloud().catch(() => undefined)
  }, delayMs)
}

function cloudProductToLocal(
  remote: CatalogProductCloud,
  local: Product | undefined,
): Product {
  const next: Product = {
    id: remote.id,
    name: remote.name,
    priceTTC: remote.priceTTC,
    category: remote.category,
    barcode: remote.barcode ?? '',
    lowStockThreshold: remote.lowStockThreshold,
    vatRatePct: remote.vatRatePct,
    archived: Boolean(remote.archived),
    updatedAt: remote.updatedAt,
  }
  if (remote.purchasePriceTTC !== undefined) {
    next.purchasePriceTTC = remote.purchasePriceTTC
  }
  if (remote.imageUrl) next.imageUrl = remote.imageUrl
  if (remote.description) next.description = remote.description
  if (remote.highlights?.length) next.highlights = remote.highlights
  // Conserver l’aperçu local si le cloud n’a que l’URL distante absente.
  if (local?.imageDataUrl && !next.imageUrl) {
    next.imageDataUrl = local.imageDataUrl
  } else if (local?.imageDataUrl && next.imageUrl === local.imageUrl) {
    next.imageDataUrl = local.imageDataUrl
  }
  return next
}

/**
 * Réconcilie le catalogue cloud → Dexie (snapshot LWW).
 * Si `updatedAt` cloud est plus récent que le dernier merge local, les
 * lignes absentes du snapshot sont purgées (suppression multi-poste).
 */
export async function mergeWorkspaceCatalogFromCloud(
  remote: WorkspaceCatalogCloud | null | undefined,
): Promise<{
  products: number
  stores: number
  promotions: number
  diningTables: number
  kitchen: number
}> {
  const empty = {
    products: 0,
    stores: 0,
    promotions: 0,
    diningTables: 0,
    kitchen: 0,
  }
  if (!remote) return empty

  const cloudAt = remote.updatedAt ?? 0
  const appliedAt = getAppliedAt()
  const authoritative = cloudAt > appliedAt

  let productsMerged = 0
  let storesMerged = 0
  let promotionsMerged = 0
  let diningMerged = 0
  let kitchenMerged = 0

  // —— Produits ——
  if (Array.isArray(remote.products)) {
    const remoteIds = new Set(remote.products.map((p) => p.id))
    if (authoritative && remote.products.length >= 0) {
      const local = await db.products.toArray()
      const orphans = local.filter((p) => !remoteIds.has(p.id)).map((p) => p.id)
      if (orphans.length > 0) await db.products.bulkDelete(orphans)
    }
    for (const r of remote.products) {
      const local = await db.products.get(r.id)
      const localAt =
        typeof local?.updatedAt === 'number' ? local.updatedAt : 0
      const remoteAt = typeof r.updatedAt === 'number' ? r.updatedAt : 0
      if (!local || remoteAt >= localAt || authoritative) {
        await db.products.put(cloudProductToLocal(r, local))
        productsMerged += 1
      }
    }
  }

  // —— Magasins ——
  if (Array.isArray(remote.stores) && remote.stores.length > 0) {
    const remoteIds = new Set(remote.stores.map((s) => s.id))
    if (authoritative) {
      const local = await db.stores.toArray()
      const orphans = local
        .filter((s) => !remoteIds.has(s.id))
        .map((s) => s.id)
      if (orphans.length > 0) await db.stores.bulkDelete(orphans)
    }
    for (const s of remote.stores) {
      await db.stores.put({
        id: s.id,
        name: s.name,
        shortCode: s.shortCode,
        sortOrder: s.sortOrder,
      })
      storesMerged += 1
    }
  }

  // —— Promotions ——
  if (Array.isArray(remote.promotions)) {
    const remoteIds = new Set(remote.promotions.map((p) => p.id))
    if (authoritative) {
      const local = await db.promotions.toArray()
      const orphans = local.filter((p) => !remoteIds.has(p.id)).map((p) => p.id)
      if (orphans.length > 0) await db.promotions.bulkDelete(orphans)
    }
    for (const p of remote.promotions) {
      const local = await db.promotions.get(p.id)
      const localAt = local?.updatedAt ?? 0
      const remoteAt = p.updatedAt ?? 0
      if (!local || remoteAt >= localAt || authoritative) {
        await db.promotions.put(p)
        promotionsMerged += 1
      }
    }
  }

  // —— Tables ——
  if (Array.isArray(remote.diningTables)) {
    const remoteIds = new Set(remote.diningTables.map((t) => t.id))
    if (authoritative) {
      const local = await db.diningTables.toArray()
      const orphans = local.filter((t) => !remoteIds.has(t.id)).map((t) => t.id)
      if (orphans.length > 0) await db.diningTables.bulkDelete(orphans)
    }
    for (const t of remote.diningTables) {
      const { updatedAt: _u, ...row } = t
      await db.diningTables.put(row)
      diningMerged += 1
    }
  }

  // —— Cuisine (définitions + recettes) ——
  if (Array.isArray(remote.kitchenIngredients)) {
    const remoteIds = new Set(remote.kitchenIngredients.map((i) => i.id))
    if (authoritative) {
      const local = await db.kitchenIngredients.toArray()
      const orphans = local.filter((i) => !remoteIds.has(i.id)).map((i) => i.id)
      if (orphans.length > 0) await db.kitchenIngredients.bulkDelete(orphans)
    }
    for (const i of remote.kitchenIngredients) {
      const { updatedAt: _u, ...row } = i
      await db.kitchenIngredients.put(row)
      kitchenMerged += 1
    }
  }
  if (Array.isArray(remote.productRecipes)) {
    const remoteIds = new Set(remote.productRecipes.map((r) => r.id))
    if (authoritative) {
      const local = await db.productRecipeIngredients.toArray()
      const orphans = local.filter((r) => !remoteIds.has(r.id)).map((r) => r.id)
      if (orphans.length > 0) {
        await db.productRecipeIngredients.bulkDelete(orphans)
      }
    }
    for (const r of remote.productRecipes) {
      await db.productRecipeIngredients.put(r)
      kitchenMerged += 1
    }
  }

  if (cloudAt > 0) setAppliedAt(cloudAt)

  return {
    products: productsMerged,
    stores: storesMerged,
    promotions: promotionsMerged,
    diningTables: diningMerged,
    kitchen: kitchenMerged,
  }
}
