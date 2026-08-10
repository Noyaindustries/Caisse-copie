import { Suspense, lazy, useEffect, useState } from 'react'
import { clearStaffSession } from '../auth/session'
import { BrandLogo } from '../components/BrandLogo'
import { OfflineBanner } from '../components/OfflineBanner'
import { useSubscription } from '../context/SubscriptionContext'
import {
  getCachedOrgWorkspaceBranding,
  ORG_BRANDING_CHANGED_EVENT,
  resolveOrgWorkspaceBranding,
  type OrgWorkspaceBranding,
} from '../lib/orgWorkspaceBranding'
import { planLabel, statusLabel } from '../lib/subscription/plans'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import {
  IconArrowRight,
  IconCaisse,
  IconLogout,
  IconStore,
  IconSync,
} from '../ui/icons'

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
  const { organization, subscription, usable, refresh } = useSubscription()
  const [orgBranding, setOrgBranding] = useState<OrgWorkspaceBranding>(() =>
    getCachedOrgWorkspaceBranding(),
  )

  useEffect(() => {
    let cancelled = false
    void resolveOrgWorkspaceBranding().then((next) => {
      if (!cancelled) setOrgBranding(next)
    })
    const onChanged = () => setOrgBranding(getCachedOrgWorkspaceBranding())
    window.addEventListener(ORG_BRANDING_CHANGED_EVENT, onChanged)
    return () => {
      cancelled = true
      window.removeEventListener(ORG_BRANDING_CHANGED_EVENT, onChanged)
    }
  }, [])

  const handleDisconnect = () => {
    const ok = window.confirm(
      'Quitter ce magasin sur cet appareil ? Vous devrez vous réinscrire ou saisir à nouveau le code magasin pour retrouver l’abonnement.',
    )
    if (!ok) return
    clearStaffSession()
    onDisconnect()
  }

  const orgName = organization?.name ?? subscription?.name ?? 'Votre magasin'
  const headerTitle =
    orgBranding.displayName?.trim() || orgName
  const workspaceLogo = orgBranding.logoUrl?.trim() || undefined
  const planName = subscription ? planLabel(subscription.planId) : null
  const status = subscription ? statusLabel(subscription.status) : null

  return (
    <div className="relative flex min-h-svh flex-col overflow-x-hidden bg-[#f7f3eb]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 10% -10%, rgba(184,146,46,0.18), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 0%, rgba(15,23,42,0.08), transparent 50%), linear-gradient(180deg, #ebe4d6 0%, #f7f3eb 70%)',
        }}
      />
      {!online ? <OfflineBanner /> : null}

      <header className="relative z-20 border-b border-[rgba(184,146,46,0.18)] bg-[#fffcf6]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo
              size="sm"
              alt={headerTitle}
              src={workspaceLogo}
              ring="gold"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-ink">
                {headerTitle}
              </p>
              <p className="truncate text-[11px] text-ink-subtle">
                Espace propriétaire · Abonnement
              </p>
            </div>
          </div>
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onGoHome}
              iconLeft={<IconStore className="h-3.5 w-3.5" />}
            >
              Aperçu boutique
            </Button>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={onOpenCaisse}
              iconRight={<IconArrowRight className="h-3.5 w-3.5" />}
            >
              Ouvrir la caisse
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <section className="mx-auto max-w-7xl px-4 pb-2 pt-8 sm:px-6 sm:pt-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7b28]">
                Bienvenue
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                {orgName}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
                Gérez votre plan, votre facturation et votre boutique depuis cet
                espace. Lancez la caisse quand vous êtes prêt.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {planName ? (
                  <Badge tone="accent" className="border-[rgba(184,146,46,0.35)] bg-[#f7f0e3] text-[#7a5f1c]">
                    Plan {planName}
                  </Badge>
                ) : null}
                {status ? (
                  <Badge tone={usable ? 'success' : 'warning'} dot>
                    {status}
                  </Badge>
                ) : null}
                {subscription?.storeCode ? (
                  <span className="rounded-full border border-border bg-white/80 px-3 py-1 font-mono text-[11px] font-semibold tracking-wider text-ink-muted">
                    {subscription.storeCode}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[28rem]">
              <button
                type="button"
                onClick={onOpenCaisse}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-[rgba(184,146,46,0.28)] bg-[linear-gradient(145deg,#fffefb,#f7f0e3)] p-4 text-left shadow-[0_12px_32px_-20px_rgba(120,90,20,0.35)] transition hover:brightness-[1.02]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b8922e] text-white">
                  <IconCaisse className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-bold text-ink">Caisse</span>
                <span className="text-[11px] leading-snug text-ink-subtle">
                  Encaisser · session PIN
                </span>
              </button>
              <button
                type="button"
                onClick={onGoHome}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-white/90 p-4 text-left shadow-sm transition hover:border-[rgba(184,146,46,0.35)] hover:bg-[#fffcf6]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                  <IconStore className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-bold text-ink">Boutique</span>
                <span className="text-[11px] leading-snug text-ink-subtle">
                  Aperçu client
                </span>
              </button>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={!online}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-white/90 p-4 text-left shadow-sm transition hover:border-[rgba(184,146,46,0.35)] hover:bg-[#fffcf6] disabled:opacity-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                  <IconSync className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-bold text-ink">Actualiser</span>
                <span className="text-[11px] leading-snug text-ink-subtle">
                  État du plan
                </span>
              </button>
            </div>
          </div>
        </section>

        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[rgba(184,146,46,0.25)] border-t-[#b8922e]" />
            </div>
          }
        >
          <SubscriptionView />
        </Suspense>
      </main>
    </div>
  )
}
