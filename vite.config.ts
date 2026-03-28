import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'CaisseCI — Point de vente',
        short_name: 'CaisseCI',
        description:
          'Caisse enregistreuse hors ligne pour commerces en Côte d’Ivoire',
        theme_color: '#16a34a',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        /* Inclure les .woff2 des @fontsource pour un rendu hors ligne complet */
        globPatterns: [
          '**/*.{js,css,html,ico,svg,png,webp,woff2,woff,json,webmanifest}',
        ],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/__/, /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
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
      },
    }),
  ],
})
