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
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (req) {
    const host = req.get('x-forwarded-host') ?? req.get('host')
    const proto = req.get('x-forwarded-proto') ?? 'http'
    if (host) return `${proto}://${host}`
  }
  return 'http://localhost:5173'
}
