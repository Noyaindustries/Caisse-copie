type ProductImageLike = {
  /** Préféré pour une vignette stable même si le nom change. */
  id?: string
  name: string
  category?: string
  imageDataUrl?: string
}

const cache = new Map<string, string>()

function initialsFromName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
  const first = words[0]?.[0] ?? 'P'
  const second = words[1]?.[0] ?? words[0]?.[1] ?? ''
  return `${first}${second}`.toUpperCase()
}

function paletteForCategory(category?: string): {
  from: string
  to: string
  accent: string
} {
  switch (category) {
    case 'Boissons':
      return { from: '#1d4ed8', to: '#0891b2', accent: '#dbeafe' }
    case 'Alimentation':
      return { from: '#92400e', to: '#f59e0b', accent: '#fef3c7' }
    case 'Hygiène':
      return { from: '#065f46', to: '#0ea5e9', accent: '#d1fae5' }
    default:
      return { from: '#334155', to: '#7c3aed', accent: '#e2e8f0' }
  }
}

function generatedProductImageDataUrl(
  name: string,
  category?: string,
  stableKey?: string,
): string {
  const key = stableKey ?? `${name}::${category ?? ''}`
  const existing = cache.get(key)
  if (existing) return existing

  const initials = initialsFromName(name)
  const palette = paletteForCategory(category)
  const label = (category ?? 'Produit').toUpperCase().slice(0, 12)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.from}" />
      <stop offset="100%" stop-color="${palette.to}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="240" height="240" rx="28" fill="url(#bg)" />
  <circle cx="195" cy="45" r="26" fill="${palette.accent}" opacity="0.25" />
  <circle cx="50" cy="190" r="20" fill="${palette.accent}" opacity="0.2" />
  <text x="120" y="128" text-anchor="middle" fill="white" font-size="74" font-family="DM Sans, Arial, sans-serif" font-weight="700">${initials}</text>
  <text x="120" y="176" text-anchor="middle" fill="white" opacity="0.9" font-size="18" font-family="DM Sans, Arial, sans-serif" letter-spacing="1.5">${label}</text>
</svg>`
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  cache.set(key, dataUrl)
  return dataUrl
}

export function productImageSrc(product: ProductImageLike): string {
  if (product.imageDataUrl) return product.imageDataUrl

  const stableKey = product.id ?? `${product.name}::${product.category ?? ''}`
  return generatedProductImageDataUrl(
    product.name,
    product.category,
    stableKey,
  )
}
