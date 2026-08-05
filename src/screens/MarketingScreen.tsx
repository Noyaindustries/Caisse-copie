'use client'

import { useSubscription } from '../context/SubscriptionContext'
import { MarketingSiteView } from '../views/MarketingSiteView'
import { useSitePath } from '../lib/siteRoutes'
import { SubscriptionLoadingGate } from './SubscriptionLoadingGate'
import { PosWorkspace } from './PosWorkspace'

export function MarketingScreen({ scrollToPricing = false }: { scrollToPricing?: boolean }) {
  const { organization } = useSubscription()
  const [, navigate] = useSitePath()

  return (
    <SubscriptionLoadingGate>
      {organization ? (
        <PosWorkspace mode="storefront" />
      ) : (
        <MarketingSiteView onNavigate={navigate} scrollToPricing={scrollToPricing} />
      )}
    </SubscriptionLoadingGate>
  )
}
