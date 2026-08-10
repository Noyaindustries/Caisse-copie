import { db } from '../db/db'
import type { ProductCategoryRow } from '../db/types'
import { apiUrl, isCloudApiConfigured } from './apiUrl'
import { parseApiResponse } from './parseApiResponse'
import { buildOrgAuthHeaders } from './subscription/authHeaders'
import { getOrganizationCredentials } from './subscription/store'

export type CatalogCategoryCloud = {
  id: string
  name: string
  sortOrder: number
}

function canSyncCloud(): boolean {
  return Boolean(isCloudApiConfigured() && getOrganizationCredentials()?.licenseKey)
}

/** Envoie la liste locale des catégories vers le cloud (OrgIntegration). */
export async function pushCatalogCategoriesToCloud(): Promise<boolean> {
  if (!canSyncCloud()) return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  try {
    const rows = await db.productCategories.orderBy('sortOrder').toArray()
    const categories: CatalogCategoryCloud[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      sortOrder: r.sortOrder,
    }))
    const res = await fetch(apiUrl('/org/catalog-categories'), {
      method: 'PUT',
      headers: buildOrgAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify({ categories }),
    })
    if (!res.ok) return false
    await parseApiResponse<{ ok: boolean }>(res)
    return true
  } catch {
    return false
  }
}

/**
 * Fusionne les catégories cloud dans Dexie (union par nom, casse ignorée).
 * Les libellés cloud absents localement sont ajoutés.
 */
export async function mergeCatalogCategoriesFromCloud(
  remote: CatalogCategoryCloud[] | null | undefined,
): Promise<number> {
  if (!remote || remote.length === 0) return 0
  const local = await db.productCategories.toArray()
  const byLower = new Map(local.map((r) => [r.name.toLowerCase(), r]))
  let maxOrder = local.reduce((m, r) => Math.max(m, r.sortOrder), -1)
  const toAdd: ProductCategoryRow[] = []

  for (const item of remote) {
    const name = item.name.replace(/\s+/g, ' ').trim()
    if (!name || name.toLowerCase() === 'tous') continue
    const key = name.toLowerCase()
    if (byLower.has(key)) continue
    maxOrder += 1
    const row: ProductCategoryRow = {
      id: item.id || crypto.randomUUID(),
      name,
      sortOrder:
        typeof item.sortOrder === 'number' && Number.isFinite(item.sortOrder)
          ? item.sortOrder
          : maxOrder,
    }
    byLower.set(key, row)
    toAdd.push(row)
  }

  if (toAdd.length > 0) {
    await db.productCategories.bulkAdd(toAdd)
  }
  return toAdd.length
}

/** Tire les catégories cloud et les fusionne (appel ponctuel hors pull sync). */
export async function pullCatalogCategoriesFromCloud(): Promise<number> {
  if (!canSyncCloud()) return 0
  try {
    const res = await fetch(apiUrl('/org/catalog-categories'), {
      headers: buildOrgAuthHeaders({ Accept: 'application/json' }),
    })
    if (!res.ok) return 0
    const data = await parseApiResponse<{ categories?: CatalogCategoryCloud[] }>(
      res,
    )
    return mergeCatalogCategoriesFromCloud(data.categories)
  } catch {
    return 0
  }
}
