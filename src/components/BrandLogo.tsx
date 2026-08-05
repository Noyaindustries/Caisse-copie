import { BRAND_LOGO_SRC, BRAND_NAME } from '../brand'
import { cn } from '../ui/cn'

const SIZES = {
  xs: 'h-10 w-10',
  sm: 'h-12 w-12',
  md: 'h-14 w-14',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
} as const

type BrandLogoSize = keyof typeof SIZES

type BrandLogoProps = {
  size?: BrandLogoSize
  alt?: string
  className?: string
  ring?: 'light' | 'dark' | 'subtle' | 'gold' | false
}

export function BrandLogo({
  size = 'md',
  alt = BRAND_NAME,
  className,
  ring = 'subtle',
}: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      className={cn(
        'shrink-0 rounded-full object-contain bg-white',
        SIZES[size],
        ring === 'light' && 'border border-white/25 bg-white shadow-sm',
        ring === 'dark' && 'border border-white/15 bg-white/95',
        ring === 'subtle' && 'border border-zinc-200/90 bg-white',
        ring === 'gold' && 'border border-amber-200/50 bg-white ring-1 ring-emerald-200/25',
        ring === false && 'border-0',
        className,
      )}
    />
  )
}
