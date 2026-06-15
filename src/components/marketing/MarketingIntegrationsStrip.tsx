import { MARKETING_IMAGES } from '../../lib/marketingImages'
import { MarketingImage } from './MarketingImage'
import { MarketingBlobs } from './MarketingBlobs'
import { MarketingSectionHeader } from './MarketingSectionHeader'
import { Reveal } from './Reveal'
import { IconMobile, IconShield, IconCard, IconZap } from '../../ui/icons'

const STACK = [
  { icon: IconMobile, label: 'CinetPay', desc: 'Mobile money CI' },
  { icon: IconCard, label: 'Stripe', desc: 'Carte bancaire' },
  { icon: IconShield, label: 'Offline PWA', desc: '7 jours cache' },
  { icon: IconZap, label: 'Sync cloud', desc: 'API temps réel' },
] as const

const OPERATORS = ['Orange Money', 'Wave', 'MTN MoMo', 'Moov Money'] as const

export function MarketingIntegrationsStrip() {
  return (
    <section className="relative isolate overflow-hidden py-20 text-white sm:py-24">
      <MarketingImage
        src={MARKETING_IMAGES.mobileMoney}
        alt="Paiement mobile money en Côte d’Ivoire"
        className="absolute inset-0"
        overlay="dark"
        objectPosition="center top"
      />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-[#0c1222]/96 via-[#141b2e]/88 to-[#0c1222]/55" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-[#0c1222]/80 via-transparent to-[#0c1222]/30" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(99,102,241,0.15),transparent_50%)]" />
      <MarketingBlobs preset="hero" className="opacity-40" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
          <Reveal className="max-w-lg">
            <MarketingSectionHeader
              eyebrow="Écosystème"
              theme="dark"
              align="left"
              title="Paiements locaux & sync cloud, intégrés nativement"
              description="Encaissez en Orange Money, Wave, MTN ou Moov. Facturez à l’international avec Stripe. Continuez à vendre hors ligne — la caisse se synchronise dès le retour du réseau."
            />
            <div className="mt-6 flex flex-wrap gap-2">
              {OPERATORS.map((op) => (
                <span key={op} className="marketing-chip">
                  {op}
                </span>
              ))}
            </div>
          </Reveal>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-xl lg:grid-cols-2 lg:gap-4">
            {STACK.map((item, i) => (
              <Reveal key={item.label} delay={i * 70}>
                <div className="marketing-glass-dark flex h-full flex-col items-center rounded-2xl px-4 py-5 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white shadow-inner">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-bold">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

