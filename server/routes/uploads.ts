import { Router, type Request } from 'express'
import { z } from 'zod'
import {
  isBlobStorageConfigured,
  uploadOrganizationProductImage,
} from '../lib/blobStorage.js'
import { prisma } from '../lib/prisma.js'
import { requireOrg } from '../lib/orgAuth.js'

export const uploadsRouter = Router()

const productImageSchema = z.object({
  productId: z.string().min(1).max(120),
  dataUrl: z.string().min(1),
})

uploadsRouter.get('/uploads/status', (_req, res) => {
  res.json({ enabled: isBlobStorageConfigured() })
})

uploadsRouter.post('/uploads/product-image', async (req, res) => {
  try {
    if (!isBlobStorageConfigured()) {
      res.status(503).json({ error: 'Stockage Vercel Blob non configuré.' })
      return
    }

    const org = await requireOrg(req, res)
    if (!org) return

    const body = productImageSchema.parse(req.body)

    const url = await uploadOrganizationProductImage({
      organizationId: org.id,
      productId: body.productId,
      dataUrl: body.dataUrl,
    })

    res.status(201).json({ url })
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Corps de requête invalide.', issues: error.issues })
      return
    }
    const message = error instanceof Error ? error.message : 'Upload impossible.'
    const status = message.includes('non configuré') ? 503 : 400
    res.status(status).json({ error: message })
  }
})
