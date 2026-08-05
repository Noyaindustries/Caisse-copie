import * as Sentry from '@sentry/react'

import { clientEnv } from './clientEnv'

let initialized = false

export function initClientSentry(): void {
  const dsn = clientEnv.sentryDsn()
  if (!dsn || initialized) return
  Sentry.init({
    dsn,
    environment: clientEnv.isDev() ? 'development' : 'production',
    release: clientEnv.appVersion(),
    tracesSampleRate: Number.parseFloat(
      clientEnv.sentryTracesSampleRate() ?? '0.1',
    ),
  })
  initialized = true
}

export { Sentry }
