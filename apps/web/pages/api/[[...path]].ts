/**
 * Catch-all API Next.js — monte l’app Express sous /api/* sur Vercel.
 * En local (hors VERCEL), next.config réécrit /api vers :4000 avant cette route.
 *
 * Chemin : apps/web/pages/api → ../../../../server (racine monorepo).
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { app } from '../../../../server/app'

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
  maxDuration: 60,
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const segments = req.query.path
  if (segments) {
    const joined = Array.isArray(segments) ? segments.join('/') : String(segments)
    const searchIndex = req.url?.indexOf('?') ?? -1
    const search = searchIndex >= 0 ? req.url!.slice(searchIndex) : ''
    req.url = `/api/${joined}${search}`
  }
  return app(req, res)
}
