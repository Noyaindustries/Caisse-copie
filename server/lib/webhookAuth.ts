import { timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

function secretsEqual(received: string, expected: string): boolean {
  const left = Buffer.from(received)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function requireWebhookToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.WEBHOOK_TOKEN?.trim()
  if (!expected) {
    res.status(503).json({
      ok: false,
      message: 'Webhooks non configurés',
    })
    return
  }

  const received = req.header('x-webhook-token')?.trim() ?? ''
  if (!received || !secretsEqual(received, expected)) {
    res.status(401).json({
      ok: false,
      message: 'Webhook non autorisé',
    })
    return
  }

  next()
}
