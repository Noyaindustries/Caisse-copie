import type { NextFunction, Request, Response } from 'express'
import type { Organization } from '@prisma/client'
import { prisma } from './prisma.js'
import { resolveOrgIdFromSessionToken } from './sessionTokens.js'
import { assertSubscriptionActive } from './quotaEnforcement.js'

type OrgWithStoreCode = Organization & { storeCode: string }

async function ensureStoreCode(org: Organization): Promise<OrgWithStoreCode> {
  if (org.storeCode) return { ...org, storeCode: org.storeCode }
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase()
  const storeCode = `MAG-${suffix}`
  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: { storeCode },
  })
  return { ...updated, storeCode: updated.storeCode ?? storeCode }
}

export function readBearerToken(req: Request): string | null {
  const auth = req.header('authorization')?.trim()
  if (!auth) return null
  const match = /^Bearer\s+(.+)$/i.exec(auth)
  return match?.[1]?.trim() ?? null
}

export function readLicenseKey(req: Request): string | null {
  return req.get('x-license-key')?.trim() ?? null
}

export async function resolveOrgFromRequest(
  req: Request,
): Promise<OrgWithStoreCode | null> {
  const bearer = readBearerToken(req)
  if (bearer) {
    const orgId = await resolveOrgIdFromSessionToken(bearer)
    if (orgId) {
      const org = await prisma.organization.findUnique({ where: { id: orgId } })
      if (org) return ensureStoreCode(org)
    }
  }

  const licenseKey = readLicenseKey(req)
  if (licenseKey) {
    const org = await prisma.organization.findUnique({ where: { licenseKey } })
    if (org) return ensureStoreCode(org)
  }

  return null
}

export async function requireOrg(
  req: Request,
  res: Response,
): Promise<OrgWithStoreCode | null> {
  const org = await resolveOrgFromRequest(req)
  if (!org) {
    res.status(401).json({ error: 'Authentification requise (session ou licence).' })
    return null
  }
  return org
}

export async function requireActiveOrg(
  req: Request,
  res: Response,
): Promise<OrgWithStoreCode | null> {
  const org = await requireOrg(req, res)
  if (!org) return null
  const blocked = assertSubscriptionActive(org)
  if (blocked) {
    res.status(402).json({ error: blocked })
    return null
  }
  return org
}

export function requireOrgMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void (async () => {
    const org = await requireOrg(req, res)
    if (!org) return
    ;(req as Request & { org: OrgWithStoreCode }).org = org
    next()
  })()
}

export function requireActiveOrgMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void (async () => {
    const org = await requireActiveOrg(req, res)
    if (!org) return
    ;(req as Request & { org: OrgWithStoreCode }).org = org
    next()
  })()
}
