import type { ReactNode } from 'react'
import { cn } from './cn'

export type TabItem<T extends string> = {
  id: T
  label: ReactNode
  count?: number
  icon?: ReactNode
}

type Props<T extends string> = {
  items: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
  variant?: 'underline' | 'segmented'
}

export function Tabs<T extends string>({
  items,
  active,
  onChange,
  className,
  variant = 'underline',
}: Props<T>) {
  if (variant === 'segmented') {
    return (
      <div className={cn('tabs-scroll-x', className)}>
        <div
          className={cn(
            'inline-flex min-w-max items-center gap-0.5 rounded-lg border border-border bg-surface-sunken/70 p-0.5',
          )}
        >
        {items.map((it) => {
          const on = it.id === active
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onChange(it.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-semibold transition',
                on
                  ? 'bg-white text-ink shadow-[0_8px_20px_-16px_rgba(23,32,51,0.55)]'
                  : 'text-ink-subtle hover:text-ink',
                '[&_svg]:h-3.5 [&_svg]:w-3.5',
              )}
            >
              {it.icon}
              {it.label}
              {typeof it.count === 'number' ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    on
                      ? 'bg-accent-soft text-accent-strong'
                      : 'bg-surface-sunken text-ink-subtle',
                  )}
                >
                  {it.count}
                </span>
              ) : null}
            </button>
          )
        })}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('tabs-scroll-x', className)}>
      <div className="flex min-w-max items-center gap-0.5 border-b border-border">
      {items.map((it) => {
        const on = it.id === active
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={cn(
              'relative -mb-px inline-flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold transition',
              on
                ? 'text-ink'
                : 'text-ink-subtle hover:text-ink-muted',
              '[&_svg]:h-3.5 [&_svg]:w-3.5',
            )}
          >
            {it.icon}
            {it.label}
            {typeof it.count === 'number' ? (
              <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold text-ink-subtle">
                {it.count}
              </span>
            ) : null}
            {on ? (
              <span
                aria-hidden
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent"
              />
            ) : null}
          </button>
        )
      })}
      </div>
    </div>
  )
}
