import { useEffect, useRef, useState } from 'react'
import { MarketingFaqAccordion } from '../components/marketing/MarketingFaqAccordion'
import { MarketingImage } from '../components/marketing/MarketingImage'
import { MarketingHero } from '../components/marketing/MarketingHero'
import { MarketingIntegrationsStrip } from '../components/marketing/MarketingIntegrationsStrip'
import { MarketingScrollProgress } from '../components/marketing/MarketingScrollProgress'
import { MarketingSocialProof } from '../components/marketing/MarketingSocialProof'
import { MarketingStickyCta } from '../components/marketing/MarketingStickyCta'
import { MarketingUseCases } from '../components/marketing/MarketingUseCases'
import { MarketingModulesSection } from '../components/MarketingModulesSection'
import { Reveal } from '../components/marketing/Reveal'
import { BRAND_NAME } from '../brand'
import { BrandLogo } from '../components/BrandLogo'
import { fetchPlans } from '../lib/subscription/api'
import { formatTrialPeriod } from '../lib/subscription/plans'
import {
  moduleCountForPlan,
  modulesForPlan,
  platformFeaturesForPlan,
} from '../lib/subscription/moduleCatalog'
import { MARKETING_IMAGES } from '../lib/marketingImages'
import { signupUrl, ROUTES } from '../lib/siteRoutes'
import type { PlanDefinition, PlanId } from '../lib/subscription/types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import {
  IconArrowRight,
  IconCheck,
  IconSparkles,
  IconStar,
  IconStore,
  IconZap,
} from '../ui/icons'

type Navigate = (to: string) => void

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

const STEPS = [
  { n: '01', title: 'Créez votre magasin', desc: 'Choisissez Starter, Pro ou Business. Essai 1 mois inclus.' },
  { n: '02', title: 'Déployez vos postes', desc: 'Code magasin court pour chaque tablette ou caisse supplémentaire.' },
  { n: '03', title: 'Encaissez & évoluez', desc: 'Mobile money ou carte. Changez de plan à tout moment.' },
] as const

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
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_8px_40px_-12px_rgba(23,32,51,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_56px_-16px_rgba(23,32,51,0.28)]',
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
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl border bg-white/80 shadow-sm', accent.icon)}>
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

export function MarketingSiteView({
  onNavigate,
  scrollToPricing,
}: {
  onNavigate: Navigate
  scrollToPricing?: boolean
}) {
  const pricingRef = useRef<HTMLElement>(null)
  const [plans, setPlans] = useState<PlanDefinition[]>([])
  const [mobileMoney, setMobileMoney] = useState(false)
  const [trialDays, setTrialDays] = useState(30)
  const [navScrolled, setNavScrolled] = useState(false)

  useEffect(() => {
    void fetchPlans()
      .then((data) => {
        setPlans(data.plans)
        setMobileMoney(data.mobileMoneyEnabled)
        setTrialDays(data.trialDays)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (scrollToPricing && pricingRef.current) {
      pricingRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [scrollToPricing])

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const displayPlans = plans.length > 0 ? plans : DEFAULT_PLANS
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="min-h-svh bg-[#f8f9fc] pb-20 text-ink sm:pb-0">
      <MarketingScrollProgress />

      <header
        className={cn(
          'fixed inset-x-0 top-0.5 z-50 transition duration-300',
          navScrolled ? 'border-b border-border/60 bg-white/90 shadow-sm backdrop-blur-xl' : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <button type="button" onClick={() => onNavigate(ROUTES.home)} className="flex items-center gap-2.5">
            <BrandLogo size="md" alt={BRAND_NAME} ring={navScrolled ? 'subtle' : 'light'} />
            <span className={cn('hidden font-bold tracking-tight sm:inline', !navScrolled && 'text-white')}>
              CaisseCI
            </span>
          </button>
          <nav className={cn('hidden items-center gap-7 text-sm font-medium md:flex', navScrolled ? 'text-ink-muted' : 'text-slate-300')}>
            {[
              { label: 'Modules', action: () => scrollTo('fonctionnalites') },
              { label: 'Secteurs', action: () => scrollTo('secteurs') },
              { label: 'Tarifs', action: () => pricingRef.current?.scrollIntoView({ behavior: 'smooth' }) },
              { label: 'FAQ', action: () => scrollTo('faq') },
            ].map((link) => (
              <button
                key={link.label}
                type="button"
                className={cn('transition', navScrolled ? 'hover:text-ink' : 'hover:text-white')}
                onClick={link.action}
              >
                {link.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className={cn(!navScrolled && 'text-slate-200 hover:bg-white/10 hover:text-white')} onClick={() => onNavigate(ROUTES.login)}>
              Connexion
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => onNavigate(signupUrl('pro'))} iconRight={<IconArrowRight className="h-3.5 w-3.5" />}>
              Essai gratuit
            </Button>
          </div>
        </div>
      </header>

      <MarketingHero
        trialDays={trialDays}
        mobileMoney={mobileMoney}
        onStart={() => onNavigate(signupUrl('pro'))}
        onPricing={() => pricingRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      <MarketingModulesSection />

      <div id="secteurs">
        <MarketingUseCases />
      </div>

      <MarketingIntegrationsStrip />
      <MarketingSocialProof />

      <section className="border-y border-border/50 bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Opérationnel en 3 étapes</h2>
            <p className="mt-3 text-ink-muted">De l’inscription à la première vente en moins de 10 minutes.</p>
          </Reveal>
          <div className="relative mt-16 grid gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 100}>
                <div className="relative rounded-2xl border border-border/60 bg-linear-to-br from-surface-muted/40 to-white p-8 text-center shadow-sm transition hover:shadow-lg">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-violet-600 text-sm font-bold text-white shadow-lg shadow-accent/30">
                    {step.n}
                  </span>
                  <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section ref={pricingRef} id="tarifs" className="relative overflow-hidden py-24">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-violet-50/50 via-transparent to-amber-50/40" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-subtle">Abonnement</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Investissez dans votre croissance</h2>
            <p className="mt-4 text-ink-muted">Essai {formatTrialPeriod(trialDays)} · Tous les modules listés inclus · Sans engagement</p>
          </Reveal>
          <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:gap-5 lg:pt-4">
            {displayPlans.map((plan, i) => (
              <Reveal key={plan.id} delay={i * 80}>
                <PricingCard plan={plan} featured={plan.id === 'pro'} onSelect={() => onNavigate(signupUrl(plan.id))} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <MarketingFaqAccordion />

      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl px-8 py-16 text-center text-white shadow-2xl sm:px-16">
            <MarketingImage
              src={MARKETING_IMAGES.sectors.boutique}
              alt=""
              className="absolute inset-0"
              overlay="dark"
            />
            <div className="absolute inset-0 bg-linear-to-br from-[#0c1222]/95 via-[#141b2e]/90 to-[#1a1040]/85" aria-hidden />
            <IconZap className="relative mx-auto h-12 w-12 text-amber-400" />
            <h2 className="relative mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Prêt à passer au niveau supérieur ?</h2>
            <p className="relative mx-auto mt-4 max-w-lg text-slate-300">
              29+ fonctionnalités, essai gratuit, déploiement en minutes. Rejoignez les commerces qui modernisent leur point de vente.
            </p>
            <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button type="button" size="lg" variant="primary" onClick={() => onNavigate(signupUrl('pro'))} iconRight={<IconArrowRight className="h-4 w-4" />}>
                Créer mon compte gratuit
              </Button>
              <Button type="button" size="lg" variant="secondary" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => onNavigate(ROUTES.staff)}>
                J’ai déjà un compte
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
            <div className="max-w-sm">
              <BrandLogo size="lg" alt={BRAND_NAME} />
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                Caisse POS offline-first — 20 modules métier, mobile money CI, multi-postes. Par {BRAND_NAME}.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">Produit</p>
                <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                  <li><button type="button" className="hover:text-ink" onClick={() => scrollTo('fonctionnalites')}>Modules</button></li>
                  <li><button type="button" className="hover:text-ink" onClick={() => onNavigate(ROUTES.pricing)}>Tarifs</button></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">Compte</p>
                <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                  <li><button type="button" className="hover:text-ink" onClick={() => onNavigate(signupUrl())}>Inscription</button></li>
                  <li><button type="button" className="hover:text-ink" onClick={() => onNavigate(ROUTES.login)}>Connexion</button></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">Paiements</p>
                <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                  <li>Mobile money CI</li>
                  <li>Stripe</li>
                  <li>Essai {formatTrialPeriod(trialDays)}</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 sm:flex-row">
            <p className="text-sm text-ink-subtle">© {new Date().getFullYear()} {BRAND_NAME}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge tone="accent">29+ modules</Badge>
              <Badge tone="violet">Offline-first</Badge>
              <Badge tone="success">CinetPay</Badge>
            </div>
          </div>
        </div>
      </footer>

      <MarketingStickyCta onStart={() => onNavigate(signupUrl('pro'))} />
    </div>
  )
}
