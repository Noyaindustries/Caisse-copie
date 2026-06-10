import { useSubscription } from '../context/SubscriptionContext'
import { statusLabel } from '../lib/subscription/plans'
import { Button } from '../ui/Button'
import { IconWarning } from '../ui/icons'

type Props = {
  onOpenSubscription: () => void
}

export function SubscriptionBanner({ onOpenSubscription }: Props) {
  const { subscription, usable, online } = useSubscription()

  if (!subscription || usable) return null

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-medium">
          <IconWarning className="h-4 w-4 shrink-0" />
          Abonnement {statusLabel(subscription.status).toLowerCase()} — certains modules
          sont limités.
          {!online ? ' Mode hors ligne (cache de licence actif).' : null}
        </p>
        <Button type="button" size="sm" onClick={onOpenSubscription}>
          Gérer l’abonnement
        </Button>
      </div>
    </div>
  )
}
