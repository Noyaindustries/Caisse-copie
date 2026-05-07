import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'branding/digitalpro-solutions-logo.png'],
      manifest: {
        name: 'Digitalpro Solutions — Point de vente',
        short_name: 'Digitalpro Solutions',
        description:
          'Caisse enregistreuse hors ligne pour commerces en Côte d’Ivoire',
        theme_color: '#003399',
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
