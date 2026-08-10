import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from './prisma.js'

export const catalogProductSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  priceTTC: z.number().int().min(0).max(1_000_000_000),
  purchasePriceTTC: z.number().int().min(0).max(1_000_000_000).optional(),
  category: z.string().min(1).max(80),
  barcode: z.string().max(64),
  lowStockThreshold: z.number().int().min(0).max(1_000_000),
  vatRatePct: z.number().min(0).max(100),
  imageUrl: z.string().max(2000).optional(),
  description: z.string().max(2000).optional(),
  highlights: z.array(z.string().max(200)).max(10).optional(),
  archived: z.boolean(),
  updatedAt: z.number().int().nonnegative(),
})

export const workspaceStoreSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  shortCode: z.string().min(1).max(20),
  sortOrder: z.number().int().min(0).max(10_000),
  updatedAt: z.number().int().nonnegative().optional(),
})

export const workspacePromotionSchema = z.object({
  id: z.string().min(1).max(80),
  code: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  discountPct: z.number().min(0).max(100),
  active: z.boolean(),
  startAt: z.number().int().nonnegative().optional(),
  endAt: z.number().int().nonnegative().optional(),
  minCartTTC: z.number().int().min(0).optional(),
  storeId: z.string().max(80).optional(),
  usageCount: z.number().int().min(0),
  maxUsage: z.number().int().min(0).optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export const workspaceDiningTableSchema = z.object({
  id: z.string().min(1).max(80),
  storeId: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  capacity: z.number().int().min(1).max(200),
  area: z.string().max(80).optional(),
  status: z.enum(['free', 'occupied', 'reserved', 'cleaning']),
  occupiedSince: z.number().int().nonnegative().optional(),
  note: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).max(10_000),
  updatedAt: z.number().int().nonnegative().optional(),
})

export const workspaceKitchenIngredientSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  unit: z.enum(['kg', 'g', 'l', 'ml', 'piece']),
  lowStockThreshold: z.number().min(0).max(1_000_000),
  productId: z.string().max(80).optional(),
  archived: z.boolean().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
})

export const workspaceRecipeIngredientSchema = z.object({
  id: z.string().min(1).max(80),
  productId: z.string().min(1).max(80),
  ingredientId: z.string().min(1).max(80),
  qtyPerUnit: z.number().positive().max(1_000_000),
})

export type CatalogProductDto = z.infer<typeof catalogProductSchema>
export type WorkspaceStoreDto = z.infer<typeof workspaceStoreSchema>
export type WorkspacePromotionDto = z.infer<typeof workspacePromotionSchema>
export type WorkspaceDiningTableDto = z.infer<typeof workspaceDiningTableSchema>
export type WorkspaceKitchenIngredientDto = z.infer<
  typeof workspaceKitchenIngredientSchema
>
export type WorkspaceRecipeIngredientDto = z.infer<
  typeof workspaceRecipeIngredientSchema
>

export type WorkspaceCatalogDto = {
  products: CatalogProductDto[]
  stores: WorkspaceStoreDto[]
  promotions: WorkspacePromotionDto[]
  diningTables: WorkspaceDiningTableDto[]
  kitchenIngredients: WorkspaceKitchenIngredientDto[]
  productRecipes: WorkspaceRecipeIngredientDto[]
  updatedAt: number
}

function asConfigObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) }
  }
  return {}
}

function parseArray<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  max: number,
): T[] {
  if (!Array.isArray(raw)) return []
  const out: T[] = []
  for (const item of raw) {
    if (out.length >= max) break
    const parsed = schema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export function readWorkspaceCatalogFromConfig(
  config: Record<string, unknown>,
): WorkspaceCatalogDto {
  const updatedAt =
    typeof config.workspaceCatalogUpdatedAt === 'number' &&
    Number.isFinite(config.workspaceCatalogUpdatedAt)
      ? config.workspaceCatalogUpdatedAt
      : 0
  return {
    products: parseArray(config.catalogProducts, catalogProductSchema, 5_000),
    stores: parseArray(config.workspaceStores, workspaceStoreSchema, 200),
    promotions: parseArray(
      config.workspacePromotions,
      workspacePromotionSchema,
      500,
    ),
    diningTables: parseArray(
      config.workspaceDiningTables,
      workspaceDiningTableSchema,
      500,
    ),
    kitchenIngredients: parseArray(
      config.workspaceKitchenIngredients,
      workspaceKitchenIngredientSchema,
      2_000,
    ),
    productRecipes: parseArray(
      config.workspaceProductRecipes,
      workspaceRecipeIngredientSchema,
      10_000,
    ),
    updatedAt,
  }
}

export async function getOrgWorkspaceCatalog(
  organizationId: string,
): Promise<WorkspaceCatalogDto> {
  const row = await prisma.orgIntegration.findUnique({
    where: { organizationId },
  })
  return readWorkspaceCatalogFromConfig(asConfigObject(row?.config))
}

export async function saveOrgWorkspaceCatalog(
  organizationId: string,
  catalog: {
    products: CatalogProductDto[]
    stores: WorkspaceStoreDto[]
    promotions: WorkspacePromotionDto[]
    diningTables: WorkspaceDiningTableDto[]
    kitchenIngredients: WorkspaceKitchenIngredientDto[]
    productRecipes: WorkspaceRecipeIngredientDto[]
  },
): Promise<WorkspaceCatalogDto> {
  const products = parseArray(catalog.products, catalogProductSchema, 5_000)
  const stores = parseArray(catalog.stores, workspaceStoreSchema, 200)
  const promotions = parseArray(
    catalog.promotions,
    workspacePromotionSchema,
    500,
  )
  const diningTables = parseArray(
    catalog.diningTables,
    workspaceDiningTableSchema,
    500,
  )
  const kitchenIngredients = parseArray(
    catalog.kitchenIngredients,
    workspaceKitchenIngredientSchema,
    2_000,
  )
  const productRecipes = parseArray(
    catalog.productRecipes,
    workspaceRecipeIngredientSchema,
    10_000,
  )
  const updatedAt = Date.now()

  const existing = await prisma.orgIntegration.findUnique({
    where: { organizationId },
  })
  const prev = asConfigObject(existing?.config)
  const nextConfig = {
    ...prev,
    catalogProducts: products,
    workspaceStores: stores,
    workspacePromotions: promotions,
    workspaceDiningTables: diningTables,
    workspaceKitchenIngredients: kitchenIngredients,
    workspaceProductRecipes: productRecipes,
    workspaceCatalogUpdatedAt: updatedAt,
  } as Prisma.InputJsonValue

  await prisma.orgIntegration.upsert({
    where: { organizationId },
    update: { config: nextConfig },
    create: { organizationId, config: nextConfig },
  })

  return {
    products,
    stores,
    promotions,
    diningTables,
    kitchenIngredients,
    productRecipes,
    updatedAt,
  }
}

/** Clés métier du catalogue workspace à retirer lors d’un reset org. */
export const WORKSPACE_CATALOG_CONFIG_KEYS = [
  'catalogProducts',
  'workspaceStores',
  'workspacePromotions',
  'workspaceDiningTables',
  'workspaceKitchenIngredients',
  'workspaceProductRecipes',
  'workspaceCatalogUpdatedAt',
  'catalogCategories',
  'catalogCategoriesUpdatedAt',
] as const

export function stripWorkspaceCatalogFromConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...config }
  for (const key of WORKSPACE_CATALOG_CONFIG_KEYS) {
    delete next[key]
  }
  return next
}
