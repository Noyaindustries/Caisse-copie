import { useEffect, useState } from 'react'
import { MARKETING_IMAGES } from '../../lib/marketingImages'
import { formatTrialPeriod } from '../../lib/subscription/plans'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { MarketingImage } from './MarketingImage'
import { MarketingBlobs } from './MarketingBlobs'
import { cn } from '../../ui/cn'
import {
  IconArrowRight,
  IconCheckCircle,
  IconMobile,
  IconSparkles,
  IconTrendingUp,
} from '../../ui/icons'

const STATIC_STATS = [
  { value: '7j', label: 'Hors ligne' },
  { value: '29+', label: 'Fonctionnalités' },
  { value: '4+', label: 'Opérateurs MM' },
] as const

const PREVIEW_TABS = [
  { id: 'dash', label: 'Tableau de bord' },
  { id: 'caisse', label: 'Caisse' },
  { id: 'kitchen', label: 'Cuisine' },
] as const

type PreviewTab = (typeof PREVIEW_TABS)[number]['id']

function PreviewPanel({ tab }: { tab: PreviewTab }) {
  if (tab === 'caisse') {
    return (
      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          {['Entrées', 'Plats', 'Boissons'].map((c, i) => (
            <span
              key={c}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[11px] font-semibold',
                i === 1 ? 'bg-accent text-white' : 'bg-white/10 text-slate-400',
              )}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['Poulet braisé', 'Attiéké', 'Bissap'].map((item, i) => (
            <div
              key={item}
              className={cn(
                'rounded-xl border px-2 py-3 text-center text-[10px] font-medium',
                i === 0 ? 'border-accent/40 bg-accent/20 text-white' : 'border-white/10 bg-white/5 text-slate-300',
              )}
            >
              {item}
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Panier</span>
            <span className="font-mono text-white">12 500 F</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/10">
            <div className="h-full w-3/4 rounded-full bg-accent" />
          </div>
        </div>
      </div>
    )
  }

  if (tab === 'kitchen') {
    return (
      <div className="space-y-2 p-4">
        {[
          { table: 'T-04', items: '2× Poulet, 1× Foutou', status: 'En cours', tone: 'amber' },
          { table: 'T-12', items: 'Garba complet', status: 'Prêt', tone: 'emerald' },
          { table: 'T-07', items: 'Poisson grillé', status: 'Nouveau', tone: 'sky' },
        ].map((t) => (
          <div
            key={t.table}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
          >
            <div>
              <p className="text-xs font-bold text-white">{t.table}</p>
              <p className="text-[10px] text-slate-400">{t.items}</p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                t.tone === 'amber' && 'bg-amber-500/20 text-amber-300',
                t.tone === 'emerald' && 'bg-emerald-500/20 text-emerald-300',
                t.tone === 'sky' && 'bg-sky-500/20 text-sky-300',
              )}
            >
              {t.status}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {[
        { label: 'Ventes du jour', value: '847 500 F', delta: '+12 %', up: true },
        { label: 'Tickets', value: '156', delta: '+8 %', up: true },
        { label: 'Marge', value: '38 %', delta: '+2 pts', up: true },
        { label: 'Plan', value: 'Pro', delta: 'Essai J-9', up: true },
      ].map((kpi) => (
        <div key={kpi.label} className="rounded-xl border border-white/8 bg-white/5 px-3 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{kpi.label}</p>
          <p className="mt-1 font-mono text-sm font-bold text-white">{kpi.value}</p>
          <p className={cn('mt-0.5 text-[10px] font-semibold', kpi.up ? 'text-emerald-400' : 'text-amber-400')}>
            {kpi.delta}
          </p>
        </div>
      ))}
    </div>
  )
}

export function MarketingHero({
  trialDays,
  mobileMoney,
  onStart,
  onPricing,
}: {
  trialDays: number
  mobileMoney: boolean
  onStart: () => void
  onPricing: () => void
}) {
  const [preview, setPreview] = useState<PreviewTab>('dash')
  const stats = [
    { value: formatTrialPeriod(trialDays), label: 'Essai gratuit' },
    ...STATIC_STATS,
  ]

  useEffect(() => {
    const order = PREVIEW_TABS.map((t) => t.id)
    const timer = window.setInterval(() => {
      setPreview((current) => {
        const index = order.indexOf(current)
        return order[(index + 1) % order.length] ?? 'dash'
      })
    }, 5000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section
      id="marketing-hero"
      className="relative overflow-hidden bg-linear-to-br from-[#04070f] via-[#0a1020] to-[#16103a] pt-16 text-white"
    >
      <div className="marketing-hero-mesh pointer-events-none absolute inset-0 overflow-hidden opacity-50" />
      <div className="marketing-hero-noise pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay" />
      <div className="marketing-grid-pattern pointer-events-none absolute inset-0 overflow-hidden opacity-[0.06]" />
      <MarketingBlobs preset="hero" />

      <div className="relative mx-auto grid max-w-7xl min-w-0 items-center gap-14 px-4 py-20 pb-24 sm:px-6 sm:pb-28 lg:grid-cols-[5fr_6fr] lg:gap-10 xl:gap-12 lg:py-28 lg:pb-32">
        <div className="min-w-0">
          <div className="marketing-hero-animate mb-6 flex flex-wrap items-center gap-3">
            <Badge className="border-white/15 bg-white/10 text-white backdrop-blur-sm">
              {formatTrialPeriod(trialDays)} d’essai · Sans engagement
            </Badge>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Disponible en Côte d’Ivoire
            </span>
          </div>

          <h1 className="marketing-hero-animate marketing-hero-animate-delay-1 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl xl:text-[3.55rem]">
            La plateforme{' '}
            <span className="marketing-gradient-text">tout-en-un</span>{' '}
            pour vendre, encaisser et piloter
          </h1>

          <p className="marketing-hero-animate marketing-hero-animate-delay-2 mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            Caisse offline-first, 20 modules métier et mobile money natif.
            Du food-truck au réseau de boutiques — une seule solution professionnelle.
          </p>

          <ul className="marketing-hero-animate marketing-hero-animate-delay-3 mt-8 space-y-3">
            {[
              '29+ fonctionnalités : ventes, stocks, RH, CRM, analytique…',
              'Code magasin pour déployer vos caisses en 30 secondes',
              'Abonnement via Orange Money, Wave, MTN, Moov ou carte',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-slate-300">
                <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {line}
              </li>
            ))}
          </ul>

          <div className="marketing-hero-animate marketing-hero-animate-delay-4 mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              size="lg"
              variant="primary"
              className="marketing-cta-glow"
              onClick={onStart}
              iconRight={<IconArrowRight className="h-4 w-4" />}
            >
              Démarrer gratuitement
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={onPricing}
            >
              Voir les tarifs
            </Button>
          </div>

          {mobileMoney ? (
            <div className="marketing-marquee mt-8 overflow-hidden rounded-xl border border-white/10 bg-white/5 py-2.5">
              <div className="marketing-marquee-track flex gap-8 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {[0, 1].map((copy) => (
                  <span key={copy} className="flex shrink-0 items-center gap-8">
                    <span className="flex items-center gap-2">
                      <IconMobile className="h-3.5 w-3.5 text-orange-400" />
                      Orange Money
                    </span>
                    <span>Wave</span>
                    <span>MTN MoMo</span>
                    <span>Moov Money</span>
                    <span>Stripe</span>
                    <span>CinetPay</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="marketing-hero-visual-glow relative min-w-0">
          <div className="relative z-10 grid min-w-0 gap-5 sm:gap-6 lg:grid-cols-2 lg:items-end lg:gap-5">
            <div className="marketing-hero-photo relative min-w-0">
              <div className="pointer-events-none absolute -inset-1 rounded-[1.75rem] bg-linear-to-br from-indigo-400/30 via-violet-500/15 to-transparent opacity-90 blur-sm" />
              <MarketingImage
                src={MARKETING_IMAGES.hero}
                alt="Commerçante utilisant CaisseCI dans sa boutique en Côte d’Ivoire"
                className="aspect-[4/5] w-full rounded-3xl shadow-[0_28px_70px_-24px_rgba(0,0,0,0.75)] ring-1 ring-white/20"
                overlay="none"
                objectPosition="left center"
                priority
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 rounded-b-3xl bg-linear-to-t from-[#04070f]/60 to-transparent"
                aria-hidden
              />

              <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-[#0a0f1c]/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300 shadow-lg backdrop-blur-md">
                Photo réelle
              </div>

              <div className="absolute right-4 top-4 rounded-full border border-white/15 bg-[#0a0f1c]/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 shadow-lg backdrop-blur-md">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live
              </div>

              <div className="marketing-float-delayed absolute bottom-4 right-4 z-10 rounded-xl border border-white/15 bg-[#0f1628]/95 px-4 py-3 shadow-2xl backdrop-blur-md">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Ticket #1847</p>
                <p className="font-mono text-lg font-bold text-white">+24 500 F</p>
                <p className="text-[10px] text-emerald-400">Encaissé · Orange Money</p>
              </div>
            </div>

            <div className="marketing-mockup-ring min-w-0 lg:-ml-2 lg:mb-1">
              <div className="marketing-hero-mockup marketing-float overflow-hidden rounded-2xl border border-white/15 bg-[#0a0f1c]/95 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.75)] backdrop-blur-xl">
                <div className="flex items-center gap-2 border-b border-white/10 bg-white/3 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                  <span className="ml-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <IconSparkles className="h-3 w-3 text-violet-400" />
                    CaisseCI — Aperçu live
                  </span>
                </div>

                <div className="flex gap-1 border-b border-white/10 px-3 py-2">
                  {PREVIEW_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPreview(t.id)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition',
                        preview === t.id
                          ? 'bg-white/15 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-300',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <PreviewPanel tab={preview} />

                <div className="mx-4 mb-4 flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <IconTrendingUp className="h-4 w-4 text-emerald-400" />
                    <p className="text-xs font-medium text-emerald-200">Sync cloud · Mode offline actif</p>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-300/80">7j cache</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-black/30 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-8 sm:grid-cols-4 sm:px-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="marketing-stat-glass group rounded-2xl px-4 py-6 text-center transition hover:bg-white/10"
            >
              <p className="font-mono text-3xl font-bold text-white transition group-hover:scale-105">{s.value}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => document.getElementById('fonctionnalites')?.scrollIntoView({ behavior: 'smooth' })}
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-slate-500 transition hover:text-slate-300 lg:flex"
        aria-label="Découvrir les fonctionnalités"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Découvrir</span>
        <span className="flex h-9 w-5 items-start justify-center rounded-full border border-white/20 p-1">
          <span className="h-1.5 w-1 animate-bounce rounded-full bg-white/70" />
        </span>
      </button>
    </section>
  )
}
