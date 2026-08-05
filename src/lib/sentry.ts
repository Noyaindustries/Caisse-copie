import * as Sentry from '@sentry/react'

let initialized = false

export function initClientSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  if (!dsn || initialized) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION ?? '1.0.0',
    tracesSampleRate: Number.parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  })
  initialized = true
}

export { Sentry }
