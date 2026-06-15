import { Reveal } from './Reveal'
import { MarketingSectionHeader } from './MarketingSectionHeader'
import { MarketingBlobs } from './MarketingBlobs'

const STEPS = [
  { n: '01', title: 'Créez votre magasin', desc: 'Choisissez Starter, Pro ou Business. Essai 1 mois inclus.' },
  { n: '02', title: 'Déployez vos postes', desc: 'Code magasin court pour chaque tablette ou caisse supplémentaire.' },
  { n: '03', title: 'Encaissez & évoluez', desc: 'Mobile money ou carte. Changez de plan à tout moment.' },
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
                <span className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-violet-600 text-sm font-bold text-white shadow-lg shadow-accent/30">
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
  )
}
