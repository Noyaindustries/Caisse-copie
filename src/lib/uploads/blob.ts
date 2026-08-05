import { apiUrl } from '../apiUrl'
import { parseApiResponse } from '../parseApiResponse'
import { buildOrgAuthHeaders } from '../subscription/authHeaders'
import { getOrganizationCredentials } from '../subscription/store'

let blobUploadEnabled: boolean | null = null

async function parseJson<T>(res: Response): Promise<T> {
  return parseApiResponse<T>(res)
}

/** Indique si le serveur a un token Vercel Blob (`BLOB_READ_WRITE_TOKEN`). */
export async function isBlobUploadAvailable(): Promise<boolean> {
  if (blobUploadEnabled !== null) return blobUploadEnabled
  try {
    const res = await fetch(apiUrl('/uploads/status'))
    if (!res.ok) {
      blobUploadEnabled = false
      return false
    }
    const data = await parseJson<{ enabled: boolean }>(res)
    blobUploadEnabled = data.enabled === true
  } catch {
    blobUploadEnabled = false
  }
  return blobUploadEnabled
}

export function resetBlobUploadAvailabilityCache(): void {
  blobUploadEnabled = null
}

export async function uploadProductImageToBlob(
  _licenseKey: string,
  productId: string,
  dataUrl: string,
): Promise<string> {
  const res = await fetch(apiUrl('/uploads/product-image'), {
    method: 'POST',
    headers: buildOrgAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ productId, dataUrl }),
  })
  const data = await parseJson<{ url: string }>(res)
  return data.url
}

export type ProductImageFields = {
  imageDataUrl?: string
  imageUrl?: string
}

/**
 * Envoie la photo vers Vercel Blob si disponible, sinon conserve le data URL local (offline-first).
 */
export async function resolveProductImageFields(
  productId: string,
  dataUrl: string | undefined,
): Promise<ProductImageFields> {
  if (!dataUrl) return {}

  const creds = getOrganizationCredentials()
  const canUseBlob =
    creds !== null &&
    typeof navigator !== 'undefined' &&
    navigator.onLine &&
    (await isBlobUploadAvailable())

  if (canUseBlob && creds) {
    try {
      const imageUrl = await uploadProductImageToBlob(creds.licenseKey, productId, dataUrl)
      return { imageUrl }
    } catch {
      return { imageDataUrl: dataUrl }
    }
  }

  return { imageDataUrl: dataUrl }
}
