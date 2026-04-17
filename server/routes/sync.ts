import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { prisma } from '../lib/prisma.js'
import { syncBatchSchema } from '../validators/sync.js'

export const syncRouter = Router()

syncRouter.post('/caisseci/sync', async (req, res) => {
  try {
    const data = syncBatchSchema.parse(req.body)
    const source = req.header('x-source') ?? null
    const raw = data as unknown as Prisma.InputJsonValue

    await prisma.syncBatch.upsert({
      where: { batchId: data.batchId },
      update: {
        sentAt: new Date(data.sentAt),
        source,
        raw,
        status: 'received',
        error: null,
      },
      create: {
        batchId: data.batchId,
        sentAt: new Date(data.sentAt),
        source,
        raw,
        status: 'received',
        items: {
          create: data.items.map((item) => ({
            kind: item.kind,
            createdAt: new Date(item.createdAt),
            payload: item.payload as Prisma.InputJsonValue,
          })),
        },
      },
    })

    return res.status(200).json({
      ok: true,
      processed: data.items.length,
      batchId: data.batchId,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        ok: false,
        message: 'Payload de synchronisation invalide',
        issues: error.issues,
      })
    }

    console.error('[sync] erreur', error)
    return res.status(500).json({
      ok: false,
      message: 'Erreur serveur lors de la synchronisation',
    })
  }
})
