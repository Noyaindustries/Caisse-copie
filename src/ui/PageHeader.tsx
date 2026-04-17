import type { ReactNode } from 'react'
import { cn } from './cn'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 pb-5 pt-1 sm:gap-4 sm:pb-6 lg:flex-row lg:items-end lg:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="ui-eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="ui-h1 truncate text-2xl sm:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="ui-muted mt-1.5 max-w-2xl text-[13px] leading-relaxed sm:text-sm">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="ui-scroll -mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function SectionHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-3 flex flex-wrap items-end justify-between gap-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="ui-h2">{title}</h2>
        {subtitle ? (
          <p className="ui-muted mt-0.5 text-[13px]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
