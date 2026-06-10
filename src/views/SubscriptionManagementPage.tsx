import { Suspense, lazy } from 'react'
import { clearStaffSession } from '../auth/session'
import { BRAND_NAME } from '../brand'
import { BrandLogo } from '../components/BrandLogo'
import { OfflineBanner } from '../components/OfflineBanner'
import { useSubscription } from '../context/SubscriptionContext'
import { Button } from '../ui/Button'
import { IconArrowRight, IconLogout } from '../ui/icons'

const SubscriptionView = lazy(() =>
  import('./SubscriptionView').then((m) => ({
    default: m.SubscriptionView,
  })),
)

type Props = {
  online: boolean
  onOpenCaisse: () => void
  onGoHome: () => void
  onDisconnect: () => void
}

export function SubscriptionManagementPage({
  online,
  onOpenCaisse,
  onGoHome,
  onDisconnect,
}: Props) {
  const { organization } = useSubscription()

  const handleDisconnect = () => {
    const ok = window.confirm(
      'Quitter ce magasin sur cet appareil ? Vous devrez vous réinscrire ou saisir à nouveau le code magasin pour retrouver l’abonnement.',
    )
    if (!ok) return
    clearStaffSession()
    onDisconnect()
  }

  return (
    <div className="flex min-h-svh flex-col bg-[#f4f6fb]">
      {!online ? <OfflineBanner /> : null}
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center gap-2.5 rounded-lg text-left transition hover:opacity-80"
          >
            <BrandLogo size="sm" alt="" />
            <span className="text-sm font-bold text-ink">{BRAND_NAME}</span>
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {organization ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                iconLeft={<IconLogout className="h-3.5 w-3.5" />}
              >
                Quitter ce magasin
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={onGoHome}>
              Boutique en ligne
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onOpenCaisse}
              iconRight={<IconArrowRight className="h-3.5 w-3.5" />}
            >
              Ouvrir la caisse
            </Button>
          </div>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Suspense
          fallback={
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
            </div>
          }
        >
          <SubscriptionView />
        </Suspense>
      </main>
    </div>
  )
}
