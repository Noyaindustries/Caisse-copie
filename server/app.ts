import 'dotenv/config'
import { initServerSentry } from './lib/sentry.js'

initServerSentry()

import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import morgan from 'morgan'
import { billingRouter, handleStripeWebhook } from './routes/billing.js'
import { storefrontRouter } from './routes/storefront.js'
import {
  handleCinetpayNotify,
  handleWaveWebhook,
  mobileMoneyRouter,
} from './routes/mobileMoney.js'
import { platformAdminRouter } from './routes/platformAdmin.js'
import { uploadsRouter } from './routes/uploads.js'
import { syncRouter } from './routes/sync.js'
import { staffRouter } from './routes/staff.js'
import { orgRouter } from './routes/org.js'
import { fiscalRouter } from './routes/fiscal.js'
import { webhookRouter } from './routes/webhooks.js'

export const app = express()

app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: false }))

const vercelOrigins = [
  process.env.VERCEL_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
].filter((value): value is string => Boolean(value))

const allowedOrigins = new Set(
  [
    process.env.APP_URL,
    process.env.NEXT_DEV_ORIGIN,
    ...vercelOrigins.map((host) => `https://${host}`),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter((value): value is string => Boolean(value)),
)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Origine CORS refusée'))
    },
  }),
)

const isProd = process.env.NODE_ENV === 'production'

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 600 : 5_000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip(req) {
    // Console /admin déjà protégée par secret (sauf /status public et /auth limité à part).
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? ''
    if (!path.startsWith('/api/platform-admin')) return false
    if (path === '/api/platform-admin/auth') return false
    return true
  },
})
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 120 : 1_000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 10 : 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

app.use('/api', apiLimiter)
app.use(
  [
    '/api/billing/register',
    '/api/billing/login',
    '/api/billing/attach',
    '/api/platform-admin/auth',
    '/api/webhooks',
  ],
  sensitiveLimiter,
)
app.use(['/api/caisseci/sync', '/api/caisseci/sync/pull'], syncLimiter)
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook,
)
app.post(
  '/api/billing/cinetpay/notify',
  express.urlencoded({ extended: true }),
  handleCinetpayNotify,
)
app.post('/api/billing/cinetpay/notify', express.json(), handleCinetpayNotify)
app.post(
  '/api/billing/wave/webhook',
  express.raw({ type: 'application/json' }),
  handleWaveWebhook,
)
// Logos / bannières en data URL (≤ 500 Ko fichier ≈ 0,7 Mo base64) + marge.
app.use(express.json({ limit: '4mb' }))
app.use(morgan('dev'))

import { prisma } from './lib/prisma.js'

const startedAt = Date.now()
const APP_VERSION = process.env.npm_package_version ?? '1.0.0'

async function healthHandler(
  _req: express.Request,
  res: express.Response,
): Promise<void> {
  let dbOk = false
  try {
    await prisma.organization.count({ take: 1 })
    dbOk = true
  } catch {
    dbOk = false
  }
  const ok = dbOk
  res.status(ok ? 200 : 503).json({
    ok,
    version: APP_VERSION,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    db: dbOk ? 'up' : 'down',
  })
}

app.get('/health', healthHandler)
/** Alias sous /api quand seul /api/* est routé vers Express (Vercel serverless). */
app.get('/api/health', healthHandler)

/** Chrome DevTools sonde cette URL tout seul — 204 pour éviter un 404 en console. */
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
  res.status(204).end()
})

/**
 * Un SW PWA (next-pwa) ou Chrome redemande /sw.js sur l’origine API (:4000)
 * après /api/billing/wave/open — ce n’est pas l’app Next. On se désinscrit.
 */
app.get('/sw.js', (_req, res) => {
  res
    .type('application/javascript')
    .set('Cache-Control', 'no-store')
    .send(`self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(event){
  event.waitUntil(self.registration.unregister().then(function(){return self.clients.matchAll()}).then(function(clients){
    clients.forEach(function(client){client.navigate(client.url)})
  }))
});
`)
})

app.use('/api', syncRouter)
app.use('/api', staffRouter)
app.use('/api', orgRouter)
app.use('/api', fiscalRouter)
app.use('/api', webhookRouter)
app.use('/api', billingRouter)
app.use('/api', storefrontRouter)
app.use('/api', mobileMoneyRouter)
app.use('/api', platformAdminRouter)
app.use('/api', uploadsRouter)
