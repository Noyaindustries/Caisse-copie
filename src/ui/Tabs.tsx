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
      <div
        className={cn(
          'inline-flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5',
          className,
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
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800',
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
                      ? 'bg-zinc-100 text-zinc-700'
                      : 'bg-zinc-200/70 text-zinc-600',
                  )}
                >
                  {it.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 border-b border-zinc-200',
        className,
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
              'relative -mb-px inline-flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium transition',
              on
                ? 'text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-800',
              '[&_svg]:h-3.5 [&_svg]:w-3.5',
            )}
          >
            {it.icon}
            {it.label}
            {typeof it.count === 'number' ? (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                {it.count}
              </span>
            ) : null}
            {on ? (
              <span
                aria-hidden
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-zinc-900"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
