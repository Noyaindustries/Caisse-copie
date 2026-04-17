import type { ReactNode } from 'react'
import { VIEW_LABELS, VIEW_SUBTITLES, type NavViewId } from '../navigation'
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
}

export function Topbar({
  view,
  online,
  syncLabel,
  syncBusy,
  onSyncNow,
  rightSlot,
  onOpenMobileMenu,
}: Props) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md lg:px-6">
      {onOpenMobileMenu ? (
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <IconMenu className="h-4 w-4" />
        </button>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[14px] font-semibold tracking-tight text-zinc-900">
            {VIEW_LABELS[view]}
          </h1>
        </div>
        <p className="hidden truncate text-[11px] text-zinc-500 sm:block">
          {VIEW_SUBTITLES[view]}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {rightSlot}
        <Tooltip content={syncLabel} side="bottom">
          <Badge tone={online ? 'success' : 'warning'} dot>
            {online ? (
              <>
                <IconOnline className="h-3 w-3" />
                <span className="hidden sm:inline">En ligne</span>
              </>
            ) : (
              <>
                <IconOffline className="h-3 w-3" />
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
            <IconSync className={cn(syncBusy && 'animate-spin')} />
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
