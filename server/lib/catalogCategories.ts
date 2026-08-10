import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from './prisma.js'

export const catalogCategorySchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  sortOrder: z.number().int().min(0).max(10_000),
})

export type CatalogCategoryDto = z.infer<typeof catalogCategorySchema>

function asConfigObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) }
  }
  return {}
}

function parseCategories(raw: unknown): CatalogCategoryDto[] {
  if (!Array.isArray(raw)) return []
  const out: CatalogCategoryDto[] = []
  for (const item of raw) {
    const parsed = catalogCategorySchema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fr'))
}

export async function getOrgCatalogCategories(
  organizationId: string,
): Promise<CatalogCategoryDto[]> {
  const row = await prisma.orgIntegration.findUnique({
    where: { organizationId },
  })
  const config = asConfigObject(row?.config)
  return parseCategories(config.catalogCategories)
}

export async function saveOrgCatalogCategories(
  organizationId: string,
  categories: CatalogCategoryDto[],
): Promise<CatalogCategoryDto[]> {
  const normalized = parseCategories(categories)
  const existing = await prisma.orgIntegration.findUnique({
    where: { organizationId },
  })
  const prev = asConfigObject(existing?.config)
  const nextConfig = {
    ...prev,
    catalogCategories: normalized,
    catalogCategoriesUpdatedAt: Date.now(),
  } as Prisma.InputJsonValue

  await prisma.orgIntegration.upsert({
    where: { organizationId },
    update: { config: nextConfig },
    create: { organizationId, config: nextConfig },
  })
  return normalized
}
