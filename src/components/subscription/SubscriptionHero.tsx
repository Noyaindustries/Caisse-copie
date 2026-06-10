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

        <circle cx="56" cy="56" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />

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

            <stop offset="0%" stopColor="#818cf8" />

            <stop offset="100%" stopColor="#38bdf8" />

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

    <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#060a14] via-[#0c1222] to-[#1a1040] text-white shadow-[0_32px_80px_-24px_rgba(15,23,42,0.65)]">

      <div

        className="pointer-events-none absolute inset-0 opacity-40"

        style={{

          backgroundImage: `radial-gradient(circle at 15% 20%, rgba(99,102,241,0.45) 0%, transparent 42%),

            radial-gradient(circle at 85% 15%, rgba(20,99,255,0.35) 0%, transparent 38%),

            radial-gradient(circle at 50% 100%, rgba(168,85,247,0.2) 0%, transparent 45%)`,

        }}

      />

      <div className="marketing-grid-pattern pointer-events-none absolute inset-0 opacity-[0.06]" />

      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />



      <div className="relative px-6 py-10 sm:px-10 sm:py-12">

        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">

          <div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-2">

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300">

                Espace abonnement

              </span>

              <Badge

                tone={usable ? 'success' : 'danger'}

                className="border-white/10 bg-white/10 text-white backdrop-blur-sm"

                dot

              >

                {statusLabel(subscription.status)}

              </Badge>

            </div>



            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight">

              Plan{' '}

              <span className="bg-linear-to-r from-white via-indigo-100 to-violet-300 bg-clip-text text-transparent">

                {planLabel(subscription.planId)}

              </span>

            </h1>

            <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-300">

              <span className="font-semibold text-white">{subscription.name}</span>

              {' · '}

              {subscription.email}

            </p>



            <div className="mt-6 flex flex-wrap gap-2">

              <span className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold', accent.badge)}>

                {subscription.plan.maxStores} magasin{subscription.plan.maxStores > 1 ? 's' : ''}

              </span>

              <span className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold', accent.badge)}>

                {subscription.plan.maxStaff} utilisateurs

              </span>

              <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">

                {formatFcfa(subscription.plan.priceFcfa)}/mois

              </span>

            </div>



            <div className="mt-8 flex flex-wrap gap-2">

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



          <div className="flex shrink-0 flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md sm:flex-row xl:flex-col">

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

                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">

                  <IconStore className="h-5 w-5" />

                </span>

                <div className="min-w-0">

                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Code magasin</p>

                  <p className="truncate font-mono text-lg font-bold tracking-widest">{subscription.storeCode}</p>

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

              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Clé de licence</p>

              <p className="truncate font-mono text-sm text-slate-200">{subscription.licenseKey}</p>

            </div>

          </div>

        </div>



        {boutiqueLink && subscription.storeCode ? (

          <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5 backdrop-blur-md">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

              <div className="min-w-0 flex-1">

                <div className="flex items-center gap-2">

                  <IconSparkles className="h-4 w-4 text-emerald-300" />

                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-200/90">

                    Boutique en ligne

                  </p>

                </div>

                <p className="mt-2 truncate font-mono text-sm text-white">{boutiqueLink}</p>

                <p className="mt-2 text-xs leading-relaxed text-emerald-100/75">

                  Partagez le lien ou le QR code. Publiez le menu après chaque mise à jour du catalogue.

                </p>

                <div className="mt-4 flex flex-wrap gap-2">

                  <Button

                    type="button"

                    variant="ghost"

                    size="sm"

                    className="text-emerald-100 hover:bg-white/10 hover:text-white"

                    onClick={() => onCopy(boutiqueLink, 'Lien boutique copié')}

                  >

                    Copier le lien

                  </Button>

                  <Button

                    type="button"

                    variant="secondary"

                    size="sm"

                    className="border-emerald-300/30 bg-white/10 text-white hover:bg-white/20"

                    disabled={!canPublish || publishBusy}

                    onClick={onPublish}

                  >

                    {publishBusy ? 'Publication…' : 'Publier le menu'}

                  </Button>

                </div>

              </div>

              <StorefrontQrCode

                url={boutiqueLink}

                storeCode={subscription.storeCode}

                storeName={subscription.name}

              />

            </div>

          </div>

        ) : null}

      </div>

    </section>

  )

}


