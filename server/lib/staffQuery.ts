import { prisma } from './prisma.js'

/** Prisma/Mongo : `revokedAt: null` n’inclut pas les docs où le champ est absent. */
export function isStaffNotRevoked(row: { revokedAt: Date | null }): boolean {
  return row.revokedAt == null
}

export async function findOrgStaffMembers(organizationId: string) {
  const rows = await prisma.staffMember.findMany({
    where: { organizationId },
    orderBy: { displayName: 'asc' },
  })
  return rows.filter(isStaffNotRevoked)
}

export async function findOrgStaffByProfile(
  organizationId: string,
  profileId: string,
) {
  const row = await prisma.staffMember.findFirst({
    where: { organizationId, profileId },
  })
  if (!row || !isStaffNotRevoked(row)) return null
  return row
}

export async function countActiveStaffMembers(
  organizationId: string,
): Promise<number> {
  const rows = await prisma.staffMember.findMany({
    where: { organizationId, active: true },
    select: { revokedAt: true },
  })
  return rows.filter(isStaffNotRevoked).length
}
