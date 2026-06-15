import type { ReactNode } from 'react'
import { cn } from '../../ui/cn'

export function MarketingSectionHeader({
  eyebrow,
  title,
  description,
  align = 'center',
  theme = 'default',
  className,
  titleClassName,
}: {
  eyebrow: string
  title: ReactNode
  description?: string
  align?: 'center' | 'left'
  theme?: 'default' | 'dark'
  className?: string
  titleClassName?: string
}) {
  const isDark = theme === 'dark'

  return (
    <div
      className={cn(
        'max-w-3xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      <p
        className={cn(
          'marketing-eyebrow',
          align === 'center' && 'marketing-eyebrow-center',
          isDark && 'marketing-eyebrow-light',
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          'mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.65rem] lg:leading-[1.12]',
          isDark ? 'text-white' : 'text-ink',
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mt-4 text-base leading-relaxed sm:text-lg',
            isDark ? 'text-slate-300' : 'text-ink-muted',
            align === 'center' && 'mx-auto max-w-2xl',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
