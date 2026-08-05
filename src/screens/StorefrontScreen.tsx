'use client'

import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { PublicStorefrontPage } from '../views/PublicStorefrontPage'
import { SubscriptionLoadingGate } from './SubscriptionLoadingGate'

export function StorefrontScreen({ storeCode }: { storeCode: string }) {
  const online = useOnlineStatus()
  return (
    <SubscriptionLoadingGate>
      <PublicStorefrontPage storeCode={storeCode} online={online} />
    </SubscriptionLoadingGate>
  )
}
