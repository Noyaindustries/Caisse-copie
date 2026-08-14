type ProductImageLike = {
  id?: string
  name: string
  category?: string
  imageDataUrl?: string
  imageUrl?: string
}

/**
 * Photo réelle du produit uniquement (upload magasin).
 * Pas de photo Unsplash ni de vignette générée.
 */
export function productImageSrc(product: ProductImageLike): string {
  const url = product.imageUrl?.trim()
  if (url) return url
  return product.imageDataUrl?.trim() ?? ''
}
