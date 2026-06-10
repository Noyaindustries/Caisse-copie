import { MARKETING_IMAGES } from '../../lib/marketingImages'

import { MarketingImage } from './MarketingImage'

import { Badge } from '../../ui/Badge'

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



      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">

        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">

          <div className="max-w-lg">

            <Badge className="border-white/15 bg-white/10 text-white">Écosystème</Badge>

            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">

              Paiements locaux & sync cloud, intégrés nativement

            </h2>

            <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">

              Encaissez en Orange Money, Wave, MTN ou Moov. Facturez à l’international avec Stripe.

              Continuez à vendre hors ligne — la caisse se synchronise dès le retour du réseau.

            </p>

            <div className="mt-5 flex flex-wrap gap-2">

              {OPERATORS.map((op) => (

                <span

                  key={op}

                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200 backdrop-blur-sm"

                >

                  {op}

                </span>

              ))}

            </div>

          </div>



          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-xl lg:grid-cols-2 lg:gap-4">

            {STACK.map((item) => (

              <div

                key={item.label}

                className="flex flex-col items-center rounded-2xl border border-white/15 bg-[#0a0f1c]/55 px-4 py-5 text-center backdrop-blur-md transition hover:border-white/25 hover:bg-[#0a0f1c]/70"

              >

                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white">

                  <item.icon className="h-5 w-5" />

                </span>

                <p className="mt-3 text-sm font-bold">{item.label}</p>

                <p className="mt-0.5 text-[11px] text-slate-400">{item.desc}</p>

              </div>

            ))}

          </div>

        </div>

      </div>

    </section>

  )

}

