import { Router, type Response } from 'express'
import { ZodError, z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireActiveOrg, requireOrg } from '../lib/orgAuth.js'
import {
  assertStaffQuota,
  assertSubscriptionActive,
} from '../lib/quotaEnforcement.js'
import {
  hashStaffPassword,
  hashStaffPin,
  validateStaffPin,
  verifyStaffPin,
  verifyStaffPassword,
} from '../lib/staffCredentials.js'
import { logEvent } from '../lib/structuredLog.js'
import {
  countActiveAdmins,
  findOrgStaffByProfile,
  findOrgStaffMembers,
  findOrgStaffRecord,
} from '../lib/staffQuery.js'

const LAST_ADMIN_ERROR =
  'Impossible de supprimer ou désactiver le dernier administrateur. Créez-en un autre d’abord.'

export const staffRouter = Router()

const staffRoleSchema = z.enum(['admin', 'gerant', 'caissier', 'cuisinier'])

function serializeStaff(row: {
  profileId: string
  displayName: string
  initials: string
  role: string
  storeId: string | null
  active: boolean
  updatedAt: Date
}) {
  return {
    id: row.profileId,
    displayName: row.displayName,
    initials: row.initials,
    role: row.role,
    storeId: row.storeId,
    active: row.active,
    updatedAt: row.updatedAt.toISOString(),
  }
}

staffRouter.get('/org/staff', async (req, res) => {
  try {
    const org = await requireOrg(req, res)
    if (!org) return

    let rows = await findOrgStaffMembers(org.id)

    if (rows.length === 0) {
      const anyStaff = await prisma.staffMember.findFirst({
        where: { organizationId: org.id },
        select: { id: true },
      })
      // Ne recréer l’admin initial que si l’org n’a jamais eu de personnel.
      // Un owner supprimé (revokedAt) ne doit pas réapparaître.
      if (!anyStaff) {
        const { ensureOwnerStaffMember } = await import('../lib/ensureOwnerStaff.js')
        await ensureOwnerStaffMember(org)
        rows = await findOrgStaffMembers(org.id)
      }
    }

    res.setHeader('Cache-Control', 'no-store')
    res.json({
      staff: rows.map(serializeStaff),
      maxStaff: (await import('../lib/quotaEnforcement.js')).planLimits(org).maxStaff,
    })
  } catch (err) {
    console.error('[staff/list]', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Impossible de charger le personnel.' })
    }
  }
})

staffRouter.post('/org/staff', async (req, res) => {
  try {
    const org = await requireActiveOrg(req, res)
    if (!org) return

    const body = z
      .object({
        profileId: z.string().min(3).optional(),
        displayName: z.string().min(3),
        role: staffRoleSchema,
        storeId: z.string().optional(),
        pin: z.string(),
        password: z.string().optional(),
      })
      .parse(req.body)

    const pinError = validateStaffPin(body.pin)
    if (pinError) {
      res.status(400).json({ error: pinError })
      return
    }

    const profileId = body.profileId ?? `profile-${crypto.randomUUID()}`
    const existing = await findOrgStaffRecord(org.id, profileId)
    if (existing) {
      // Une autre caisse ne doit pas recréer un compte déjà supprimé.
      if (existing.revokedAt) {
        res.status(410).json({
          error: 'Cet utilisateur a été supprimé.',
          deleted: true,
        })
        return
      }
      if (existing.active === false) {
        const quotaError = await assertStaffQuota(org, 1)
        if (quotaError) {
          res.status(403).json({ error: quotaError })
          return
        }
      }
      const updated = await prisma.staffMember.update({
        where: { id: existing.id },
        data: {
          displayName: body.displayName.trim(),
          role: body.role,
          storeId: body.storeId?.trim() || null,
          pinHash: hashStaffPin(body.pin.trim()),
          passwordHash: body.password?.trim()
            ? hashStaffPassword(body.password.trim())
            : existing.passwordHash,
          active: true,
        },
      })
      res.json(serializeStaff(updated))
      return
    }

    const quotaError = await assertStaffQuota(org, 1)
    if (quotaError) {
      res.status(403).json({ error: quotaError })
      return
    }

    const initials = body.displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'NN'

    const created = await prisma.staffMember.create({
      data: {
        organizationId: org.id,
        profileId,
        displayName: body.displayName.trim(),
        initials,
        role: body.role,
        storeId: body.storeId?.trim() || null,
        pinHash: hashStaffPin(body.pin.trim()),
        passwordHash: body.password?.trim()
          ? hashStaffPassword(body.password.trim())
          : null,
        active: true,
        revokedAt: null,
      },
    })

    logEvent('info', 'staff.created', {
      organizationId: org.id,
      profileId: created.profileId,
    })

    res.status(201).json(serializeStaff(created))
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Données invalides.', issues: err.issues })
      return
    }
    if ((err as { code?: string }).code === 'P2002') {
      const org = await requireOrg(req, res)
      const profileId =
        typeof req.body?.profileId === 'string' ? req.body.profileId : null
      if (org && profileId) {
        const row = await findOrgStaffRecord(org.id, profileId)
        if (row) {
          if (row.revokedAt) {
            res.status(410).json({
              error: 'Cet utilisateur a été supprimé.',
              deleted: true,
            })
            return
          }
          res.json(serializeStaff(row))
          return
        }
      }
      res.status(409).json({ error: 'Utilisateur déjà enregistré.' })
      return
    }
    console.error('[staff/create]', err)
    res.status(500).json({ error: 'Impossible de créer l’utilisateur.' })
  }
})

staffRouter.patch('/org/staff/:profileId', async (req, res) => {
  try {
    const org = await requireActiveOrg(req, res)
    if (!org) return

    const profileId = req.params.profileId
    const existing = await findOrgStaffRecord(org.id, profileId)
    if (!existing || existing.revokedAt) {
      res.status(404).json({ error: 'Utilisateur introuvable.' })
      return
    }

    const body = z
      .object({
        displayName: z.string().min(3).optional(),
        role: staffRoleSchema.optional(),
        storeId: z.string().nullable().optional(),
        pin: z.string().optional(),
        password: z.string().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(req.body)

    if (
      (body.active === false || (body.role && body.role !== 'admin')) &&
      existing.role === 'admin' &&
      existing.active !== false
    ) {
      const adminCount = await countActiveAdmins(org.id)
      if (adminCount <= 1) {
        res.status(409).json({ error: LAST_ADMIN_ERROR })
        return
      }
    }

    if (body.active === true && !existing.active) {
      const quotaError = await assertStaffQuota(org, 1)
      if (quotaError) {
        res.status(403).json({ error: quotaError })
        return
      }
    }

    if (body.pin) {
      const pinError = validateStaffPin(body.pin)
      if (pinError) {
        res.status(400).json({ error: pinError })
        return
      }
    }

    const updated = await prisma.staffMember.update({
      where: { id: existing.id },
      data: {
        displayName: body.displayName?.trim(),
        role: body.role,
        storeId: body.storeId === undefined ? undefined : body.storeId?.trim() || null,
        pinHash: body.pin ? hashStaffPin(body.pin.trim()) : undefined,
        passwordHash:
          body.password === undefined
            ? undefined
            : body.password
              ? hashStaffPassword(body.password.trim())
              : null,
        active: body.active,
      },
    })

    res.json(serializeStaff(updated))
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Données invalides.' })
      return
    }
    console.error('[staff/patch]', err)
    res.status(500).json({ error: 'Impossible de mettre à jour l’utilisateur.' })
  }
})

async function revokeStaffMember(
  orgId: string,
  profileId: string,
  res: Response,
): Promise<void> {
  const existing = await findOrgStaffRecord(orgId, profileId)
  if (!existing || existing.revokedAt) {
    res.json({ ok: true, alreadyDeleted: true })
    return
  }

  if (existing.role === 'admin' && existing.active !== false) {
    const adminCount = await countActiveAdmins(orgId)
    if (adminCount <= 1) {
      res.status(409).json({ error: LAST_ADMIN_ERROR })
      return
    }
  }

  await prisma.staffMember.update({
    where: { id: existing.id },
    data: { active: false, revokedAt: new Date() },
  })

  res.json({ ok: true })
}

staffRouter.post('/org/staff/delete', async (req, res) => {
  try {
    const org = await requireActiveOrg(req, res)
    if (!org) return
    const body = z.object({ profileId: z.string().min(3) }).parse(req.body)
    await revokeStaffMember(org.id, body.profileId, res)
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Données invalides.' })
      return
    }
    console.error('[staff/delete]', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Impossible de supprimer l’utilisateur.' })
    }
  }
})

staffRouter.delete('/org/staff/:profileId', async (req, res) => {
  try {
    const org = await requireActiveOrg(req, res)
    if (!org) return
    await revokeStaffMember(org.id, req.params.profileId, res)
  } catch (err) {
    console.error('[staff/delete]', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Impossible de supprimer l’utilisateur.' })
    }
  }
})

staffRouter.post('/org/staff/verify', async (req, res) => {
  try {
    const org = await requireOrg(req, res)
    if (!org) return

    const blocked = assertSubscriptionActive(org)
    if (blocked) {
      res.status(402).json({ error: blocked })
      return
    }

    const body = z
      .object({
        profileId: z.string(),
        secret: z.string().min(1),
      })
      .parse(req.body)

    const member = await findOrgStaffByProfile(org.id, body.profileId)
    if (!member || member.active === false) {
      res.status(404).json({ error: 'Utilisateur introuvable.' })
      return
    }

    const secret = body.secret.trim()
    const ok =
      verifyStaffPin(secret, member.pinHash) ||
      (member.passwordHash ? verifyStaffPassword(secret, member.passwordHash) : false)

    if (!ok) {
      res.status(401).json({ ok: false, error: 'PIN ou mot de passe incorrect.' })
      return
    }

    res.json({
      ok: true,
      profile: serializeStaff(member),
    })
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Données invalides.' })
      return
    }
    res.status(500).json({ error: 'Vérification impossible.' })
  }
})
