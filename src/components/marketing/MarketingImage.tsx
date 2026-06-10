import { cn } from '../../ui/cn'

export function MarketingImage({
  src,
  alt,
  className,
  overlay = 'none',
  priority = false,
  objectPosition = 'center',
}: {
  src: string
  alt: string
  className?: string
  overlay?: 'none' | 'dark' | 'gradient' | 'gradient-bottom'
  priority?: boolean
  objectPosition?: string
}) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="h-full w-full object-cover"
        style={{ objectPosition }}
      />
      {overlay === 'dark' ? (
        <div className="absolute inset-0 bg-black/35" aria-hidden />
      ) : null}
      {overlay === 'gradient' ? (
        <div
          className="absolute inset-0 bg-linear-to-r from-[#0c1222]/90 via-[#0c1222]/40 to-transparent"
          aria-hidden
        />
      ) : null}
      {overlay === 'gradient-bottom' ? (
        <div
          className="absolute inset-0 bg-linear-to-t from-[#0c1222]/80 via-transparent to-transparent"
          aria-hidden
        />
      ) : null}
    </div>
  )
}
