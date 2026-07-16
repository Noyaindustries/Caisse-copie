import { useEffect, useState } from 'react'
import { MarketingFaqAccordion } from '../components/marketing/MarketingFaqAccordion'
import { MarketingFinalCta } from '../components/marketing/MarketingFinalCta'
import { MarketingFooter } from '../components/marketing/MarketingFooter'
import { MarketingHero } from '../components/marketing/MarketingHero'
import { MarketingIntegrationsStrip } from '../components/marketing/MarketingIntegrationsStrip'
import { MarketingModulesSection } from '../components/MarketingModulesSection'
import { MarketingPricingSection } from '../components/marketing/MarketingPricingSection'
import { MarketingScrollProgress } from '../components/marketing/MarketingScrollProgress'
import { MarketingSocialProof } from '../components/marketing/MarketingSocialProof'
import { MarketingStepsSection } from '../components/marketing/MarketingStepsSection'
import { MarketingStickyCta } from '../components/marketing/MarketingStickyCta'
import { MarketingTrustBar } from '../components/marketing/MarketingTrustBar'
import { MarketingUseCases } from '../components/marketing/MarketingUseCases'
import { BrandLogo } from '../components/BrandLogo'
import { BRAND_NAME } from '../brand'
import { fetchPlans } from '../lib/subscription/api'
import { signupUrl, ROUTES } from '../lib/siteRoutes'
import type { PlanId } from '../lib/subscription/types'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import { IconArrowRight, IconClose, IconMenu } from '../ui/icons'

type Navigate = (to: string) => void

const NAV_LINKS = [
  { label: 'Modules', id: 'fonctionnalites' },
  { label: 'Secteurs', id: 'secteurs' },
  { label: 'Tarifs', id: 'tarifs' },
  { label: 'FAQ', id: 'faq' },
] as const

export function MarketingSiteView({
  onNavigate,
  scrollToPricing,
}: {
  onNavigate: Navigate
  scrollToPricing?: boolean
}) {
  const [mobileMoney, setMobileMoney] = useState(false)
  const [trialDays, setTrialDays] = useState(30)
  const [navScrolled, setNavScrolled] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    void fetchPlans()
      .then((data) => {
        setMobileMoney(data.mobileMoneyEnabled)
        setTrialDays(data.trialDays)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    // Sécurité : ne pas laisser un overflow body bloqué (menu mobile, modal…).
    document.body.style.overflow = ''
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileNavOpen])

  const scrollTo = (id: string) => {
    setMobileNavOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-svh bg-[#f8f9fc] pb-[calc(5rem+env(safe-area-inset-bottom))] text-ink">
      <MarketingScrollProgress />

      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition duration-500',
          navScrolled && !mobileNavOpen ? 'px-3 pt-3' : '',
        )}
      >
        <div
          className={cn(
            'mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 transition duration-500 sm:px-6',
            mobileNavOpen
              ? 'h-16 border-b border-border/50 bg-white/98 shadow-sm backdrop-blur-xl'
              : navScrolled
                ? 'h-14 rounded-2xl border border-border/50 bg-white/92 px-5 shadow-[0_12px_40px_-16px_rgba(23,32,51,0.22)] backdrop-blur-xl'
                : 'h-16 bg-transparent',
          )}
        >
          <button type="button" onClick={() => onNavigate(ROUTES.home)} className="flex items-center gap-2.5">
            <BrandLogo size="md" alt={BRAND_NAME} ring={navScrolled || mobileNavOpen ? 'subtle' : 'light'} />
            <span className={cn('hidden font-bold tracking-tight sm:inline', !navScrolled && !mobileNavOpen && 'text-white')}>
              CaisseCI
            </span>
          </button>
          <nav className={cn('hidden items-center gap-1 text-sm font-medium md:flex', navScrolled || mobileNavOpen ? 'text-ink-muted' : 'text-slate-300')}>
            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                type="button"
                className={cn(
                  'rounded-lg px-3.5 py-2 transition',
                  navScrolled || mobileNavOpen ? 'hover:bg-surface-muted hover:text-ink' : 'hover:bg-white/10 hover:text-white',
                )}
                onClick={() => scrollTo(link.id)}
              >
                {link.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <Button type="button" variant="ghost" size="sm" className={cn(!navScrolled && !mobileNavOpen && 'text-slate-200 hover:bg-white/10 hover:text-white')} onClick={() => onNavigate(ROUTES.login)}>
                Connexion
              </Button>
              <Button type="button" variant="primary" size="sm" className={cn(!navScrolled && !mobileNavOpen && 'marketing-cta-glow')} onClick={() => onNavigate(signupUrl('pro'))} iconRight={<IconArrowRight className="h-3.5 w-3.5" />}>
                Essai gratuit
              </Button>
            </div>
            <button
              type="button"
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl border transition md:hidden',
                navScrolled || mobileNavOpen
                  ? 'border-border/60 bg-white text-ink hover:bg-surface-muted'
                  : 'border-white/15 bg-white/10 text-white hover:bg-white/15',
              )}
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-expanded={mobileNavOpen ? 'true' : 'false'}
              aria-label={mobileNavOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {mobileNavOpen ? (
                <IconClose className="h-5 w-5 text-rose-500" />
              ) : (
                <IconMenu
                  className={cn(
                    'h-5 w-5',
                    navScrolled || mobileNavOpen ? 'text-indigo-600' : 'text-sky-300',
                  )}
                />
              )}
            </button>
          </div>
        </div>

        {mobileNavOpen ? (
          <div className="mx-auto max-w-7xl border-t border-border/40 bg-white/98 px-4 py-5 shadow-lg backdrop-blur-xl md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.label}
                  type="button"
                  className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-surface-muted"
                  onClick={() => scrollTo(link.id)}
                >
                  {link.label}
                </button>
              ))}
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" className="w-full" onClick={() => { setMobileNavOpen(false); onNavigate(ROUTES.login) }}>
                Connexion
              </Button>
              <Button type="button" variant="primary" className="w-full marketing-cta-glow" onClick={() => { setMobileNavOpen(false); onNavigate(signupUrl('pro')) }}>
                Essai gratuit
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <MarketingHero
        trialDays={trialDays}
        mobileMoney={mobileMoney}
        onStart={() => onNavigate(signupUrl('pro'))}
        onPricing={() => scrollTo('tarifs')}
      />

      <MarketingTrustBar />
      <MarketingModulesSection />
      <div id="secteurs">
        <MarketingUseCases />
      </div>
      <MarketingIntegrationsStrip />
      <MarketingSocialProof />
      <MarketingStepsSection />
      <MarketingPricingSection
        scrollToPricing={scrollToPricing}
        onSelectPlan={(planId: PlanId) => onNavigate(signupUrl(planId))}
      />
      <MarketingFaqAccordion />
      <MarketingFinalCta onNavigate={onNavigate} />
      <MarketingFooter trialDays={trialDays} onNavigate={onNavigate} onScrollTo={scrollTo} />

      <MarketingStickyCta
        onStart={() => onNavigate(signupUrl('pro'))}
        onLogin={() => onNavigate(ROUTES.login)}
      />
    </div>
  )
}

