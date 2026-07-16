import Stripe from 'stripe'

let stripeClient: Stripe | null | undefined

export function getStripe(): Stripe | null {
  if (stripeClient !== undefined) return stripeClient
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    stripeClient = null
    return null
  }
  stripeClient = new Stripe(key, {
    apiVersion: '2026-05-27.dahlia',
  })
  return stripeClient
}

export function stripeConfigured(): boolean {
  return getStripe() !== null
}

export function publicAppUrl(req?: { get: (name: string) => string | undefined }): string {
  const fromEnv = process.env.APP_URL?.trim()
  if (fromEnv) {
    const parsed = new URL(fromEnv)
    if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      throw new Error('APP_URL doit utiliser HTTPS en production.')
    }
    return parsed.origin
  }
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim()
  if (vercelHost) return `https://${vercelHost.replace(/^https?:\/\//, '')}`
  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_URL est obligatoire en production.')
  }
  if (req) {
    const host = req.get('x-forwarded-host') ?? req.get('host')
    const proto = req.get('x-forwarded-proto') ?? 'http'
    if (host) return `${proto}://${host}`
  }
  return 'http://localhost:5173'
}
