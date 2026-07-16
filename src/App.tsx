import { useCallback, useEffect, useMemo, useState } from 'react'
import { effectivePermissions } from './auth/permissions'
import {
  clearStaffSession,
  getStaffSession,
  setStaffSession,
} from './auth/session'
import type { StaffAuthMethod, StaffProfile } from './auth/types'
import { LoginScreen } from './components/LoginScreen'
import { OfflineBanner } from './components/OfflineBanner'
import { OrganizationSetup } from './components/OrganizationSetup'
import { ActiveStoreProvider } from './context/ActiveStoreContext'
import { SubscriptionProvider, useSubscription } from './context/SubscriptionContext'
import { ensureSeed } from './db/db'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { Shell } from './Shell'
import {
  isPlatformAdminPath,
  isSignupPath,
  isStaffPath,
  isSubscriptionPath,
  parseStorefrontCode,
  ROUTES,
  signupUrl,
  SitePathProvider,
  useSitePath,
} from './lib/siteRoutes'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/Card'
import { MarketingSiteView } from './views/MarketingSiteView'
import { LuxuryStorefrontView } from './views/LuxuryStorefrontView'
import { SubscriptionManagementPage } from './views/SubscriptionManagementPage'
import { PublicStorefrontPage } from './views/PublicStorefrontPage'
import { PlatformAdminPage } from './views/PlatformAdminPage'

function AlreadyConnectedGate({
  orgName,
  onSubscription,
  onSwitchAccount,
  onHome,
}: {
  orgName: string
  onSubscription: () => void
  onSwitchAccount: () => void
  onHome: () => void
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface-muted px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <h1 className="text-xl font-bold text-ink">Déjà connecté</h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            Le magasin <strong className="text-ink">{orgName}</strong> est déjà actif sur cet
            appareil. Choisissez une action :
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button type="button" onClick={onSubscription}>
              Mon abonnement
            </Button>
            <Button type="button" variant="secondary" onClick={onSwitchAccount}>
              Changer de compte
            </Button>
            <Button type="button" variant="ghost" onClick={onHome}>
              Retour au site
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AppContent() {
  const online = useOnlineStatus()
  const { ready: subscriptionReady, organization, disconnect } = useSubscription()
  const [pathname, navigate] = useSitePath()
  const [staff, setStaff] = useState(() => getStaffSession())
  const [seedReady, setSeedReady] = useState(false)
  const [seedError, setSeedError] = useState<string | null>(null)
  const [seedAttempt, setSeedAttempt] = useState(0)
  const [showStaffLogin, setShowStaffLogin] = useState(
    () => !getStaffSession() && isStaffPath(),
  )

  useEffect(() => {
    let cancelled = false
    void ensureSeed()
      .then(() => {
        if (!cancelled) {
          setSeedError(null)
          setSeedReady(true)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSeedError(
            error instanceof Error
              ? error.message
              : 'Impossible d’initialiser les données locales.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [seedAttempt])

  useEffect(() => {
    if (organization || !isSubscriptionPath(pathname)) return
    navigate(signupUrl('pro'))
  }, [organization, pathname, navigate])

  const handleLogin = useCallback(
    (profile: StaffProfile, authMethod: StaffAuthMethod) => {
      setStaffSession(profile.id, authMethod)
      setStaff(getStaffSession())
      setShowStaffLogin(false)
    },
    [],
  )

  const canSwitchStore = useMemo(() => {
    if (!staff) return false
    return effectivePermissions(staff.profile).canSwitchStore
  }, [staff])

  const handleLogout = useCallback(() => {
    clearStaffSession()
    setStaff(null)
    setShowStaffLogin(false)
    navigate(ROUTES.subscription)
  }, [navigate])

  const openCaisseFromSubscription = useCallback(() => {
    navigate(ROUTES.staff)
    setShowStaffLogin(true)
  }, [navigate])

  const handleDisconnectOrganization = useCallback(() => {
    disconnect()
    setStaff(null)
    setShowStaffLogin(false)
    navigate(ROUTES.home)
  }, [disconnect, navigate])

  const handleSwitchAccount = useCallback(() => {
    clearStaffSession()
    setStaff(null)
    setShowStaffLogin(false)
    disconnect()
    // Rester sur /connexion pour se reconnecter
    navigate(ROUTES.login)
  }, [disconnect, navigate])

  const storefrontCode = parseStorefrontCode(pathname)

  if (isPlatformAdminPath(pathname)) {
    return <PlatformAdminPage onExit={() => navigate(ROUTES.home)} />
  }

  if (!subscriptionReady) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    )
  }

  if (storefrontCode) {
    return <PublicStorefrontPage storeCode={storefrontCode} online={online} />
  }

  // Pages inscription / connexion : toujours accessibles (plus de redirect silencieux)
  if (isSignupPath(pathname)) {
    if (organization) {
      return (
        <AlreadyConnectedGate
          orgName={organization.name}
          onSubscription={() => navigate(ROUTES.subscription)}
          onSwitchAccount={handleSwitchAccount}
          onHome={() => navigate(ROUTES.home)}
        />
      )
    }
    return <OrganizationSetup onNavigate={navigate} />
  }

  if (!organization) {
    if (isStaffPath()) {
      return (
        <div className="flex min-h-svh items-center justify-center bg-surface-muted px-4 py-10">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4 p-8 text-center">
              <h1 className="text-xl font-bold text-ink">Connexion caisse</h1>
              <p className="text-sm leading-relaxed text-ink-muted">
                Votre magasin doit d’abord être activé. Créez un compte ou rejoignez une
                équipe existante avec le code magasin.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button type="button" onClick={() => navigate(signupUrl('pro'))}>
                  Créer mon magasin
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.login)}>
                  Connexion Gmail
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(`${ROUTES.signup}#rejoindre`)}
                >
                  Rejoindre un magasin
                </Button>
                <Button type="button" variant="ghost" onClick={() => navigate(ROUTES.home)}>
                  Retour au site
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }
    const pricingPage = pathname.toLowerCase() === ROUTES.pricing
    return (
      <MarketingSiteView onNavigate={navigate} scrollToPricing={pricingPage} />
    )
  }

  return (
    <ActiveStoreProvider canSwitchStore={canSwitchStore}>
      {organization && isSubscriptionPath(pathname) && !staff ? (
        <SubscriptionManagementPage
          online={online}
          onOpenCaisse={openCaisseFromSubscription}
          onGoHome={() => navigate(ROUTES.home)}
          onDisconnect={handleDisconnectOrganization}
        />
      ) : !staff ? (
        showStaffLogin ? (
          <div className="flex min-h-svh flex-col overflow-y-auto bg-zinc-50">
            {!online ? <OfflineBanner /> : null}
            <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-4 pt-6">
              <button
                type="button"
                onClick={() => setShowStaffLogin(false)}
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
                  onClick={() => {
                    setSeedError(null)
                    setSeedAttempt((attempt) => attempt + 1)
                  }}
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
              onClick={handleLogout}
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
          onLogout={handleLogout}
        />
      )}
    </ActiveStoreProvider>
  )
}

export default function App() {
  const online = useOnlineStatus()

  return (
    <SitePathProvider>
      <SubscriptionProvider online={online}>
        <AppContent />
      </SubscriptionProvider>
    </SitePathProvider>
  )
}
