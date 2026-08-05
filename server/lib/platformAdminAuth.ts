import type { NextFunction, Request, Response } from 'express'
import { safeCompareSecret } from './sessionTokens.js'

const HEADER = 'x-platform-admin-secret'

export function platformAdminConfigured(): boolean {
  return Boolean(process.env.PLATFORM_ADMIN_SECRET?.trim())
}

export function verifyPlatformAdminSecret(secret: string): boolean {
  const expected = process.env.PLATFORM_ADMIN_SECRET?.trim()
  if (!expected || !secret.trim()) return false
  return safeCompareSecret(secret.trim(), expected)
}

export function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!platformAdminConfigured()) {
    res.status(503).json({
      error: 'Administration plateforme non configurée (PLATFORM_ADMIN_SECRET manquant).',
    })
    return
  }

  const header = req.header(HEADER)
  const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '')
  const secret = header ?? bearer ?? ''

  if (!verifyPlatformAdminSecret(secret)) {
    res.status(401).json({ error: 'Accès refusé.' })
    return
  }

  next()
}
