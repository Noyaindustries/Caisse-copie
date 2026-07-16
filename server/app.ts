import 'dotenv/config'
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
    process.env.VITE_DEV_ORIGIN,
    ...vercelOrigins.map((host) => `https://${host}`),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
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
    '/api/caisseci/sync',
    '/api/webhooks',
  ],
  sensitiveLimiter,
)
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
app.use(express.json({ limit: '2mb' }))
app.use(morgan('dev'))

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

app.use('/api', syncRouter)
app.use('/api', webhookRouter)
app.use('/api', billingRouter)
app.use('/api', storefrontRouter)
app.use('/api', mobileMoneyRouter)
app.use('/api', platformAdminRouter)
app.use('/api', uploadsRouter)
