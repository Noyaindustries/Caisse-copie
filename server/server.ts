import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from './app.js'
import { prisma } from './lib/prisma.js'
import { startSubscriptionReminderScheduler } from './lib/subscriptionReminders.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const distPath = path.join(projectRoot, 'dist')
const publicBrandingPath = path.join(projectRoot, 'public', 'branding')

const port = Number(process.env.PORT ?? 4000)
app.use('/branding', express.static(publicBrandingPath))

// En dev (npm run dev:api / tsx), redirige le HTML vers Vite pour éviter un dist/ obsolète.
// Désactiver avec PREFER_VITE=0. Production (node server-dist) sert dist/ normalement.
const preferViteUi =
  process.env.PREFER_VITE === '1' ||
  (process.env.PREFER_VITE !== '0' &&
    (process.env.npm_lifecycle_event === 'dev:api' ||
      process.env.npm_lifecycle_event === 'dev:full' ||
      /tsx/.test(process.argv.join(' '))))
const viteOrigin = process.env.VITE_DEV_ORIGIN ?? 'http://localhost:5173'

if (preferViteUi) {
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (
      req.path.startsWith('/api') ||
      req.path === '/health' ||
      req.path.startsWith('/branding') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/marketing')
    ) {
      return next()
    }
    const accept = req.get('accept') ?? ''
    // Navigateur : text/html. curl / liens : souvent */* — on redirige aussi les chemins SPA.
    const looksLikeSpa =
      accept.includes('text/html') ||
      accept.includes('*/*') ||
      !req.path.includes('.')
    if (looksLikeSpa) {
      return res.redirect(302, `${viteOrigin}${req.originalUrl}`)
    }
    return next()
  })
  console.log(`UI dev → ${viteOrigin} (évite dist/ obsolète sur :${port})`)
}

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
