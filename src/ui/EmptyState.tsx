import type { ReactNode } from 'react'
import { cn } from './cn'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  variant = 'card',
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  variant?: 'card' | 'flat'
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        variant === 'card' &&
          'rounded-xl border border-dashed border-border bg-white/75 shadow-[0_8px_24px_-20px_rgba(23,32,51,0.18)]',
        className,
      )}
    >
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-accent-soft text-accent-strong [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      ) : null}
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? (
          <p className="text-[13px] leading-relaxed text-ink-subtle">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
