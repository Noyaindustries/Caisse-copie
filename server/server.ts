import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './lib/prisma.js'
import { billingRouter, handleStripeWebhook } from './routes/billing.js'
import { storefrontRouter } from './routes/storefront.js'
import { startSubscriptionReminderScheduler } from './lib/subscriptionReminders.js'
import { handleCinetpayNotify, mobileMoneyRouter } from './routes/mobileMoney.js'
import { syncRouter } from './routes/sync.js'
import { webhookRouter } from './routes/webhooks.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const distPath = path.join(projectRoot, 'dist')

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors())
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

app.use(express.static(distPath))

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const server = app.listen(port, () => {
  console.log(`CaisseCI fullstack en écoute sur http://localhost:${port}`)
  startSubscriptionReminderScheduler()
})

const shutdown = async () => {
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
