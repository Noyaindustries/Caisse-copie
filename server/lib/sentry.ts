import * as Sentry from '@sentry/node'

let initialized = false

export function initServerSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn || initialized) return
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.npm_package_version ?? '1.0.0',
    tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  })
  initialized = true
}

export function captureServerException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export { Sentry }
