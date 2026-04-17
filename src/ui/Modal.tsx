import { useEffect, type ReactNode } from 'react'
import { IconClose } from './icons'
import { IconButton } from './Button'
import { cn } from './cn'

type Props = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Désactive la fermeture sur clic backdrop. */
  staticBackdrop?: boolean
}

const SIZE = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  staticBackdrop = false,
}: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 animate-ui-fade-in bg-zinc-950/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!staticBackdrop) onClose()
        }}
      />
      <div
        className={cn(
          'relative z-10 flex max-h-[calc(100svh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[var(--shadow-overlay)] animate-ui-scale-in',
          SIZE[size],
        )}
      >
        {(title || subtitle) ? (
          <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0">
              {title ? <h2 className="ui-h2 truncate text-base sm:text-lg">{title}</h2> : null}
              {subtitle ? (
                <p className="ui-muted mt-0.5 text-[13px] sm:text-sm">{subtitle}</p>
              ) : null}
            </div>
            <IconButton size="sm" onClick={onClose} aria-label="Fermer">
              <IconClose />
            </IconButton>
          </div>
        ) : (
          <div className="absolute right-3 top-3 z-10">
            <IconButton size="sm" onClick={onClose} aria-label="Fermer">
              <IconClose />
            </IconButton>
          </div>
        )}
        <div className="ui-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
