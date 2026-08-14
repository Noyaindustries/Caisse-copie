import { prisma } from './prisma.js'

/** Prisma/Mongo : `revokedAt: null` n’inclut pas les docs où le champ est absent. */
export function isStaffNotRevoked(row: { revokedAt: Date | null }): boolean {
  return row.revokedAt == null
}

export async function listOrgStaffRecords(organizationId: string) {
  return prisma.staffMember.findMany({
    where: { organizationId },
    orderBy: { displayName: 'asc' },
  })
}

function normalizeProfileId(profileId: string): string {
  try {
    return decodeURIComponent(profileId)
  } catch {
    return profileId
  }
}

export function matchesStaffProfileId(
  row: { profileId: string },
  profileId: string,
): boolean {
  const wanted = normalizeProfileId(profileId)
  return row.profileId === wanted || row.profileId === profileId
}

/**
 * Lookup par org puis filtre JS : un `findFirst` composé
 * (`organizationId` + `profileId`) rate parfois sur Mongo/Prisma.
 */
export async function findOrgStaffRecord(
  organizationId: string,
  profileId: string,
) {
  const rows = await listOrgStaffRecords(organizationId)
  return rows.find((row) => matchesStaffProfileId(row, profileId)) ?? null
}

export async function findOrgStaffMembers(organizationId: string) {
  const rows = await listOrgStaffRecords(organizationId)
  return rows.filter(isStaffNotRevoked)
}

export async function findOrgStaffByProfile(
  organizationId: string,
  profileId: string,
) {
  const row = await findOrgStaffRecord(organizationId, profileId)
  if (!row || !isStaffNotRevoked(row)) return null
  return row
}

export async function countActiveStaffMembers(
  organizationId: string,
): Promise<number> {
  const rows = await listOrgStaffRecords(organizationId)
  return rows.filter((row) => row.active !== false && isStaffNotRevoked(row)).length
}

export async function countActiveAdmins(
  organizationId: string,
): Promise<number> {
  const rows = await listOrgStaffRecords(organizationId)
  return rows.filter(
    (row) =>
      row.role === 'admin' && row.active !== false && isStaffNotRevoked(row),
  ).length
}
