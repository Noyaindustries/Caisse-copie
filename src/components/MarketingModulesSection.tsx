import { useEffect, useMemo, useState } from 'react'
import { MARKETING_IMAGES } from '../lib/marketingImages'
import { MarketingImage } from './marketing/MarketingImage'
import { MarketingBlobs } from './marketing/MarketingBlobs'
import { MarketingSectionHeader } from './marketing/MarketingSectionHeader'
import { Reveal } from './marketing/Reveal'
import { NavIcon } from './NavIcons'
import { fetchPlans } from '../lib/subscription/api'
import {
  getAllModules,
  getModuleSections,
  getPlatformFeatures,
  moduleIncludedInPlan,
  modulesForPlan,
  type ModuleEntry,
  type PlatformFeature,
} from '../lib/subscription/moduleCatalog'
import { planLabel } from '../lib/subscription/plans'
import type { PlanId } from '../lib/subscription/types'
import { VIEW_ACCENTS } from '../navigation'
import { Badge } from '../ui/Badge'
import { Field, Input } from '../ui/Input'
import { cn } from '../ui/cn'
import { IconCheck, IconMinus, IconSearch } from '../ui/icons'

type Filter = 'all' | PlanId
type ViewMode = 'grid' | 'list'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'starter', label: 'Starter' },
  { id: 'pro', label: 'Pro' },
  { id: 'business', label: 'Business' },
]

const PLAN_BADGE_TONE: Record<PlanId, 'neutral' | 'violet' | 'accent'> = {
  starter: 'neutral',
  pro: 'violet',
  business: 'accent',
}

const SPOTLIGHT_IDS = ['caisse', 'kitchen', 'analytique', 'network', 'onlineOrders', 'crm'] as const

const PLATFORM_ICON_TONE: Record<string, string> = {
  offline: 'text-emerald-600 bg-emerald-50',
  storeCode: 'text-sky-600 bg-sky-50',
  pin: 'text-indigo-600 bg-indigo-50',
  storefront: 'text-fuchsia-600 bg-fuchsia-50',
  mobileMoney: 'text-orange-600 bg-orange-50',
  stripe: 'text-violet-600 bg-violet-50',
  sms: 'text-rose-600 bg-rose-50',
  sync: 'text-cyan-600 bg-cyan-50',
  pwa: 'text-amber-600 bg-amber-50',
}

function PlanBadge({ plan }: { plan: PlanId }) {
  return (
    <Badge tone={PLAN_BADGE_TONE[plan]} className="shrink-0">
      {planLabel(plan)}+
    </Badge>
  )
}

function ModuleCard({
  module,
  compact,
}: {
  module: ModuleEntry
  compact?: boolean
}) {
  const accent = VIEW_ACCENTS[module.id]
  return (
    <article
      className={cn(
        'marketing-card-premium group relative overflow-hidden rounded-3xl',
        compact ? 'flex items-center gap-4 p-4' : 'p-5',
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-accent/0 to-violet-500/0 opacity-0 transition group-hover:from-accent/5 group-hover:to-violet-500/5 group-hover:opacity-100" />
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-xl border border-white/80 shadow-sm [&_svg]:h-5 [&_svg]:w-5',
          accent.icon,
          compact ? 'h-10 w-10' : 'h-12 w-12',
        )}
      >
        <NavIcon id={module.id} />
      </span>
      <div className={cn('relative min-w-0', !compact && 'mt-4')}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-ink">{module.label}</h3>
          <PlanBadge plan={module.minPlan} />
        </div>
        <p className={cn('text-ink-muted', compact ? 'mt-0.5 text-xs' : 'mt-2 text-sm leading-relaxed')}>
          {module.description}
        </p>
      </div>
    </article>
  )
}

function PlatformCard({ feature, compact }: { feature: PlatformFeature; compact?: boolean }) {
  const tone = PLATFORM_ICON_TONE[feature.id] ?? 'text-accent bg-accent/15'
  return (
    <article
      className={cn(
        'marketing-card-premium flex gap-4 rounded-3xl border-dashed border-accent/25 bg-accent/5',
        compact ? 'items-center p-4' : 'p-5',
      )}
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/80 shadow-sm',
          tone,
        )}
      >
        <IconCheck className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-ink">{feature.label}</h3>
          <Badge tone="success">Plateforme</Badge>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{feature.description}</p>
      </div>
    </article>
  )
}

function ComparisonMatrix() {
  const plans: PlanId[] = ['starter', 'pro', 'business']

  return (
    <Reveal>
      <div className="marketing-card-premium mt-20 overflow-hidden rounded-3xl">
        <div className="border-b border-border/50 bg-linear-to-r from-surface-muted to-white px-6 py-5 sm:px-8">
          <h3 className="font-display text-xl font-bold text-ink">Matrice comparative complète</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {getAllModules().length} modules · {getPlatformFeatures().length} capacités plateforme
          </p>
        </div>
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
              <tr className="border-b border-border/50">
                <th className="px-6 py-3.5 font-semibold text-ink-muted">Fonctionnalité</th>
                {plans.map((p) => (
                  <th key={p} className="px-4 py-3.5 text-center">
                    <span
                      className={cn(
                        'inline-block rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wide',
                        p === 'starter' && 'bg-slate-100 text-slate-700',
                        p === 'pro' && 'bg-violet-100 text-violet-800',
                        p === 'business' && 'bg-amber-100 text-amber-900',
                      )}
                    >
                      {planLabel(p)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {getModuleSections().flatMap((section) => [
                <tr key={`h-${section.title}`} className="bg-surface-muted/60">
                  <td colSpan={4} className="px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                    {section.title}
                  </td>
                </tr>,
                ...section.modules.map((m) => (
                  <tr key={m.id} className="border-b border-border/20 hover:bg-surface-muted/30">
                    <td className="px-6 py-2.5">
                      <span className="font-medium text-ink">{m.label}</span>
                    </td>
                    {plans.map((p) => (
                      <td key={p} className="px-4 py-2.5 text-center">
                        {moduleIncludedInPlan(m.minPlan, p) ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50">
                            <IconCheck className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                          </span>
                        ) : (
                          <IconMinus className="mx-auto h-4 w-4 text-ink-subtle/40" />
                        )}
                      </td>
                    ))}
                  </tr>
                )),
              ])}
              <tr className="bg-surface-muted/60">
                <td colSpan={4} className="px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                  Plateforme
                </td>
              </tr>
              {getPlatformFeatures().map((f) => (
                <tr key={f.id} className="border-b border-border/20 bg-accent/[0.02]">
                  <td className="px-6 py-2.5 font-medium text-ink">{f.label}</td>
                  {plans.map((p) => (
                    <td key={p} className="px-4 py-2.5 text-center">
                      {moduleIncludedInPlan(f.minPlan, p) ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50">
                          <IconCheck className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                        </span>
                      ) : (
                        <IconMinus className="mx-auto h-4 w-4 text-ink-subtle/40" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Reveal>
  )
}

export function MarketingModulesSection() {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [modulesVersion, setModulesVersion] = useState(0)

  useEffect(() => {
    void fetchPlans()
      .then(() => setModulesVersion((v) => v + 1))
      .catch(() => {})
  }, [])

  const q = search.trim().toLowerCase()

  const visibleSections = useMemo(() => {
    return getModuleSections().map((section) => ({
      ...section,
      modules: section.modules.filter((m) => {
        if (filter !== 'all' && !moduleIncludedInPlan(m.minPlan, filter)) return false
        if (!q) return true
        return (
          m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
        )
      }),
    })).filter((s) => s.modules.length > 0)
  }, [filter, q, modulesVersion])

  const filteredPlatform = useMemo(() => {
    return getPlatformFeatures().filter((f) => {
      if (filter !== 'all' && !moduleIncludedInPlan(f.minPlan, filter)) return false
      if (!q) return true
      return f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
    })
  }, [filter, q, modulesVersion])

  const spotlight = useMemo(
    () => getAllModules().filter((m) => (SPOTLIGHT_IDS as readonly string[]).includes(m.id)),
    [modulesVersion],
  )

  const planStats = useMemo(
    () =>
      (['starter', 'pro', 'business'] as PlanId[]).map((p) => ({
        plan: p,
        count: modulesForPlan(p).length + getPlatformFeatures().length,
      })),
    [modulesVersion],
  )

  const totalVisible =
    visibleSections.reduce((n, s) => n + s.modules.length, 0) + filteredPlatform.length

  return (
    <section id="fonctionnalites" className="relative border-t border-border/50 bg-linear-to-b from-white via-[#f8f9fc] to-white py-24">
      <MarketingBlobs preset="light" className="opacity-80" />
      <div className="marketing-grid-pattern pointer-events-none absolute inset-0 opacity-[0.35]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-3xl shadow-lg ring-1 ring-border/50">
          <div className="relative min-h-[280px] sm:min-h-[320px] lg:min-h-[360px]">
            <MarketingImage
              src={MARKETING_IMAGES.hero}
              alt="Interface CaisseCI en situation réelle"
              className="absolute inset-0"
              overlay="gradient"
              objectPosition="center center"
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-[#0c1222]/92 via-[#0c1222]/70 to-[#0c1222]/35" />
            <div className="relative flex h-full min-h-[280px] flex-col justify-center p-8 text-white sm:min-h-[320px] sm:p-10 lg:min-h-[360px] lg:max-w-xl lg:p-12 xl:max-w-2xl">
              <p className="marketing-eyebrow marketing-eyebrow-light">Plateforme complète</p>
              <h2 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
                Chaque module conçu pour le terrain ivoirien
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
                De la caisse au CRM — explorez l’écosystème complet ci-dessous.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Caisse offline', 'Stocks', 'Cuisine', 'CRM', 'RH', 'Analytique'].map((tag) => (
                  <span key={tag} className="marketing-chip">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Reveal delay={60} className="mt-14">
          <MarketingSectionHeader
            eyebrow="Modules & fonctionnalités"
            title={
              <>
                L’intégralité de la plateforme,{' '}
                <span className="bg-linear-to-r from-accent to-violet-600 bg-clip-text text-transparent">
                  exposée en détail
                </span>
              </>
            }
            description="Explorez, filtrez et comparez chaque module — du ticket de caisse au CRM multi-sites."
          />
        </Reveal>

        <Reveal delay={80} className="mt-10 grid gap-3 sm:grid-cols-3">
          {planStats.map((s) => (
            <div
              key={s.plan}
              className={cn(
                'marketing-card-premium rounded-3xl px-5 py-4 text-center',
                s.plan === 'pro' && 'ring-1 ring-violet-200/60',
              )}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                Plan {planLabel(s.plan)}
              </p>
              <p className="mt-1 font-mono text-3xl font-bold text-ink">{s.count}</p>
              <p className="text-xs text-ink-muted">fonctionnalités</p>
            </div>
          ))}
        </Reveal>

        <Reveal delay={120} className="mt-10">
          <p className="marketing-eyebrow marketing-eyebrow-center mb-4 justify-center">Modules phares</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {spotlight.map((m) => (
              <ModuleCard key={m.id} module={m} compact />
            ))}
          </div>
        </Reveal>

        <Reveal delay={160} className="marketing-filter-bar mt-12 flex flex-col gap-4 rounded-3xl p-4 sm:flex-row sm:items-center sm:p-5">
          <Field label="Rechercher un module" className="flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex. cuisine, stocks, CRM…"
              iconLeft={<IconSearch className="h-4 w-4 text-violet-600" />}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
                  filter === f.id
                    ? 'border-accent bg-accent text-white shadow-md shadow-accent/20'
                    : 'border-border text-ink-muted hover:border-border-strong',
                )}
              >
                {f.label}
              </button>
            ))}
            <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
            {(['grid', 'list'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition',
                  viewMode === mode ? 'bg-surface-sunken text-ink' : 'text-ink-subtle hover:text-ink',
                )}
              >
                {mode === 'grid' ? 'Grille' : 'Liste'}
              </button>
            ))}
          </div>
        </Reveal>

        <p className="mt-4 text-center text-sm text-ink-subtle">
          {totalVisible} résultat{totalVisible > 1 ? 's' : ''}
        </p>

        <div className="mt-10 space-y-12">
          {visibleSections.map((section, si) => (
            <Reveal key={section.title} delay={si * 40}>
              <div id={`mod-${section.title.replace(/\s/g, '-')}`}>
                <h3 className="marketing-section-title mb-5">
                  <span className="marketing-section-title-badge">{section.modules.length}</span>
                  {section.title}
                </h3>
                <div
                  className={cn(
                    'gap-4',
                    viewMode === 'grid'
                      ? 'grid sm:grid-cols-2 xl:grid-cols-3'
                      : 'flex flex-col',
                  )}
                >
                  {section.modules.map((module) => (
                    <ModuleCard key={module.id} module={module} compact={viewMode === 'list'} />
                  ))}
                </div>
              </div>
            </Reveal>
          ))}

          {filteredPlatform.length > 0 ? (
            <Reveal>
              <h3 className="marketing-section-title mb-5">
                <span className="marketing-section-title-badge bg-emerald-100 text-emerald-700">
                  {filteredPlatform.length}
                </span>
                Plateforme & abonnement
              </h3>
              <div
                className={cn(
                  'gap-4',
                  viewMode === 'grid' ? 'grid sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col',
                )}
              >
                {filteredPlatform.map((f) => (
                  <PlatformCard key={f.id} feature={f} compact={viewMode === 'list'} />
                ))}
              </div>
            </Reveal>
          ) : null}

          {totalVisible === 0 ? (
            <p className="py-12 text-center text-ink-muted">Aucun module ne correspond à votre recherche.</p>
          ) : null}
        </div>

        <ComparisonMatrix />
      </div>
    </section>
  )
}
