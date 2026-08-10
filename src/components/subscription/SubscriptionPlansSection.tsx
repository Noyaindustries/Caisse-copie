import { useMemo, useState } from 'react'

import {
  getAllModules,
  getPlatformFeatures,
  moduleIncludedInPlan,
  moduleCountForPlan,
} from '../../lib/subscription/moduleCatalog'

import { formatTrialPeriod, planLabel, PLAN_ORDER } from '../../lib/subscription/plans'

import type { PlanDefinition, PlanId } from '../../lib/subscription/types'

import { Badge } from '../../ui/Badge'

import { Button } from '../../ui/Button'

import { cn } from '../../ui/cn'

import {

  IconCard,

  IconCheck,

  IconChevronDown,

  IconMobile,

  IconSparkles,

  IconStar,

  IconStore,

  IconZap,

} from '../../ui/icons'

import { formatFcfa, PLAN_ACCENT } from './subscriptionUi'



function PlanCard({

  plan,

  currentPlanId,

  isCurrent,

  canPayOnline,

  mobileMoneyEnabled,

  stripeEnabled,

  busyPlan,

  onMobilePay,

  onCardPay,

}: {

  plan: PlanDefinition

  currentPlanId: PlanId

  isCurrent: boolean

  canPayOnline: boolean

  mobileMoneyEnabled: boolean

  stripeEnabled: boolean

  busyPlan: PlanId | null

  onMobilePay: () => void

  onCardPay: () => void

}) {

  const accent = PLAN_ACCENT[plan.id]

  const isFeatured = plan.id === 'pro'

  const isUpgrade =

    PLAN_ORDER.indexOf(plan.id) > PLAN_ORDER.indexOf(currentPlanId)

  const featureCount = moduleCountForPlan(plan.id)



  return (

    <article

      className={cn(

        'group relative flex h-full flex-col rounded-2xl border border-border/60 bg-white shadow-[0_8px_40px_-12px_rgba(23,32,51,0.15)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_56px_-16px_rgba(23,32,51,0.22)]',

        isCurrent && `ring-2 ring-offset-2 ${accent.ring}`,

        isFeatured && !isCurrent && 'ring-1 ring-violet-200/80',

      )}

    >

      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">

        <div className={cn('absolute inset-0 bg-linear-to-br opacity-90', accent.gradient)} />

        <div

          className={cn(

            'absolute -right-16 -top-16 h-48 w-48 rounded-full bg-linear-to-br blur-3xl',

            accent.glow,

          )}

        />

      </div>



      {isFeatured ? (

        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">

          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-violet-500/30">

            <IconStar className="h-3 w-3 fill-amber-300 text-amber-300" />

            Recommandé

          </span>

        </div>

      ) : null}



      <div className="relative flex flex-1 flex-col p-6 pt-8">

        <div className="flex items-start justify-between gap-3">

          <div>

            <div className="flex items-center gap-2">

              <span

                className={cn(

                  'flex h-10 w-10 items-center justify-center rounded-xl border bg-white/90 shadow-sm',

                  accent.icon,

                )}

              >

                {plan.id === 'business' ? (

                  <IconZap className="h-4 w-4" />

                ) : plan.id === 'pro' ? (

                  <IconSparkles className="h-4 w-4" />

                ) : (

                  <IconStore className="h-4 w-4" />

                )}

              </span>

              <div>

                <h3 className="text-xl font-bold tracking-tight text-ink">{plan.name}</h3>

                <p className="text-[11px] font-semibold text-ink-subtle">{featureCount} fonctionnalités</p>

              </div>

            </div>

            <p className="mt-3 text-sm leading-relaxed text-ink-muted">{plan.description}</p>

          </div>

          {isCurrent ? (

            <Badge tone="success" dot>

              Actuel

            </Badge>

          ) : isUpgrade ? (

            <Badge tone="violet">Upgrade</Badge>

          ) : null}

        </div>



        <div className="mt-6 flex items-baseline gap-1">

          <span className="font-mono text-3xl font-bold tracking-tight text-ink">

            {formatFcfa(plan.priceFcfa)}

          </span>

          <span className="text-sm font-medium text-ink-subtle">/ mois</span>

        </div>



        <div className="mt-4 flex flex-wrap gap-2">

          <span className={cn('rounded-lg border px-2.5 py-1 text-[11px] font-semibold', accent.badge)}>

            {plan.maxStores} magasin{plan.maxStores > 1 ? 's' : ''}

          </span>

          <span className={cn('rounded-lg border px-2.5 py-1 text-[11px] font-semibold', accent.badge)}>

            {plan.maxStaff} utilisateurs

          </span>

        </div>



        <ul className="mt-6 flex-1 space-y-2.5 border-t border-border/50 pt-5">

          {plan.features.slice(0, 6).map((f) => (

            <li key={f} className="flex items-start gap-2.5 text-sm text-ink-muted">

              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">

                <IconCheck className="h-3 w-3" strokeWidth={3} />

              </span>

              {f}

            </li>

          ))}

          {plan.features.length > 6 ? (

            <li className="text-xs font-medium text-ink-subtle">

              + {plan.features.length - 6} autres avantages

            </li>

          ) : null}

        </ul>



        <div className="mt-6 space-y-2">

          {isCurrent ? (

            <Button type="button" variant="secondary" className="w-full" disabled>

              Plan en cours

            </Button>

          ) : canPayOnline ? (

            <>

              {mobileMoneyEnabled ? (

                <Button

                  type="button"

                  className="w-full"

                  variant={isUpgrade ? 'accent' : 'primary'}

                  onClick={onMobilePay}

                  iconLeft={<IconMobile className="h-4 w-4" />}

                >

                  Payer en mobile money

                </Button>

              ) : null}

              {stripeEnabled ? (

                <Button

                  type="button"

                  className="w-full"

                  variant={mobileMoneyEnabled ? 'secondary' : isUpgrade ? 'primary' : 'secondary'}

                  disabled={busyPlan !== null}

                  onClick={onCardPay}

                  iconLeft={<IconCard className="h-4 w-4" />}

                  loading={busyPlan === plan.id}

                >

                  {busyPlan === plan.id ? 'Redirection…' : 'Carte bancaire'}

                </Button>

              ) : null}

            </>

          ) : (

            <p className="rounded-xl bg-surface-sunken px-3 py-2 text-center text-xs text-ink-subtle">

              Paiement en ligne non configuré sur ce serveur.

            </p>

          )}

        </div>

      </div>

    </article>

  )

}



function getCompareRows() {
  return [
    ...getAllModules().slice(0, 12).map((m) => ({
      id: m.id,
      label: m.label,
      type: 'module' as const,
      minPlan: m.minPlan,
    })),
    ...getPlatformFeatures().slice(0, 4).map((f) => ({
      id: f.id,
      label: f.label,
      type: 'platform' as const,
      minPlan: f.minPlan,
    })),
  ]
}



export function SubscriptionPlansSection({

  plans,

  currentPlanId,

  trialDays,

  canPayOnline,

  mobileMoneyEnabled,

  stripeEnabled,

  busyPlan,

  onMobilePay,

  onCardPay,

}: {

  plans: PlanDefinition[]

  currentPlanId: PlanId

  trialDays: number

  canPayOnline: boolean

  mobileMoneyEnabled: boolean

  stripeEnabled: boolean

  busyPlan: PlanId | null

  onMobilePay: (plan: PlanDefinition) => void

  onCardPay: (planId: PlanId) => void

}) {

  const [matrixOpen, setMatrixOpen] = useState(false)



  const recommended = useMemo(() => {

    if (currentPlanId === 'starter') return 'pro'

    if (currentPlanId === 'pro') return 'business'

    return null

  }, [currentPlanId])



  return (

    <section id="sub-plans" className="scroll-mt-24">

      <div className="mb-10 text-center">

        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-subtle">Formules</p>

        <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl lg:text-4xl">

          Investissez dans la croissance de votre commerce

        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">

          Essai gratuit de {formatTrialPeriod(trialDays)} · Sans engagement · Changez de plan à tout moment.

          Chaque paiement active le palier pour 30 jours.

        </p>

      </div>



      {recommended ? (

        <div className="mb-8 flex flex-col items-start gap-3 rounded-2xl border border-violet-200/80 bg-linear-to-r from-violet-50/90 via-white to-indigo-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-3">

            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">

              <IconSparkles className="h-5 w-5" />

            </span>

            <div>

              <p className="font-semibold text-ink">Passez au plan {planLabel(recommended)}</p>

              <p className="text-sm text-ink-muted">

                Débloquez plus de modules et de capacités pour votre activité.

              </p>

            </div>

          </div>

          <Badge tone="violet">Conseillé pour vous</Badge>

        </div>

      ) : null}



      {mobileMoneyEnabled ? (

        <div className="mb-8 overflow-hidden rounded-2xl border border-orange-200/60 bg-linear-to-r from-orange-50/90 via-white to-amber-50/60">

          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 shadow-sm">

              <IconMobile className="h-5 w-5" />

            </div>

            <div className="flex-1">

              <p className="font-semibold text-ink">Mobile money Côte d’Ivoire</p>

              <p className="mt-1 text-sm text-ink-muted">

                Orange Money · Wave · MTN MoMo · Moov — Wave en API directe, autres via CinetPay.

              </p>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              {(['Orange', 'MTN', 'Moov'] as const).map((op) => (

                <span

                  key={op}

                  className="rounded-full border border-orange-200/80 bg-white px-3 py-1 text-[11px] font-bold text-orange-800"

                >

                  {op}

                </span>

              ))}

              <img
                src="/branding/wave-logo.png"
                alt="Wave"
                className="h-8 w-8 rounded-lg object-cover shadow-sm ring-1 ring-orange-200/80"
                title="Wave — paiement direct"
              />

            </div>

          </div>

        </div>

      ) : null}



      <div className="grid gap-6 overflow-visible pt-5 lg:grid-cols-3 lg:gap-5 lg:pt-6">

        {plans.map((plan) => (

          <PlanCard

            key={plan.id}

            plan={plan}

            currentPlanId={currentPlanId}

            isCurrent={plan.id === currentPlanId}

            canPayOnline={canPayOnline}

            mobileMoneyEnabled={mobileMoneyEnabled}

            stripeEnabled={stripeEnabled}

            busyPlan={busyPlan}

            onMobilePay={() => onMobilePay(plan)}

            onCardPay={() => onCardPay(plan.id)}

          />

        ))}

      </div>



      <div className="mt-12 overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">

        <button

          type="button"

          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-surface-muted/40"

          onClick={() => setMatrixOpen((o) => !o)}

        >

          <div>

            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">

              Comparaison détaillée

            </p>

            <p className="mt-1 font-semibold text-ink">Matrice des modules par plan</p>

          </div>

          <IconChevronDown

            className={cn('h-5 w-5 shrink-0 text-ink-subtle transition', matrixOpen && 'rotate-180')}

          />

        </button>

        {matrixOpen ? (

          <div className="overflow-x-auto border-t border-border/50">

            <table className="w-full min-w-[640px] text-left text-sm">

              <thead>

                <tr className="border-b border-border/50 bg-surface-muted/50">

                  <th className="px-6 py-3 font-semibold text-ink-muted">Fonctionnalité</th>

                  {PLAN_ORDER.map((p) => (

                    <th key={p} className="px-4 py-3 text-center font-bold text-ink">

                      {p.charAt(0).toUpperCase() + p.slice(1)}

                    </th>

                  ))}

                </tr>

              </thead>

              <tbody>

                {getCompareRows().map((row) => (

                  <tr key={row.id} className="border-b border-border/40 last:border-0">

                    <td className="px-6 py-3 text-ink-muted">{row.label}</td>

                    {PLAN_ORDER.map((planId) => {

                      const included = moduleIncludedInPlan(row.minPlan, planId)

                      return (

                        <td key={planId} className="px-4 py-3 text-center">

                          {included ? (

                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">

                              <IconCheck className="h-3.5 w-3.5" strokeWidth={3} />

                            </span>

                          ) : (

                            <span className="text-ink-subtle">—</span>

                          )}

                        </td>

                      )

                    })}

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        ) : null}

      </div>

    </section>

  )

}


