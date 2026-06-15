import { useState } from 'react'
import { MarketingSectionHeader } from './MarketingSectionHeader'
import { Reveal } from './Reveal'
import { cn } from '../../ui/cn'
import { IconChevronDown } from '../../ui/icons'

const FAQ = [
  {
    q: 'Puis-je essayer sans payer ?',
    a: 'Oui. Chaque plan inclut 1 mois d’essai gratuit, sans carte bancaire obligatoire. Vous accédez à tous les modules de votre palier pendant l’essai.',
  },
  {
    q: 'Comment fonctionne le multi-poste ?',
    a: 'Le premier appareil crée le compte et reçoit un code magasin (ex. MAG-A1B2). Chaque caisse ou tablette supplémentaire saisit ce code une seule fois. Les employés se connectent ensuite avec leur PIN.',
  },
  {
    q: 'Quels moyens de paiement pour l’abonnement ?',
    a: 'Mobile money via CinetPay (Orange Money, Wave, MTN MoMo, Moov) et carte bancaire via Stripe. Chaque paiement active le plan choisi pour 30 jours.',
  },
  {
    q: 'Quels modules sont inclus dans chaque plan ?',
    a: 'Starter : caisse, catalogue, stocks, personnel, journal. Pro ajoute cuisine, tables, fidélité, promotions, commandes en ligne, analytique et comptabilité. Business débloque multi-magasins, CRM, RH et intégrations.',
  },
  {
    q: 'L’application fonctionne-t-elle sans internet ?',
    a: 'Oui. CaisseCI est offline-first : vous encaissez sans connexion. La licence reste valable 7 jours en cache local. La synchronisation reprend dès le retour du réseau.',
  },
  {
    q: 'Puis-je changer de plan en cours de route ?',
    a: 'Absolument. Passez de Starter à Pro ou Business à tout moment depuis la vue Abonnement. Le nouveau palier est activé dès le paiement.',
  },
] as const

export function MarketingFaqAccordion() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="bg-[#f8f9fc] py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <MarketingSectionHeader
            eyebrow="FAQ"
            title="Questions fréquentes"
            description="Tout ce qu’il faut savoir avant de démarrer votre essai gratuit."
          />
        </Reveal>

        <dl className="mt-12 space-y-3">
          {FAQ.map((item, i) => {
            const isOpen = open === i
            return (
              <Reveal key={item.q} delay={i * 50}>
                <div
                  className={cn(
                    'marketing-card-premium overflow-hidden rounded-3xl transition duration-200',
                    isOpen && 'ring-1 ring-accent/15',
                  )}
                >
                  <dt>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                    >
                      <span className="font-bold text-ink">{item.q}</span>
                      <IconChevronDown
                        className={cn(
                          'h-5 w-5 shrink-0 text-ink-subtle transition duration-200',
                          isOpen && 'rotate-180 text-accent',
                        )}
                      />
                    </button>
                  </dt>
                  <dd
                    className={cn(
                      'grid transition-all duration-200',
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-5 text-sm leading-relaxed text-ink-muted">{item.a}</p>
                    </div>
                  </dd>
                </div>
              </Reveal>
            )
          })}
        </dl>
      </div>
    </section>
  )
}
