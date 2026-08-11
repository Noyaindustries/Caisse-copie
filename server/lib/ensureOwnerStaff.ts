import type { Organization } from '@prisma/client'
import { prisma } from './prisma.js'
import { hashStaffPassword, hashStaffPin } from './staffCredentials.js'

export const OWNER_PROFILE_ID = 'profile-owner'
export const DEFAULT_OWNER_PIN = '1234'

function ownerInitials(name: string): string {
  const chunks = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (chunks.length === 0) return 'AD'
  if (chunks.length === 1) return chunks[0]!.slice(0, 2).toUpperCase()
  return `${chunks[0]![0] ?? ''}${chunks[1]![0] ?? ''}`.toUpperCase()
}

/**
 * Garantit un StaffMember admin pour l’organisation (inscription ou org sans personnel).
 */
export async function ensureOwnerStaffMember(
  org: Pick<Organization, 'id' | 'name'>,
  options?: { ownerPassword?: string },
): Promise<void> {
  const existingOwner = await prisma.staffMember.findFirst({
    where: { organizationId: org.id, profileId: OWNER_PROFILE_ID },
  })
  if (existingOwner) {
    if (existingOwner.revokedAt || existingOwner.active === false) {
      await prisma.staffMember.update({
        where: { id: existingOwner.id },
        data: { active: true, revokedAt: null },
      })
    }
    return
  }

  const anyActive = await prisma.staffMember.findFirst({
    where: { organizationId: org.id, revokedAt: null },
    select: { id: true },
  })
  if (anyActive) return

  const displayName =
    org.name.trim().length >= 3 ? org.name.trim().slice(0, 80) : 'Administrateur'

  try {
    await prisma.staffMember.create({
      data: {
        organizationId: org.id,
        profileId: OWNER_PROFILE_ID,
        displayName,
        initials: ownerInitials(displayName),
        role: 'admin',
        pinHash: hashStaffPin(DEFAULT_OWNER_PIN),
        passwordHash: options?.ownerPassword?.trim()
          ? hashStaffPassword(options.ownerPassword.trim())
          : null,
        active: true,
      },
    })
  } catch (err) {
    const code = (err as { code?: string }).code
    // Course : un autre GET a créé le même owner.
    if (code === 'P2002') return
    throw err
  }
}
