import path from 'node:path'
import { fileURLToPath } from 'node:url'
import withPWA from 'next-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '../..')
const apiOrigin = process.env.API_PROXY_TARGET ?? 'http://localhost:4000'

/**
 * Sur Vercel avec Root Directory = monorepo (`.`), Next doit écrire `.next`
 * à la racine — sinon la plateforme cherche `/vercel/path0/.next` et échoue.
 * Activer via CAISSECI_NEXT_DIST_ROOT=1 (scripts/vercel-build.mjs).
 * Si Root Directory = apps/web : ne pas définir cette variable.
 */
const distDir = process.env.CAISSECI_NEXT_DIST_ROOT === '1' ? '../../.next' : '.next'

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  outputFileTracingRoot: repoRoot,
  allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.1.68'],
  // next-pwa injecte une config webpack → explicite pour Next 16
  // root = monorepo pour résoudre `server/` hors de apps/web
  turbopack: {
    root: repoRoot,
  },
  // Backend Express/Prisma hors apps/web — ne pas bundler dans le client.
  serverExternalPackages: [
    '@prisma/client',
    'prisma',
    'express',
    'cors',
    'helmet',
    'morgan',
    'express-rate-limit',
    '@sentry/node',
    'dotenv',
  ],
  experimental: {
    externalDir: true,
    // Next 16.3 active InnerScrollHandlerNew (<Fragment ref={...}>) ; React 19.2
    // stable rejette encore ce ref → console "Invalid prop ref supplied to React.Fragment".
    // Opt-out jusqu’à un React avec FragmentInstance pleinement supporté.
    appNewScrollHandler: false,
  },
  async rewrites() {
    // Sur Vercel : pages/api/[[...path]] monte Express. Ne pas proxy localhost.
    if (process.env.VERCEL) {
      return [{ source: '/health', destination: '/api/health' }]
    }
    // En local : proxy avant les pages (beforeFiles) vers `npm run dev:api` (:4000).
    return {
      beforeFiles: [
        { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
        { source: '/health', destination: `${apiOrigin}/health` },
        {
          source: '/webhooks/:path*',
          destination: `${apiOrigin}/webhooks/:path*`,
        },
        {
          source: '/uploads/:path*',
          destination: `${apiOrigin}/uploads/:path*`,
        },
      ],
    }
  },
  // Inclut le backend Express + Prisma dans le bundle serverless /api.
  outputFileTracingIncludes: {
    '/api/**/*': [
      '../../server/**/*',
      '../../prisma/**/*',
      '../../node_modules/.prisma/client/**/*',
      '../../node_modules/@prisma/client/**/*',
    ],
  },
  // server/*.ts importe en ESM avec suffixe .js → résoudre vers .ts
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.extensionAlias = {
        ...config.resolve.extensionAlias,
        '.js': ['.ts', '.tsx', '.js', '.jsx'],
        '.mjs': ['.mts', '.mjs'],
      }
    }
    return config
  },
}

const withPWACfg = withPWA({
  dest: 'public',
  register: true,
  disable: process.env.NODE_ENV === 'development',
  // Exclure les assets marketing lourds du precache.
  publicExcludes: ['marketing/**/*'],
  // App Router : `/` n’est pas dans le precache Workbox.
  // `navigateFallback: '/'` → Uncaught non-precached-url au démarrage du SW.
  fallbacks: false,
  runtimeCaching: [
    {
      // Ne jamais servir l’API depuis le cache (auth, billing, sync).
      urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /\/marketing\/.+\.(?:png|jpg|jpeg|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'marketing-images',
        expiration: {
          maxEntries: 12,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-cdn-fallback',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        },
      },
    },
  ],
})

export default withPWACfg(nextConfig)
