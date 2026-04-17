import type { ReactNode } from 'react'
import { VIEW_LABELS, VIEW_SUBTITLES, type NavViewId } from '../navigation'
import { PageHeader } from '../ui/PageHeader'

type Props = {
  view: NavViewId
  sessionId: string
  rightSlot?: ReactNode
}

/**
 * Conservé pour compatibilité ascendante. Préférer `PageHeader` directement
 * dans les nouvelles vues.
 */
export function ViewHeader({ view, sessionId, rightSlot }: Props) {
  return (
    <PageHeader
      eyebrow={`Session #${sessionId}`}
      title={VIEW_LABELS[view]}
      subtitle={VIEW_SUBTITLES[view]}
      actions={rightSlot}
    />
  )
}
