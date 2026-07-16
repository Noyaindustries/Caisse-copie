/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Origine du backend Express sans `/api`, si frontend et API sont séparés. */
  readonly VITE_API_BASE_URL?: string
  /** POST JSON : corps `{ batchId, sentAt, items[] }`. Vide = mode simulation locale. */
  readonly VITE_CLOUD_SYNC_URL?: string
  /** Endpoint SMS externe facultatif ; utilise l'API Express par défaut. */
  readonly VITE_SMS_WEBHOOK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
