import { MARKETING_IMAGES } from '../../lib/marketingImages'
import { MarketingSectionHeader } from './MarketingSectionHeader'
import { Reveal } from './Reveal'
import { MarketingImage } from './MarketingImage'
import { cn } from '../../ui/cn'
import { IconStore, IconSparkles, IconNetwork } from '../../ui/icons'

const CASES: {
  icon: typeof IconStore
  tag: string
  title: string
  desc: string
  modules: string[]
  gradient: string
  accent: string
  image: string
  imageAlt: string
  featured?: boolean
}[] = [
  {
    icon: IconStore,
    tag: 'Commerce',
    title: 'Boutique & retail',
    desc: 'Catalogue, stocks, tickets & factures, rapport journalier. Idéal pour épiceries, pharmacies et prêt-à-porter.',
    modules: ['Caisse', 'Catalogue', 'Stocks', 'Tickets & factures'],
    gradient: 'from-sky-500/10 via-white to-indigo-50/40',
    accent: 'text-sky-600 bg-sky-100',
    image: MARKETING_IMAGES.sectors.boutique,
    imageAlt: 'Commerçante utilisant CaisseCI dans sa boutique',
  },
  {
    icon: IconSparkles,
    tag: 'Restauration',
    title: 'Restaurant & food service',
    desc: 'Tables, cuisine KDS, commandes en ligne, fidélité et promotions. Le plan Pro pensé pour la restauration.',
    modules: ['Cuisine', 'Tables', 'Fidélité', 'Commandes web'],
    gradient: 'from-violet-500/10 via-white to-fuchsia-50/30',
    accent: 'text-violet-600 bg-violet-100',
    image: MARKETING_IMAGES.sectors.restaurant,
    imageAlt: 'Restaurant équipé de CaisseCI',
    featured: true,
  },
  {
    icon: IconNetwork,
    tag: 'Réseau',
    title: 'Multi-sites & franchises',
    desc: 'Transferts inter-magasins, CRM, RH, intégrations API. Pilotez tout votre réseau depuis un seul compte.',
    modules: ['Multi-magasins', 'CRM', 'RH', 'Intégrations'],
    gradient: 'from-amber-500/10 via-white to-orange-50/30',
    accent: 'text-amber-700 bg-amber-100',
    image: MARKETING_IMAGES.sectors.reseau,
    imageAlt: 'Gérant de réseau pilotant plusieurs magasins',
  },
]

export function MarketingUseCases() {
  return (
    <section className="relative overflow-hidden bg-[#f8f9fc] py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,99,255,0.06),transparent_50%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <MarketingSectionHeader
            eyebrow="Secteurs"
            title={
              <>
                Une plateforme,{' '}
                <span className="bg-linear-to-r from-accent to-violet-600 bg-clip-text text-transparent">
                  trois univers métier
                </span>
              </>
            }
            description="Chaque vertical active les modules dont vous avez besoin — sans surcoût inutile."
          />
        </Reveal>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {CASES.map((c, i) => (
            <Reveal key={c.title} delay={i * 80}>
              <article
                className={cn(
                  'marketing-card-premium group relative flex h-full flex-col overflow-hidden rounded-3xl',
                  c.featured && 'ring-1 ring-violet-200/50 lg:-mt-2 lg:mb-2',
                )}
              >
                <div className="relative h-52 overflow-hidden sm:h-56">
                  <MarketingImage
                    src={c.image}
                    alt={c.imageAlt}
                    className="h-full transition duration-500 group-hover:scale-105"
                    overlay="gradient-bottom"
                  />
                  {c.featured ? (
                    <span className="absolute right-4 top-4 z-10 rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white shadow-lg">
                      Populaire
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'absolute bottom-4 left-4 z-10 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg backdrop-blur-sm',
                      c.accent,
                    )}
                  >
                    <c.icon className="h-5 w-5" />
                  </span>
                </div>

                <div className={cn('flex flex-1 flex-col bg-linear-to-br p-6', c.gradient)}>
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">{c.tag}</p>
                  <h3 className="mt-1 text-xl font-bold text-ink">{c.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">{c.desc}</p>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {c.modules.map((m) => (
                      <span
                        key={m}
                        className="rounded-lg border border-border/60 bg-white/90 px-2 py-1 text-[11px] font-semibold text-ink-muted"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
