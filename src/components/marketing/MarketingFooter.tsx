import { BrandLogo } from '../BrandLogo'
import { useSiteBranding } from '../../context/SiteBrandingContext'
import { formatTrialPeriod } from '../../lib/subscription/plans'
import { signupUrl, ROUTES } from '../../lib/siteRoutes'
import { Badge } from '../../ui/Badge'

export function MarketingFooter({
  trialDays,
  onNavigate,
  onScrollTo,
}: {
  trialDays: number
  onNavigate: (to: string) => void
  onScrollTo: (id: string) => void
}) {
  const { brandName } = useSiteBranding()
  return (
    <footer className="border-t border-border/60 bg-linear-to-b from-white to-[#f8f9fc]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <BrandLogo size="lg" alt={brandName} />
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              Caisse POS offline-first — 20 modules métier, mobile money CI, multi-postes. Par {brandName}.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">Produit</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                <li><button type="button" className="transition hover:text-ink" onClick={() => onScrollTo('fonctionnalites')}>Modules</button></li>
                <li><button type="button" className="transition hover:text-ink" onClick={() => onScrollTo('tarifs')}>Tarifs</button></li>
                <li><button type="button" className="transition hover:text-ink" onClick={() => onScrollTo('faq')}>FAQ</button></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">Compte</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                <li><button type="button" className="transition hover:text-ink" onClick={() => onNavigate(signupUrl())}>Inscription</button></li>
                <li><button type="button" className="transition hover:text-ink" onClick={() => onNavigate(ROUTES.login)}>Connexion</button></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">Paiements</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                <li>Mobile money CI</li>
                <li>Stripe</li>
                <li>Essai {formatTrialPeriod(trialDays)}</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 sm:flex-row">
          <p className="text-sm text-ink-subtle">© {new Date().getFullYear()} {brandName}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge tone="accent">29+ modules</Badge>
            <Badge tone="violet">Offline-first</Badge>
            <Badge tone="success">CinetPay</Badge>
          </div>
        </div>
      </div>
    </footer>
  )
}
