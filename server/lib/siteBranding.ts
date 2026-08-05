import { z } from 'zod'
import { prisma } from './prisma.js'

const CONFIG_KEY = 'default'

/** Data URLs peuvent être volumineuses ; on limite comme pour la vitrine. */
export const siteBrandingLogoUrlSchema = z
  .string()
  .max(900_000)
  .refine(
    (v) =>
      v.startsWith('https://') ||
      v.startsWith('http://localhost') ||
      v.startsWith('data:image/'),
    { message: 'URL logo invalide' },
  )

export const siteBrandingUpdateSchema = z.object({
  logoUrl: z.union([siteBrandingLogoUrlSchema, z.null()]).optional(),
  brandName: z.union([z.string().trim().min(1).max(80), z.null()]).optional(),
})

export type SiteBrandingPublic = {
  logoUrl: string | null
  brandName: string | null
  updatedAt: string | null
}

export async function getSiteBranding(): Promise<SiteBrandingPublic> {
  const row = await prisma.platformSiteBranding.findUnique({
    where: { key: CONFIG_KEY },
  })
  if (!row) {
    return { logoUrl: null, brandName: null, updatedAt: null }
  }
  return {
    logoUrl: row.logoUrl?.trim() || null,
    brandName: row.brandName?.trim() || null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function updateSiteBranding(input: {
  logoUrl?: string | null
  brandName?: string | null
}): Promise<SiteBrandingPublic> {
  const data: { logoUrl?: string | null; brandName?: string | null } = {}
  if (input.logoUrl !== undefined) {
    data.logoUrl = input.logoUrl === null ? null : input.logoUrl.trim() || null
  }
  if (input.brandName !== undefined) {
    data.brandName =
      input.brandName === null ? null : input.brandName.trim() || null
  }

  const row = await prisma.platformSiteBranding.upsert({
    where: { key: CONFIG_KEY },
    create: {
      key: CONFIG_KEY,
      logoUrl: data.logoUrl ?? null,
      brandName: data.brandName ?? null,
    },
    update: data,
  })

  return {
    logoUrl: row.logoUrl?.trim() || null,
    brandName: row.brandName?.trim() || null,
    updatedAt: row.updatedAt.toISOString(),
  }
}
