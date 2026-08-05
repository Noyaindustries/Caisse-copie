import { StorefrontQrCode } from '../StorefrontQrCode'
import type { SubscriptionSnapshot } from '../../lib/subscription/types'
import { planLabel, statusLabel } from '../../lib/subscription/plans'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import {
  IconCard,
  IconKey,
  IconStore,
  IconSync,
  IconSparkles,
} from '../../ui/icons'
import { formatDate, formatFcfa, PLAN_ACCENT } from './subscriptionUi'

type Props = {
  subscription: SubscriptionSnapshot
  usable: boolean
  online: boolean
  trialDays: number
  expiryIso: string | null
  daysLeft: number | null
  boutiqueLink: string | null
  stripePortalEnabled: boolean
  portalBusy: boolean
  publishBusy: boolean
  lastPublishedAt: string | null
  canPublish: boolean
  onRefresh: () => void
  onPortal: () => void
  onCopy: (text: string, label: string) => void
  onPublish: () => void
}

function TrialRing({
  daysLeft,
  totalDays,
  label,
}: {
  daysLeft: number | null
  totalDays: number
  label: string
}) {
  const pct =
    daysLeft !== null && totalDays > 0
      ? Math.min(100, Math.max(0, ((totalDays - daysLeft) / totalDays) * 100))
      : 0
  const r = 44
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c

  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      <svg className="-rotate-90" width="112" height="112" viewBox="0 0 112 112" aria-hidden>
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="8"
        />
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke="url(#sub-ring-grad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700"
        />
        <defs>
          <linearGradient id="sub-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8c76a" />
            <stop offset="100%" stopColor="#b8922e" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-2xl font-bold text-white">
          {daysLeft !== null ? daysLeft : '—'}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>
    </div>
  )
}

export function SubscriptionHero({
  subscription,
  usable,
  online,
  trialDays,
  expiryIso,
  daysLeft,
  boutiqueLink,
  stripePortalEnabled,
  portalBusy,
  publishBusy,
  lastPublishedAt,
  canPublish,
  onRefresh,
  onPortal,
  onCopy,
  onPublish,
}: Props) {
  const accent = PLAN_ACCENT[subscription.planId]
  const isTrial = subscription.status === 'trialing'
  const ringTotal = isTrial ? trialDays : 30

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(145deg,#14110c_0%,#1c1812_45%,#2a2116_100%)] text-white shadow-[0_28px_70px_-28px_rgba(40,30,10,0.55)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `radial-gradient(circle at 12% 18%, rgba(184,146,46,0.35) 0%, transparent 42%),
            radial-gradient(circle at 88% 12%, rgba(232,199,106,0.18) 0%, transparent 40%),
            radial-gradient(circle at 50% 100%, rgba(120,90,30,0.25) 0%, transparent 48%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[rgba(232,199,106,0.35)] bg-[rgba(184,146,46,0.15)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#e8c76a]">
                Votre abonnement
              </span>
              <Badge
                tone={usable ? 'success' : 'danger'}
                className="border-white/10 bg-white/10 text-white backdrop-blur-sm"
                dot
              >
                {statusLabel(subscription.status)}
              </Badge>
            </div>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Plan{' '}
              <span className="bg-linear-to-r from-[#fff8e7] via-[#e8c76a] to-[#b8922e] bg-clip-text text-transparent">
                {planLabel(subscription.planId)}
              </span>
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-300">
              <span className="font-semibold text-white">{subscription.name}</span>
              {' · '}
              {subscription.email}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold', accent.badge)}>
                {subscription.plan.maxStores} magasin
                {subscription.plan.maxStores > 1 ? 's' : ''}
              </span>
              <span className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold', accent.badge)}>
                {subscription.plan.maxStaff} utilisateurs
              </span>
              <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">
                {formatFcfa(subscription.plan.priceFcfa)}/mois
              </span>
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="border-white/15 bg-white/10 text-white hover:bg-white/20"
                onClick={onRefresh}
                disabled={!online}
                iconLeft={<IconSync className="h-4 w-4" />}
              >
                Actualiser
              </Button>
              {stripePortalEnabled ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={onPortal}
                  disabled={portalBusy}
                  iconLeft={<IconCard className="h-4 w-4" />}
                >
                  {portalBusy ? 'Ouverture…' : 'Portail carte Stripe'}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-4 rounded-2xl border border-[rgba(232,199,106,0.22)] bg-black/25 p-6 backdrop-blur-md sm:flex-row xl:flex-col">
            <TrialRing
              daysLeft={daysLeft}
              totalDays={ringTotal}
              label={isTrial ? 'jours d’essai' : 'jours restants'}
            />
            <div className="text-center sm:text-left xl:text-center">
              <p className="text-sm font-semibold text-white">
                {isTrial ? 'Période d’essai en cours' : 'Période de facturation'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {expiryIso ? `Échéance le ${formatDate(expiryIso)}` : 'Date non définie'}
              </p>
              {!usable ? (
                <p className="mt-2 text-xs font-medium text-amber-300">
                  Renouvelez pour réactiver tous les modules.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {subscription.storeCode ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 backdrop-blur-md">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b8922e]/20 text-[#e8c76a]">
                  <IconStore className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Code magasin
                  </p>
                  <p className="truncate font-mono text-lg font-bold tracking-widest">
                    {subscription.storeCode}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => onCopy(subscription.storeCode!, 'Code magasin copié')}
              >
                Copier
              </Button>
            </div>
          ) : null}
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 backdrop-blur-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
              <IconKey className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Clé de licence
              </p>
              <p className="truncate font-mono text-sm text-slate-200">
                {subscription.licenseKey}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto shrink-0 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => onCopy(subscription.licenseKey, 'Clé de licence copiée')}
            >
              Copier
            </Button>
          </div>
        </div>

        {boutiqueLink && (subscription.storeSlug || subscription.storeCode) ? (
          <div className="mt-4 rounded-2xl border border-[rgba(232,199,106,0.28)] bg-[rgba(184,146,46,0.12)] p-5 backdrop-blur-md">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <IconSparkles className="h-4 w-4 text-[#e8c76a]" />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#e8c76a]/90">
                    Boutique en ligne
                  </p>
                </div>
                <p className="mt-2 truncate font-mono text-sm text-white">{boutiqueLink}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#f5e6c0]/80">
                  Catalogue et promotions synchronisés automatiquement avec la
                  boutique en ligne
                  {lastPublishedAt
                    ? ` · dernière publication ${formatDate(lastPublishedAt)}`
                    : ''}
                  .
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[#f5e6c0] hover:bg-white/10 hover:text-white"
                    onClick={() => onCopy(boutiqueLink, 'Lien boutique copié')}
                  >
                    Copier le lien
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="border-[rgba(232,199,106,0.35)] bg-white/10 text-white hover:bg-white/20"
                    disabled={!canPublish || publishBusy}
                    onClick={onPublish}
                  >
                    {publishBusy ? 'Publication…' : 'Republier maintenant'}
                  </Button>
                </div>
              </div>
              <StorefrontQrCode
                url={boutiqueLink}
                storeCode={
                  subscription.storeSlug ||
                  subscription.storeCode ||
                  subscription.storefrontKey ||
                  'boutique'
                }
                storeName={subscription.name}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
