import { Reveal } from './Reveal'
import { MarketingSectionHeader } from './MarketingSectionHeader'
import { MarketingBlobs } from './MarketingBlobs'
import { IconSparkles, IconStore, IconZap } from '../../ui/icons'

const STEPS = [
  {
    n: '01',
    title: 'Créez votre magasin',
    desc: 'Choisissez Starter, Pro ou Business. Essai 1 mois inclus.',
    Icon: IconZap,
    tone: 'text-violet-600 bg-violet-50 ring-1 ring-violet-200/80',
  },
  {
    n: '02',
    title: 'Déployez vos postes',
    desc: 'Code magasin court pour chaque tablette ou caisse supplémentaire.',
    Icon: IconStore,
    tone: 'text-sky-600 bg-sky-50 ring-1 ring-sky-200/80',
  },
  {
    n: '03',
    title: 'Encaissez & évoluez',
    desc: 'Mobile money ou carte. Changez de plan à tout moment.',
    Icon: IconSparkles,
    tone: 'text-amber-600 bg-amber-50 ring-1 ring-amber-200/80',
  },
] as const

export function MarketingStepsSection() {
  return (
    <section className="relative border-y border-border/50 bg-linear-to-b from-white to-[#f8f9fc] py-24">
      <MarketingBlobs preset="section" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <MarketingSectionHeader
            eyebrow="Démarrage"
            title="Opérationnel en 3 étapes"
            description="De l’inscription à la première vente en moins de 10 minutes."
          />
        </Reveal>
        <div className="relative mt-16 grid gap-8 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-7 hidden h-px bg-linear-to-r from-transparent via-accent/35 to-transparent md:block" />
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 100}>
              <div className="marketing-card-premium relative rounded-3xl p-8 text-center">
                <span
                  className={`relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${step.tone}`}
                >
                  <step.Icon className="h-6 w-6" />
                </span>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                  Étape {step.n}
                </p>
                <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
