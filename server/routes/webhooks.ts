import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export const webhookRouter = Router()

webhookRouter.post('/webhooks/caisseci', async (req, res) => {
  try {
    const payload = req.body as Record<string, unknown>
    const eventType =
      typeof payload.type === 'string' ? payload.type : 'unknown'
    const externalId =
      typeof payload.id === 'string' ? payload.id : undefined

    const event = await prisma.webhookEvent.create({
      data: {
        source: 'caisseci',
        eventType,
        externalId,
        payload: payload as Prisma.InputJsonValue,
      },
    })

    return res.status(201).json({
      ok: true,
      webhookEventId: event.id,
    })
  } catch (error) {
    console.error('[webhook] erreur', error)
    return res.status(500).json({
      ok: false,
      message: 'Erreur serveur lors de la réception webhook',
    })
  }
})
