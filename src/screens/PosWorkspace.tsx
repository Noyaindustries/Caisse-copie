'use client'

import { LoginScreen } from '../components/LoginScreen'
import { OfflineBanner } from '../components/OfflineBanner'
import { ActiveStoreProvider } from '../context/ActiveStoreContext'
import { useStaffSession } from '../context/StaffSessionContext'
import { useSubscription } from '../context/SubscriptionContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { ROUTES, useSitePath } from '../lib/siteRoutes'
import { Shell } from '../Shell'
import { LuxuryStorefrontView } from '../views/LuxuryStorefrontView'
import { NoOrgStaffGate } from './AuthScreen'
import { SubscriptionLoadingGate } from './SubscriptionLoadingGate'

type PosMode = 'storefront' | 'staff'

/**
 * Espace magasin connecté : boutique luxe, login caissier ou shell caisse.
 */
export function PosWorkspace({ mode }: { mode: PosMode }) {
  const online = useOnlineStatus()
  const { organization } = useSubscription()
  const {
    staff,
    seedReady,
    seedError,
    showStaffLogin,
    canSwitchStore,
    setShowStaffLogin,
    handleLogin,
    handleLogout,
    retrySeed,
  } = useStaffSession()
  const [, navigate] = useSitePath()

  // Spinner tant que l’org n’est pas hydratée depuis localStorage (évite flash NoOrg).
  if (!organization) {
    return (
      <SubscriptionLoadingGate>
        {mode === 'staff' ? <NoOrgStaffGate /> : null}
      </SubscriptionLoadingGate>
    )
  }

  const forceStaffLogin = mode === 'staff' || showStaffLogin

  return (
    <SubscriptionLoadingGate>
      <ActiveStoreProvider canSwitchStore={canSwitchStore}>
        {!staff ? (
          forceStaffLogin ? (
            <div className="flex min-h-svh flex-col overflow-y-auto bg-zinc-50">
              {!online ? <OfflineBanner /> : null}
              <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-4 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowStaffLogin(false)
                    if (mode === 'staff') navigate(ROUTES.home)
                  }}
                  className="ui-btn ui-btn-secondary"
                >
                  ← Retour boutique en ligne
                </button>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.subscription)}
                  className="ui-btn ui-btn-primary"
                >
                  Mon abonnement
                </button>
              </div>
              <div className="flex flex-1 flex-col">
                <LoginScreen onSuccess={handleLogin} />
              </div>
            </div>
          ) : (
            <LuxuryStorefrontView
              online={online}
              seedReady={seedReady}
              onOpenStaffLogin={() => setShowStaffLogin(true)}
              onOpenOwnerSpace={() => navigate(ROUTES.subscription)}
            />
          )
        ) : !seedReady ? (
          <div className="flex min-h-svh flex-col bg-zinc-50">
            {!online ? <OfflineBanner /> : null}
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              {seedError ? (
                <>
                  <p className="max-w-md text-center text-sm font-semibold text-rose-700">
                    Initialisation impossible : {seedError}
                  </p>
                  <button
                    type="button"
                    onClick={retrySeed}
                    className="ui-btn ui-btn-primary"
                  >
                    Réessayer
                  </button>
                </>
              ) : (
                <>
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
                  <p className="text-sm font-semibold text-zinc-700">
                    Chargement de la caisse…
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  handleLogout()
                  navigate(ROUTES.subscription)
                }}
                className="ui-btn ui-btn-ghost"
              >
                Changer de profil
              </button>
            </div>
          </div>
        ) : (
          <Shell
            staff={staff.profile}
            online={online}
            onLogout={() => {
              handleLogout()
              navigate(ROUTES.subscription)
            }}
          />
        )}
      </ActiveStoreProvider>
    </SubscriptionLoadingGate>
  )
}

export function StaffScreen() {
  return <PosWorkspace mode="staff" />
}

export function HomePosScreen() {
  return <PosWorkspace mode="storefront" />
}
