import type { ReactNode } from 'react'
import {
  VIEW_ACCENTS,
  VIEW_LABELS,
  VIEW_SUBTITLES,
  type NavViewId,
} from '../navigation'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import { Tooltip } from '../ui/Tooltip'
import {
  IconMenu,
  IconOffline,
  IconOnline,
  IconSync,
} from '../ui/icons'

type Props = {
  view: NavViewId
  online: boolean
  syncLabel: string
  syncBusy: boolean
  onSyncNow: () => void
  rightSlot?: ReactNode
  onOpenMobileMenu?: () => void
  className?: string
}

export function Topbar({
  view,
  online,
  syncLabel,
  syncBusy,
  onSyncNow,
  rightSlot,
  onOpenMobileMenu,
  className,
}: Props) {
  const accent = VIEW_ACCENTS[view]
  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-white/88 px-3 py-2 backdrop-blur-xl sm:min-h-14 sm:gap-3 sm:px-4 lg:px-6 pt-[max(0.5rem,env(safe-area-inset-top,0px))]',
        className,
      )}
    >
      {onOpenMobileMenu ? (
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="rounded-md p-1.5 text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <IconMenu className="h-4 w-4" />
        </button>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'hidden rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline-flex',
              accent.chip,
            )}
          >
            Module
          </span>
          <h1 className="truncate text-[14px] font-semibold tracking-tight text-ink">
            {VIEW_LABELS[view]}
          </h1>
        </div>
        <p className="hidden truncate text-[11px] text-ink-subtle sm:block md:max-w-md">
          {VIEW_SUBTITLES[view]}
        </p>
      </div>

      <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
        {rightSlot}
        <Tooltip content={syncLabel} side="bottom">
          <Badge tone={online ? 'success' : 'warning'} dot>
            {online ? (
              <>
                <IconOnline className="h-3 w-3 text-emerald-600" />
                <span className="hidden sm:inline">En ligne</span>
              </>
            ) : (
              <>
                <IconOffline className="h-3 w-3 text-amber-600" />
                <span className="hidden sm:inline">Hors ligne</span>
              </>
            )}
          </Badge>
        </Tooltip>
        <Button
          size="sm"
          variant="ghost"
          onClick={onSyncNow}
          disabled={!online || syncBusy}
          iconLeft={
            <IconSync className={cn('text-sky-600', syncBusy && 'animate-spin')} />
          }
        >
          <span className="hidden sm:inline">
            {syncBusy ? 'Sync…' : 'Sync'}
          </span>
        </Button>
      </div>
    </header>
  )
}
