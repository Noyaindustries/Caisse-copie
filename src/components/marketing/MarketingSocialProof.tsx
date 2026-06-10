import { MARKETING_IMAGES } from '../../lib/marketingImages'
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
    <section className="border-y border-border/50 bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-ink-subtle">
            Ils nous font confiance
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {SECTORS.map((s) => (
              <span key={s} className="text-lg font-bold tracking-tight text-ink/20 transition hover:text-ink/40">
                {s}
              </span>
            ))}
          </div>
        </Reveal>

        <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-stretch">
          <Reveal className="relative min-h-[280px] overflow-hidden rounded-3xl shadow-lg ring-1 ring-border/50 lg:min-h-0">
            <MarketingImage
              src={MARKETING_IMAGES.testimonials}
              alt="Équipe de commerçants utilisant CaisseCI"
              className="h-full min-h-[280px]"
              overlay="gradient"
            />
            <div className="absolute bottom-0 left-0 right-0 z-10 p-6 text-white">
              <p className="text-2xl font-bold leading-tight">+500 commerces</p>
              <p className="mt-1 text-sm text-slate-300">prêts à moderniser leur caisse en CI</p>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-1">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 80}>
                <blockquote className="flex h-full flex-col rounded-2xl border border-border/60 bg-linear-to-br from-surface-muted/50 to-white p-5 shadow-sm sm:p-6">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <IconStar key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">&ldquo;{t.quote}&rdquo;</p>
                  <footer className="mt-4 border-t border-border/40 pt-3">
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
