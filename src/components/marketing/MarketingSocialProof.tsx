import { MARKETING_IMAGES } from '../../lib/marketingImages'
import { MarketingSectionHeader } from './MarketingSectionHeader'
import { MarketingBlobs } from './MarketingBlobs'
import { Reveal } from './Reveal'
import { MarketingImage } from './MarketingImage'
import { IconStar } from '../../ui/icons'

const TESTIMONIALS = [
  {
    quote:
      'On encaisse même quand la connexion coupe. Le code magasin nous a permis d’ouvrir 3 postes en une matinée.',
    name: 'Aminata K.',
    role: 'Gérante — Restaurant Le Palmier, Abidjan',
    rating: 5,
  },
  {
    quote:
      'La cuisine reçoit les commandes en direct, les stocks se décrémentent seuls. On a gagné 2 h par jour.',
    name: 'Kouadio M.',
    role: 'Chef & propriétaire — Maquis Zone 4',
    rating: 5,
  },
  {
    quote:
      'Multi-magasins, transferts de stock, CRM clients : enfin un outil adapté à notre réseau de 5 boutiques.',
    name: 'Fatou D.',
    role: 'Directrice — Réseau Mode CI',
    rating: 5,
  },
] as const

const SECTORS = ['Restaurants', 'Boutiques', 'Pharmacies', 'Superettes', 'Maquis', 'Franchises'] as const

export function MarketingSocialProof() {
  return (
    <section className="relative border-y border-border/50 bg-white py-24">
      <MarketingBlobs preset="light" className="opacity-70" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <MarketingSectionHeader
            eyebrow="Confiance"
            title="Ils nous font confiance"
            description="Des commerces de toute la Côte d’Ivoire modernisent leur point de vente avec CaisseCI."
          />
        </Reveal>

        <Reveal delay={80} className="mt-10">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {SECTORS.map((s) => (
              <span key={s} className="marketing-sector-logo">
                {s}
              </span>
            ))}
          </div>
        </Reveal>

        <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:items-stretch">
          <Reveal className="relative min-h-[300px] overflow-hidden rounded-3xl shadow-xl ring-1 ring-border/40 lg:min-h-0">
            <MarketingImage
              src={MARKETING_IMAGES.testimonials}
              alt="Équipe de commerçants utilisant CaisseCI"
              className="h-full min-h-[300px]"
              overlay="gradient"
            />
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-linear-to-t from-[#0c1222]/90 via-[#0c1222]/50 to-transparent p-8 text-white">
              <p className="font-display text-3xl font-bold leading-tight">+500 commerces</p>
              <p className="mt-2 text-sm text-slate-300">prêts à moderniser leur caisse en Côte d’Ivoire</p>
            </div>
          </Reveal>

          <div className="grid gap-4">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 80}>
                <blockquote className="marketing-card-premium flex h-full flex-col rounded-3xl p-6">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <IconStar key={`${t.name}-star-${j}`} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">&ldquo;{t.quote}&rdquo;</p>
                  <footer className="mt-4 border-t border-border/40 pt-4">
                    <p className="font-bold text-ink">{t.name}</p>
                    <p className="text-xs text-ink-subtle">{t.role}</p>
                  </footer>
                </blockquote>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
