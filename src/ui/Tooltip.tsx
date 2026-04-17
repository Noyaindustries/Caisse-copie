import type { ReactNode } from 'react'
import { cn } from './cn'

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}) {
  const pos =
    side === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-1.5'
      : side === 'bottom'
        ? 'top-full left-1/2 -translate-x-1/2 mt-1.5'
        : side === 'left'
          ? 'right-full top-1/2 -translate-y-1/2 mr-1.5'
          : 'left-full top-1/2 -translate-y-1/2 ml-1.5'
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/tt:opacity-100',
          pos,
        )}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  )
}
