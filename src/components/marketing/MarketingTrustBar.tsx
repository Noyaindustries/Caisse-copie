import { Reveal } from './Reveal'
import { IconMobile, IconShield, IconStore, IconZap } from '../../ui/icons'
import { cn } from '../../ui/cn'

const PILLARS = [
  {
    icon: IconShield,
    title: 'Hors ligne 7 jours',
    desc: 'Encaissez sans connexion. Licence et données en cache local.',
    ring: 'from-emerald-400/20 to-teal-500/5',
    iconTone: 'text-emerald-600 bg-linear-to-br from-emerald-50 to-emerald-100/50',
  },
  {
    icon: IconMobile,
    title: 'Mobile money CI',
    desc: 'Orange Money, Wave, MTN MoMo et Moov pour l’abonnement.',
    ring: 'from-orange-400/20 to-amber-500/5',
    iconTone: 'text-orange-600 bg-linear-to-br from-orange-50 to-amber-100/50',
  },
  {
    icon: IconStore,
    title: 'Multi-postes',
    desc: 'Code magasin court pour déployer chaque caisse en 30 s.',
    ring: 'from-sky-400/20 to-blue-500/5',
    iconTone: 'text-sky-600 bg-linear-to-br from-sky-50 to-blue-100/50',
  },
  {
    icon: IconZap,
    title: 'Opérationnel vite',
    desc: 'De l’inscription à la première vente en moins de 10 minutes.',
    ring: 'from-violet-400/20 to-indigo-500/5',
    iconTone: 'text-violet-600 bg-linear-to-br from-violet-50 to-indigo-100/50',
  },
] as const

export function MarketingTrustBar() {
  return (
    <section className="relative z-10 bg-[#f8f9fc]">
      <div className="h-px bg-linear-to-r from-transparent via-accent/35 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 60}>
              <div
                className={cn(
                  'marketing-card-premium relative flex h-full gap-4 overflow-hidden rounded-3xl p-5',
                  'bg-linear-to-br',
                  pillar.ring,
                )}
              >
                <span
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/80 shadow-sm',
                    pillar.iconTone,
                  )}
                >
                  <pillar.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-ink">{pillar.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{pillar.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
