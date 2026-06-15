import { MARKETING_IMAGES } from '../../lib/marketingImages'
import { signupUrl, ROUTES } from '../../lib/siteRoutes'
import { MarketingImage } from './MarketingImage'
import { Reveal } from './Reveal'
import { Button } from '../../ui/Button'
import { IconArrowRight, IconZap } from '../../ui/icons'

export function MarketingFinalCta({
  onNavigate,
}: {
  onNavigate: (to: string) => void
}) {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl px-8 py-16 text-center text-white shadow-[0_32px_80px_-24px_rgba(23,32,51,0.45)] ring-1 ring-white/10 sm:px-16">
            <MarketingImage
              src={MARKETING_IMAGES.sectors.boutique}
              alt=""
              className="absolute inset-0"
              overlay="dark"
            />
            <div className="absolute inset-0 bg-linear-to-br from-[#0c1222]/95 via-[#141b2e]/88 to-[#1a1040]/90" aria-hidden />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.12),transparent_55%)]" aria-hidden />
            <IconZap className="relative mx-auto h-12 w-12 text-amber-400 drop-shadow-lg" />
            <h2 className="relative mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Prêt à passer au niveau supérieur ?
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-slate-300">
              29+ fonctionnalités, essai gratuit, déploiement en minutes. Rejoignez les commerces qui modernisent leur point de vente.
            </p>
            <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                type="button"
                size="lg"
                variant="primary"
                className="marketing-cta-glow"
                onClick={() => onNavigate(signupUrl('pro'))}
                iconRight={<IconArrowRight className="h-4 w-4" />}
              >
                Créer mon compte gratuit
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => onNavigate(ROUTES.staff)}
              >
                J’ai déjà un compte
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
