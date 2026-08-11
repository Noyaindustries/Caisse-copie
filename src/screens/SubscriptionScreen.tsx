'use client'

import { useEffect } from 'react'

import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { ActiveStoreProvider } from '../context/ActiveStoreContext'
import { useSubscription } from '../context/SubscriptionContext'
import { useStaffSession } from '../context/StaffSessionContext'
import { ROUTES, signupUrl, useSitePath } from '../lib/siteRoutes'
import { SubscriptionManagementPage } from '../views/SubscriptionManagementPage'
import { SubscriptionLoadingGate } from './SubscriptionLoadingGate'

export function SubscriptionScreen() {
  const online = useOnlineStatus()
  const { organization, disconnect } = useSubscription()
  const { staff, clearStaff, setShowStaffLogin, canSwitchStore } = useStaffSession()
  const [, navigate] = useSitePath()

  useEffect(() => {
    if (!organization) {
      navigate(signupUrl('pro'))
      return
    }
    // Si un caissier est déjà connecté, la caisse a priorité
    if (staff) {
      navigate(ROUTES.staff)
    }
  }, [organization, staff, navigate])

  if (!organization || staff) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    )
  }

  return (
    <SubscriptionLoadingGate>
      <ActiveStoreProvider canSwitchStore={canSwitchStore}>
        <SubscriptionManagementPage
          online={online}
          onOpenCaisse={() => {
            setShowStaffLogin(true)
            navigate(ROUTES.staff)
          }}
          onDisconnect={() => {
            clearStaff()
            disconnect()
            navigate(ROUTES.home)
          }}
        />
      </ActiveStoreProvider>
    </SubscriptionLoadingGate>
  )
}
