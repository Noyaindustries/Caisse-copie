import { put } from '@vercel/blob'

const MAX_IMAGE_BYTES = 500 * 1024

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export function isBlobStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim())
}

export function parseImageDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim())
  if (!match) {
    throw new Error('Format d’image invalide (data URL attendue).')
  }

  const contentType = match[1]!.toLowerCase()
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error('Type d’image non supporté (JPEG, PNG, WebP ou GIF).')
  }

  const buffer = Buffer.from(match[2]!.replace(/\s/g, ''), 'base64')
  if (buffer.length === 0) {
    throw new Error('Image vide.')
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Image trop volumineuse (max 500 Ko).')
  }

  return { contentType, buffer }
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return 'img'
  }
}

export async function uploadOrganizationProductImage(params: {
  organizationId: string
  productId: string
  dataUrl: string
}): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new Error('Stockage Vercel Blob non configuré.')
  }

  const { contentType, buffer } = parseImageDataUrl(params.dataUrl)
  const ext = extensionForContentType(contentType)
  const pathname = `products/${params.organizationId}/${params.productId}.${ext}`

  const result = await put(pathname, buffer, {
    access: 'public',
    token,
    contentType,
    addRandomSuffix: true,
  })

  return result.url
}

export async function uploadOrganizationAsset(params: {
  organizationId: string
  kind: 'logo' | 'banner'
  dataUrl: string
}): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new Error('Stockage Vercel Blob non configuré.')
  }

  const { contentType, buffer } = parseImageDataUrl(params.dataUrl)
  const ext = extensionForContentType(contentType)
  const pathname = `orgs/${params.organizationId}/${params.kind}.${ext}`

  const result = await put(pathname, buffer, {
    access: 'public',
    token,
    contentType,
    addRandomSuffix: true,
  })

  return result.url
}
