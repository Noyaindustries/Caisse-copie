/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** POST JSON : corps `{ batchId, sentAt, items[] }`. Vide = mode simulation locale. */
  readonly VITE_CLOUD_SYNC_URL?: string
  /** `1` = n’utilise jamais d’images distantes (mode offline first). */
  readonly VITE_DISABLE_REMOTE_IMAGES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
