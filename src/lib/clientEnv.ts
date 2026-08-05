/**
 * Variables d'environnement côté client (Next.js `NEXT_PUBLIC_*`).
 * Ne jamais y mettre de secrets serveur.
 */
function readPublicEnv(name: string): string | undefined {
  const nextKey = `NEXT_PUBLIC_${name}`
  const fromProcess =
    typeof process !== 'undefined' ? process.env[nextKey]?.trim() : undefined
  if (fromProcess) return fromProcess

  // Repli legacy pendant migration (builds anciens)
  const legacyKey = `VITE_${name}`
  const importMeta = (
    import.meta as unknown as { env?: Record<string, string | undefined> }
  ).env
  return importMeta?.[legacyKey]?.trim() || importMeta?.[nextKey]?.trim() || undefined
}

export const clientEnv = {
  apiBaseUrl: () => readPublicEnv('API_BASE_URL'),
  cloudSyncUrl: () => readPublicEnv('CLOUD_SYNC_URL'),
  smsWebhookUrl: () => readPublicEnv('SMS_WEBHOOK_URL'),
  sentryDsn: () => readPublicEnv('SENTRY_DSN'),
  sentryTracesSampleRate: () => readPublicEnv('SENTRY_TRACES_SAMPLE_RATE'),
  appVersion: () => readPublicEnv('APP_VERSION') ?? '1.0.0',
  isDev: () =>
    typeof process !== 'undefined'
      ? process.env.NODE_ENV === 'development'
      : false,
}
