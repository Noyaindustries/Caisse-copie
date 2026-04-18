import { useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react'
import {
  productImageFallbackSvg,
  productImageRemoteUrl,
} from '../lib/productImage'

type ProductImageLike = {
  id?: string
  name: string
  category?: string
  imageDataUrl?: string
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  product: ProductImageLike
  alt?: string
}

/**
 * Rend une image produit avec **fallback automatique** :
 * 1. photo perso (`imageDataUrl`) si fournie
 * 2. photo distante (Unsplash)
 * 3. vignette SVG locale en cas d'erreur réseau / hors ligne
 */
export function ProductImage({ product, alt, ...rest }: Props) {
  const fallback = useMemo(
    () =>
      productImageFallbackSvg(
        product.name,
        product.category,
        product.id ?? `${product.name}::${product.category ?? ''}`,
      ),
    [product.id, product.name, product.category],
  )

  const initialSrc = useMemo((): string => {
    if (product.imageDataUrl) return product.imageDataUrl
    if (typeof navigator !== 'undefined' && !navigator.onLine) return fallback
    const remote = productImageRemoteUrl(product)
    return remote ?? fallback
  }, [product, fallback])

  const [src, setSrc] = useState(initialSrc)

  useEffect(() => {
    setSrc(initialSrc)
  }, [initialSrc])

  return (
    <img
      {...rest}
      alt={alt ?? product.name}
      src={src}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (src !== fallback) setSrc(fallback)
      }}
    />
  )
}
