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
          'rounded-xl border border-dashed border-zinc-200 bg-white/60',
        className,
      )}
    >
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      ) : null}
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-zinc-800">{title}</p>
        {description ? (
          <p className="text-[13px] leading-relaxed text-zinc-500">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
