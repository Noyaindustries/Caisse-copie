import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from './prisma.js'

const TOKEN_PREFIX = 'cc_sess_'
const DEFAULT_TTL_DAYS = 30

function sessionTtlMs(): number {
  const days = Number.parseInt(process.env.SESSION_TTL_DAYS ?? '', 10)
  const value = Number.isFinite(days) && days > 0 ? days : DEFAULT_TTL_DAYS
  return value * 24 * 60 * 60 * 1000
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateSessionToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString('hex')}`
}

export async function createOrgSession(organizationId: string): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + sessionTtlMs())
  await prisma.orgSession.create({
    data: {
      organizationId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  })
  return token
}

export async function resolveOrgIdFromSessionToken(
  token: string,
): Promise<string | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null
  const row = await prisma.orgSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { organizationId: true, expiresAt: true, revokedAt: true },
  })
  if (!row || row.revokedAt) return null
  if (row.expiresAt.getTime() <= Date.now()) return null
  return row.organizationId
}

export async function revokeOrgSession(token: string): Promise<void> {
  if (!token.startsWith(TOKEN_PREFIX)) return
  await prisma.orgSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function revokeAllOrgSessions(organizationId: string): Promise<void> {
  await prisma.orgSession.updateMany({
    where: { organizationId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export function safeCompareSecret(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
