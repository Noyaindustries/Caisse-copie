import { useState } from 'react'
import { MARKETING_IMAGES } from '../../lib/marketingImages'
import { formatTrialPeriod } from '../../lib/subscription/plans'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { MarketingImage } from './MarketingImage'
import { cn } from '../../ui/cn'
import {
  IconArrowRight,
  IconCheckCircle,
  IconMobile,
  IconSparkles,
  IconTrendingUp,
} from '../../ui/icons'

const HERO_MESH =
  'radial-gradient(circle at 18% 22%, rgba(99,102,241,0.45) 0%, transparent 48%), radial-gradient(circle at 82% 12%, rgba(20,99,255,0.38) 0%, transparent 42%), radial-gradient(circle at 55% 88%, rgba(168,85,247,0.28) 0%, transparent 52%)'

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

  return (
    <section className="relative overflow-hidden bg-linear-to-br from-[#060a14] via-[#0c1222] to-[#1a1040] pt-16 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: HERO_MESH }} />
      <div className="marketing-grid-pattern pointer-events-none absolute inset-0 opacity-[0.07]" />
      <div className="pointer-events-none absolute -right-32 top-20 h-[28rem] w-[28rem] rounded-full bg-indigo-500/25 blur-3xl marketing-float-slow" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.12fr] lg:gap-10 xl:gap-12 lg:py-28">
        <div>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Badge className="border-white/15 bg-white/10 text-white backdrop-blur-sm">
              {formatTrialPeriod(trialDays)} d’essai · Sans engagement
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Disponible en Côte d’Ivoire
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl xl:text-[3.5rem]">
            L’OS commercial{' '}
            <span className="bg-linear-to-r from-white via-indigo-100 to-violet-300 bg-clip-text text-transparent">
              tout-en-un
            </span>{' '}
            pour vendre sans limites
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            Caisse offline-first, 20 modules métier, mobile money natif et multi-postes.
            Du food-truck au réseau de boutiques — une seule plateforme, zéro compromis.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              '29+ fonctionnalités : ventes, stocks, RH, CRM, analytique…',
              'Code magasin pour déployer vos caisses en 30 secondes',
              'Paiement abonnement Orange Money, Wave, MTN, Moov ou carte',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-slate-300">
                <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="button" size="lg" variant="primary" onClick={onStart} iconRight={<IconArrowRight className="h-4 w-4" />}>
              Démarrer gratuitement
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={onPricing}
            >
              Explorer les tarifs
            </Button>
          </div>

          {mobileMoney ? (
            <div className="marketing-marquee mt-8 overflow-hidden rounded-xl border border-white/10 bg-white/5 py-2.5">
              <div className="marketing-marquee-track flex gap-8 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {[...Array(2)].map((_, i) => (
                  <span key={i} className="flex shrink-0 items-center gap-8">
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

        <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-5">
          <div className="marketing-hero-photo relative lg:row-span-1">
            <div className="pointer-events-none absolute -inset-1 rounded-[1.75rem] bg-linear-to-br from-indigo-400/25 via-violet-500/10 to-transparent opacity-80 blur-sm" />
            <MarketingImage
              src={MARKETING_IMAGES.hero}
              alt="Commerçante utilisant CaisseCI dans sa boutique en Côte d’Ivoire"
              className="aspect-[4/5] w-full rounded-3xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/20"
              overlay="none"
              objectPosition="left center"
              priority
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-3xl bg-linear-to-t from-[#060a14]/50 to-transparent"
              aria-hidden
            />

            <div className="absolute right-4 top-4 rounded-full border border-white/15 bg-[#0a0f1c]/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 shadow-lg backdrop-blur-md">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              En situation réelle
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0 rounded-t-3xl bg-linear-to-b from-[#060a14]/85 via-[#060a14]/40 to-transparent p-6 pb-16 lg:hidden">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-300">CaisseCI</p>
              <p className="mt-2 text-xl font-bold leading-tight text-white">
                La caisse qui fonctionne même sans internet
              </p>
            </div>

            <div className="marketing-float-delayed absolute bottom-4 right-4 rounded-xl border border-white/15 bg-[#0f1628]/90 px-4 py-3 shadow-xl backdrop-blur-md">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Ticket #1847</p>
              <p className="font-mono text-lg font-bold text-white">+24 500 F</p>
              <p className="text-[10px] text-emerald-400">Encaissé · Orange Money</p>
            </div>
          </div>

          <div className="marketing-hero-mockup marketing-float overflow-hidden rounded-2xl border border-white/15 bg-[#0a0f1c]/95 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl lg:-ml-2 lg:mb-1 lg:translate-y-2">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
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
                    preview === t.id ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300',
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

      <div className="relative border-t border-white/10 bg-black/25 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-2 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'px-6 py-8 text-center',
                i > 0 && 'border-l border-white/10',
              )}
            >
              <p className="font-mono text-3xl font-bold text-white">{s.value}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
