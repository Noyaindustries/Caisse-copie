import type { ReactNode } from 'react'
import type { NavViewId } from '../navigation'
import { VIEW_LABELS, VIEW_SUBTITLES } from '../navigation'

type Props = {
  view: NavViewId
  sessionId: string
  rightSlot?: ReactNode
}

export function ViewHeader({ view, sessionId, rightSlot }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/85 px-4 py-5 backdrop-blur-md lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600/90">
            Session #{sessionId}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900">
            {VIEW_LABELS[view]}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {VIEW_SUBTITLES[view]}
          </p>
        </div>
        {rightSlot ? (
          <div className="flex flex-wrap items-center gap-2">{rightSlot}</div>
        ) : null}
      </div>
    </header>
  )
}
