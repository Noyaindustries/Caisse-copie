import { useEffect, useRef, useState } from 'react'
import { MarketingSectionHeader } from './MarketingSectionHeader'
import { Reveal } from './Reveal'
import { fetchPlans } from '../../lib/subscription/api'
import { formatTrialPeriod } from '../../lib/subscription/plans'
import {
  moduleCountForPlan,
  modulesForPlan,
  platformFeaturesForPlan,
} from '../../lib/subscription/moduleCatalog'
import type { PlanDefinition, PlanId } from '../../lib/subscription/types'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import {
  IconArrowRight,
  IconCheck,
  IconSparkles,
  IconStar,
  IconStore,
  IconZap,
} from '../../ui/icons'

const PLAN_ACCENT: Record<
  PlanId,
  { ring: string; gradient: string; glow: string; badge: string; icon: string }
> = {
  starter: {
    ring: 'ring-slate-300/60',
    gradient: 'from-slate-50 to-white',
    glow: 'from-slate-400/15',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: 'text-slate-500',
  },
  pro: {
    ring: 'ring-violet-400/70',
    gradient: 'from-violet-50/90 via-white to-indigo-50/50',
    glow: 'from-violet-500/20',
    badge: 'bg-violet-100 text-violet-800 border-violet-200',
    icon: 'text-violet-600',
  },
  business: {
    ring: 'ring-amber-400/60',
    gradient: 'from-amber-50/70 via-white to-orange-50/40',
    glow: 'from-amber-400/20',
    badge: 'bg-amber-50 text-amber-900 border-amber-200',
    icon: 'text-amber-600',
  },
}

const DEFAULT_PLANS: PlanDefinition[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Caisse, catalogue et stocks pour un point de vente.',
    priceFcfa: 9_900,
    maxStores: 1,
    maxStaff: 3,
    features: [],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Modules avancés pour restaurants et commerces actifs.',
    priceFcfa: 24_900,
    maxStores: 3,
    maxStaff: 10,
    features: [],
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Multi-sites, CRM, RH et intégrations partenaires.',
    priceFcfa: 49_900,
    maxStores: 20,
    maxStaff: 50,
    features: [],
  },
]

function formatFcfa(amount: number): string {
  return new Intl.NumberFormat('fr-CI', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(amount)
}

function PricingCard({
  plan,
  featured,
  onSelect,
}: {
  plan: PlanDefinition
  featured: boolean
  onSelect: () => void
}) {
  const accent = PLAN_ACCENT[plan.id]
  const includedModules = modulesForPlan(plan.id)
  const includedPlatform = platformFeaturesForPlan(plan.id)
  const totalFeatures = moduleCountForPlan(plan.id)

  return (
    <article
      className={cn(
        'marketing-card-premium group relative flex h-full flex-col overflow-hidden rounded-3xl',
        featured && 'lg:-mt-3 lg:mb-3 lg:scale-[1.02] ring-2 ring-offset-2',
        featured && accent.ring,
      )}
    >
      <div className={cn('pointer-events-none absolute inset-0 bg-linear-to-br', accent.gradient)} />
      <div className={cn('pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-linear-to-br blur-3xl', accent.glow)} />

      {featured ? (
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-violet-500/30">
            <IconStar className="h-3 w-3 fill-current" />
            Le plus choisi
          </span>
        </div>
      ) : null}

      <div className="relative flex flex-1 flex-col p-6 pt-8">
        <div className="flex items-center gap-2">
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl border border-white/80 bg-white/80 shadow-sm', accent.icon)}>
            {plan.id === 'business' ? <IconZap className="h-4 w-4" /> : plan.id === 'pro' ? <IconSparkles className="h-4 w-4" /> : <IconStore className="h-4 w-4" />}
          </span>
          <h3 className="text-xl font-bold tracking-tight text-ink">{plan.name}</h3>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{plan.description}</p>
        <p className="mt-5 font-mono text-3xl font-bold tracking-tight text-ink">
          {formatFcfa(plan.priceFcfa)}
          <span className="text-sm font-normal text-ink-subtle"> /mois</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={cn('rounded-lg border px-2 py-0.5 text-[11px] font-semibold', accent.badge)}>
            {plan.maxStores} magasin{plan.maxStores > 1 ? 's' : ''}
          </span>
          <span className={cn('rounded-lg border px-2 py-0.5 text-[11px] font-semibold', accent.badge)}>
            {plan.maxStaff} utilisateurs
          </span>
        </div>
        <p className="mt-4 text-xs font-semibold text-ink-subtle">{totalFeatures} fonctionnalités incluses</p>
        <ul className="mt-3 max-h-56 flex-1 space-y-2 overflow-y-auto border-t border-border/40 pt-4 pr-1">
          {includedModules.map((m) => (
            <li key={m.id} className="flex items-start gap-2 text-sm text-ink-muted">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <IconCheck className="h-3 w-3" strokeWidth={3} />
              </span>
              {m.label}
            </li>
          ))}
          {includedPlatform.map((f) => (
            <li key={f.id} className="flex items-start gap-2 text-sm text-ink-muted">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                <IconCheck className="h-3 w-3" strokeWidth={3} />
              </span>
              {f.label}
            </li>
          ))}
        </ul>
        <Button type="button" className="mt-6 w-full" variant={featured ? 'primary' : 'secondary'} onClick={onSelect} iconRight={<IconArrowRight className="h-4 w-4" />}>
          Essayer {plan.name}
        </Button>
      </div>
    </article>
  )
}

export function MarketingPricingSection({
  onSelectPlan,
  scrollToPricing,
}: {
  onSelectPlan: (planId: PlanId) => void
  scrollToPricing?: boolean
}) {
  const pricingRef = useRef<HTMLElement>(null)
  const [plans, setPlans] = useState<PlanDefinition[]>([])
  const [trialDays, setTrialDays] = useState(30)

  useEffect(() => {
    void fetchPlans()
      .then((data) => {
        setPlans(data.plans)
        setTrialDays(data.trialDays)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (scrollToPricing && pricingRef.current) {
      pricingRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [scrollToPricing])

  const displayPlans = plans.length > 0 ? plans : DEFAULT_PLANS

  return (
    <section ref={pricingRef} id="tarifs" className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.12),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-violet-50/40 via-transparent to-amber-50/30" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <MarketingSectionHeader
            eyebrow="Abonnement"
            title={
              <>
                Investissez dans votre{' '}
                <span className="bg-linear-to-r from-accent to-violet-600 bg-clip-text text-transparent">croissance</span>
              </>
            }
            description={`Essai ${formatTrialPeriod(trialDays)} · Tous les modules listés inclus · Sans engagement`}
          />
        </Reveal>
        <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:gap-5 lg:pt-4">
          {displayPlans.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 80}>
              <PricingCard
                plan={plan}
                featured={plan.id === 'pro'}
                onSelect={() => onSelectPlan(plan.id)}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
