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
    <header className="premium-glass sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 px-4 py-5 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Espace interne
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600/90">
            Session #{sessionId}
          </p>
          <h1 className="premium-title mt-1 font-display text-2xl font-semibold tracking-tight">
            {VIEW_LABELS[view]}
          </h1>
          <p className="premium-text mt-1 max-w-xl text-sm">
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
