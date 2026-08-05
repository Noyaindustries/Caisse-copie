import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
/* Polices embarquées : aucune requête réseau requise une fois l’app en cache (mode hors ligne). */
import '@fontsource/dm-sans/latin-ext-400.css'
import '@fontsource/dm-sans/latin-ext-400-italic.css'
import '@fontsource/dm-sans/latin-ext-500.css'
import '@fontsource/dm-sans/latin-ext-600.css'
import '@fontsource/dm-sans/latin-ext-700.css'
import '@fontsource/jetbrains-mono/latin-ext-400.css'
import '@fontsource/jetbrains-mono/latin-ext-500.css'
import './index.css'
import { initClientSentry } from './lib/sentry'
initClientSentry()
import App from './App.tsx'
import { ToastProvider } from './ui/Toast'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
