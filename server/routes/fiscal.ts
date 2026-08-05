import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireOrg } from '../lib/orgAuth.js'
import { collectOrgSyncDeltas } from '../lib/syncMerge.js'

export const fiscalRouter = Router()

fiscalRouter.get('/org/fiscal/fec', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return

  const from =
    typeof req.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)
      ? req.query.from
      : null
  const to =
    typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)
      ? req.query.to
      : null
  if (!from || !to) {
    res.status(400).json({ error: 'Paramètres from et to requis (YYYY-MM-DD).' })
    return
  }

  const fromMs = new Date(`${from}T00:00:00`).getTime()
  const deltas = await collectOrgSyncDeltas(org.id, fromMs)

  res.json({
    format: 'FEC-CI-v1',
    organization: {
      id: org.id,
      name: org.name,
      nif: org.taxId ?? null,
    },
    period: { from, to },
    salesCount: deltas.sales.length,
    sales: deltas.sales,
  })
})

fiscalRouter.get('/org/fiscal/settings', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return
  res.json({
    taxId: org.taxId ?? null,
    fiscalRegime: org.fiscalRegime ?? 'REEL',
    fneEnabled: org.fneEnabled ?? false,
  })
})

fiscalRouter.patch('/org/fiscal/settings', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return

  const taxId =
    typeof req.body?.taxId === 'string' ? req.body.taxId.trim() || null : undefined
  const fiscalRegime =
    typeof req.body?.fiscalRegime === 'string'
      ? req.body.fiscalRegime.trim() || 'REEL'
      : undefined
  const fneEnabled =
    typeof req.body?.fneEnabled === 'boolean' ? req.body.fneEnabled : undefined

  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: {
      ...(taxId !== undefined ? { taxId } : {}),
      ...(fiscalRegime !== undefined ? { fiscalRegime } : {}),
      ...(fneEnabled !== undefined ? { fneEnabled } : {}),
    },
    select: { taxId: true, fiscalRegime: true, fneEnabled: true },
  })

  res.json(updated)
})
