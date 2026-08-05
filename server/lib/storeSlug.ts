import { prisma } from './prisma.js'

const MAX_SLUG_LEN = 60

/**
 * Transforme un nom d’entreprise en segment d’URL lisible
 * (ex. "Restaurant Le Palmier" → "restaurant-le-palmier").
 */
export function slugifyStoreName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LEN)
  return base || 'boutique'
}

export function normalizeStoreSlug(input: string): string {
  return slugifyStoreName(input.trim())
}

function looksLikeStoreCode(raw: string): boolean {
  return /^MAG-?[A-Z0-9]+$/i.test(raw.trim().replace(/\s/g, ''))
}

/** Clé publique boutique : slug entreprise, sinon code MAG-XXXX (legacy). */
export function storefrontPublicKey(org: {
  storeSlug?: string | null
  storeCode?: string | null
}): string | null {
  const slug = org.storeSlug?.trim()
  if (slug) return slug
  const code = org.storeCode?.trim()
  return code || null
}

async function isSlugTaken(slug: string, excludeOrgId?: string): Promise<boolean> {
  const existing = await prisma.organization.findFirst({
    where: {
      storeSlug: slug,
      ...(excludeOrgId ? { NOT: { id: excludeOrgId } } : {}),
    },
    select: { id: true },
  })
  return Boolean(existing)
}

/**
 * Alloue un storeSlug unique à partir du nom (et éventuellement du code magasin).
 */
export async function allocateUniqueStoreSlug(
  name: string,
  opts?: { excludeOrgId?: string; storeCode?: string | null },
): Promise<string> {
  const base = slugifyStoreName(name)
  if (!(await isSlugTaken(base, opts?.excludeOrgId))) return base

  const codeSuffix = opts?.storeCode
    ?.replace(/^MAG-?/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (codeSuffix) {
    const withCode = `${base.slice(0, MAX_SLUG_LEN - codeSuffix.length - 1)}-${codeSuffix}`
    if (!(await isSlugTaken(withCode, opts?.excludeOrgId))) return withCode
  }

  for (let n = 2; n < 1000; n++) {
    const suffix = String(n)
    const candidate = `${base.slice(0, MAX_SLUG_LEN - suffix.length - 1)}-${suffix}`
    if (!(await isSlugTaken(candidate, opts?.excludeOrgId))) return candidate
  }

  throw new Error('Impossible de générer un identifiant boutique unique.')
}

export type OrgWithStorefrontKey = {
  id: string
  name: string
  storeCode: string
  storeSlug: string
}

/**
 * Garantit storeCode + storeSlug pour une organisation.
 * Le slug public remplace MAG-XXXX dans les URLs boutique.
 */
export async function ensureStorefrontIdentity(org: {
  id: string
  name: string
  storeCode?: string | null
  storeSlug?: string | null
}): Promise<OrgWithStorefrontKey> {
  let storeCode = org.storeCode?.trim() || null
  let storeSlug = org.storeSlug?.trim() || null

  const data: { storeCode?: string; storeSlug?: string } = {}

  if (!storeCode) {
    const { randomBytes } = await import('node:crypto')
    for (let attempt = 0; attempt < 12; attempt++) {
      const suffix = randomBytes(2).toString('hex').toUpperCase()
      const code = `MAG-${suffix}`
      const exists = await prisma.organization.findUnique({
        where: { storeCode: code },
        select: { id: true },
      })
      if (!exists) {
        storeCode = code
        data.storeCode = code
        break
      }
    }
    if (!storeCode) {
      throw new Error('Impossible de générer un code magasin unique.')
    }
  }

  if (!storeSlug) {
    storeSlug = await allocateUniqueStoreSlug(org.name, {
      excludeOrgId: org.id,
      storeCode,
    })
    data.storeSlug = storeSlug
  }

  if (Object.keys(data).length === 0) {
    return {
      id: org.id,
      name: org.name,
      storeCode,
      storeSlug,
    }
  }

  const updated = await prisma.organization.update({
    where: { id: org.id },
    data,
  })

  return {
    id: updated.id,
    name: updated.name,
    storeCode: updated.storeCode ?? storeCode,
    storeSlug: updated.storeSlug ?? storeSlug,
  }
}

/** Backfill storeSlug pour toutes les organisations sans slug. */
export async function backfillMissingStoreSlugs(): Promise<number> {
  // MongoDB : un champ absent n’est pas toujours matché par `{ storeSlug: null }`.
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, storeCode: true, storeSlug: true },
  })
  let updated = 0
  for (const org of orgs) {
    if (org.storeSlug?.trim()) continue
    await ensureStorefrontIdentity(org)
    updated += 1
  }
  return updated
}

export function isLegacyStoreCodeParam(raw: string): boolean {
  return looksLikeStoreCode(raw)
}
