import { useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react'
import { productImageSrc } from '../lib/productImage'
import { cn } from '../ui/cn'
import { IconCatalogue } from '../ui/icons'

type ProductImageLike = {
  id?: string
  name: string
  category?: string
  imageDataUrl?: string
  imageUrl?: string
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  product: ProductImageLike
  alt?: string
}

function Placeholder({
  className,
  title,
}: {
  className?: string
  title?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center bg-zinc-100 text-zinc-400',
        className,
      )}
      title={title}
      aria-hidden
    >
      <IconCatalogue className="h-[45%] w-[45%] max-h-7 max-w-7" />
    </span>
  )
}

/**
 * Affiche la photo du produit si elle a été ajoutée.
 * Sans photo : pastille neutre (pas de visuel généré).
 */
export function ProductImage({ product, alt, className, ...rest }: Props) {
  const realSrc = useMemo(() => productImageSrc(product), [product])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [realSrc])

  if (!realSrc || failed) {
    return <Placeholder className={className} title={alt ?? product.name} />
  }

  return (
    <img
      {...rest}
      alt={alt ?? product.name}
      src={realSrc}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
