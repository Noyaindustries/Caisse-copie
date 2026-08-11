import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MobileMoneyCheckoutModal } from '../components/MobileMoneyCheckoutModal'

import { SubscriptionBillingSection } from '../components/subscription/SubscriptionBillingSection'

import { SubscriptionHero } from '../components/subscription/SubscriptionHero'

import { StorefrontBrandingSection } from '../components/subscription/StorefrontBrandingSection'

import { SubscriptionPlansSection } from '../components/subscription/SubscriptionPlansSection'

import { useActiveStore } from '../context/ActiveStoreContext'

import { useSubscription } from '../context/SubscriptionContext'

import {
  getLastStorefrontPublishedAt,
  publishActiveStorefrontMenu,
} from '../lib/storefront/autoPublish'

import { storefrontUrl } from '../lib/siteRoutes'

import {

  fetchPaymentHistory,

  fetchPlans,

  openBillingPortal,

  startCheckout,

  updateBillingSettings,

} from '../lib/subscription/api'

import { planLabel } from '../lib/subscription/plans'

import type { MobileMoneyPaymentRecord, PlanDefinition, PlanId } from '../lib/subscription/types'

import { Badge } from '../ui/Badge'

import { EmptyState } from '../ui/EmptyState'

import { Kpi } from '../ui/Kpi'

import { useToast } from '../ui/Toast'

import { cn } from '../ui/cn'

import {

  IconClock,

  IconMobile,

  IconShield,

  IconSparkles,

  IconZap,

} from '../ui/icons'

import { daysUntil } from '../components/subscription/subscriptionUi'
import { useHorizontalWheelScroll } from '../hooks/useHorizontalWheelScroll'



const SECTION_NAV = [

  { id: 'sub-overview', label: 'Vue d’ensemble' },

  { id: 'sub-appearance', label: 'Apparence' },

  { id: 'sub-plans', label: 'Formules' },

  { id: 'sub-billing', label: 'Facturation' },

] as const



function scrollToSection(id: string) {

  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

}



export function SubscriptionView() {

  const toast = useToast()

  const { subscription, refresh, usable, online } = useSubscription()

  const { activeStoreId } = useActiveStore()

  const [plans, setPlans] = useState<PlanDefinition[]>([])

  const [stripeEnabled, setStripeEnabled] = useState(false)

  const [mobileMoneyEnabled, setMobileMoneyEnabled] = useState(false)

  const [trialDays, setTrialDays] = useState(30)

  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null)

  const [portalBusy, setPortalBusy] = useState(false)

  const [mobilePlan, setMobilePlan] = useState<PlanDefinition | null>(null)

  const [payments, setPayments] = useState<MobileMoneyPaymentRecord[]>([])

  const [historyBusy, setHistoryBusy] = useState(false)

  const [billingPhone, setBillingPhone] = useState('')

  const [smsRemindersEnabled, setSmsRemindersEnabled] = useState(true)

  const [settingsBusy, setSettingsBusy] = useState(false)

  const [publishBusy, setPublishBusy] = useState(false)
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(() =>
    getLastStorefrontPublishedAt(),
  )

  const [activeSection, setActiveSection] = useState<string>(SECTION_NAV[0].id)

  const sectionNavScrollRef = useRef<HTMLDivElement>(null)
  useHorizontalWheelScroll(sectionNavScrollRef)



  const boutiqueKey =
    subscription?.storefrontKey ||
    subscription?.storeSlug ||
    subscription?.storeCode ||
    null

  const boutiqueLink = boutiqueKey ? storefrontUrl(boutiqueKey) : null



  const handleCopy = useCallback(

    (text: string, label: string) => {

      void navigator.clipboard

        .writeText(text)

        .then(() => toast.success(label))

        .catch(() => toast.error('Copie impossible'))

    },

    [toast],

  )



  const handlePublishStorefront = useCallback(async () => {
    if (!subscription?.licenseKey) return
    setPublishBusy(true)
    try {
      const result = await publishActiveStorefrontMenu({
        licenseKey: subscription.licenseKey,
        storeId: activeStoreId,
        force: true,
      })
      setLastPublishedAt(result.publishedAt)
      toast.success(`Boutique publiée · ${result.productCount} article(s)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publication impossible')
    } finally {
      setPublishBusy(false)
    }
  }, [subscription?.licenseKey, activeStoreId, toast])

  useEffect(() => {
    const refreshPublishedAt = () => {
      setLastPublishedAt(getLastStorefrontPublishedAt())
    }
    refreshPublishedAt()
    const id = window.setInterval(refreshPublishedAt, 5_000)
    return () => window.clearInterval(id)
  }, [])



  useEffect(() => {

    void fetchPlans()

      .then((data) => {

        setPlans(data.plans)

        setStripeEnabled(data.stripeEnabled)

        setMobileMoneyEnabled(data.mobileMoneyEnabled)

        setTrialDays(data.trialDays)

      })

      .catch(() => {

        toast.error('Plans indisponibles', 'Vérifiez que le serveur API est démarré.')

      })

  }, [toast])



  useEffect(() => {

    if (!subscription) return

    setBillingPhone(subscription.billingPhone ?? '')

    setSmsRemindersEnabled(subscription.smsRemindersEnabled ?? true)

  }, [subscription])



  const loadHistory = useCallback(async () => {

    if (!subscription) return

    setHistoryBusy(true)

    try {

      const data = await fetchPaymentHistory(subscription.licenseKey)

      setPayments(data.payments)

    } catch {

      toast.error('Historique', 'Impossible de charger les paiements.')

    } finally {

      setHistoryBusy(false)

    }

  }, [subscription, toast])



  useEffect(() => {

    void loadHistory()

  }, [loadHistory])



  useEffect(() => {

    const ids = SECTION_NAV.map((s) => s.id)

    const obs = new IntersectionObserver(

      (entries) => {

        const visible = entries

          .filter((e) => e.isIntersecting)

          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (visible?.target.id) setActiveSection(visible.target.id)

      },

      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5] },

    )

    for (const id of ids) {

      const el = document.getElementById(id)

      if (el) obs.observe(el)

    }

    return () => obs.disconnect()

  }, [subscription])



  const handleCheckout = useCallback(

    async (planId: PlanId) => {

      if (!subscription) return

      setBusyPlan(planId)

      try {

        const url = await startCheckout(subscription.licenseKey, planId)

        window.location.href = url

      } catch (err) {

        toast.error(

          'Paiement carte',

          err instanceof Error ? err.message : 'Impossible de démarrer le paiement.',

        )

      } finally {

        setBusyPlan(null)

      }

    },

    [subscription, toast],

  )



  const handlePortal = useCallback(async () => {

    if (!subscription) return

    setPortalBusy(true)

    try {

      const url = await openBillingPortal(subscription.licenseKey)

      window.location.href = url

    } catch (err) {

      toast.error(

        'Portail client',

        err instanceof Error ? err.message : 'Portail indisponible.',

      )

    } finally {

      setPortalBusy(false)

    }

  }, [subscription, toast])



  const handleSaveSettings = useCallback(async () => {

    if (!subscription) return

    setSettingsBusy(true)

    try {

      await updateBillingSettings(subscription.licenseKey, {

        billingPhone,

        smsRemindersEnabled,

      })

      await refresh()

      toast.success('Rappels SMS', 'Paramètres enregistrés.')

    } catch (err) {

      toast.error(

        'Paramètres',

        err instanceof Error ? err.message : 'Enregistrement impossible.',

      )

    } finally {

      setSettingsBusy(false)

    }

  }, [subscription, billingPhone, smsRemindersEnabled, refresh, toast])



  const expiryIso = useMemo(() => {

    if (!subscription) return null

    if (subscription.status === 'trialing') return subscription.trialEndsAt

    return subscription.currentPeriodEnd

  }, [subscription])



  const daysLeft = useMemo(() => daysUntil(expiryIso), [expiryIso])



  const acceptedPayments = useMemo(

    () => payments.filter((p) => p.status === 'accepted').length,

    [payments],

  )



  if (!subscription) {

    return (

      <div className="flex min-h-[50vh] items-center justify-center p-8">

        <EmptyState

          icon={<IconShield />}

          title="Aucune organisation"

          description="Associez un magasin pour gérer votre abonnement."

        />

      </div>

    )

  }



  const currentPlanId = subscription.planId

  const canPayOnline = stripeEnabled || mobileMoneyEnabled



  return (

    <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6">

      <nav

        className="sticky top-0 z-30 -mx-4 mb-6 border-b border-[rgba(184,146,46,0.2)] bg-[#f7f3eb]/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6"

        aria-label="Sections abonnement"

      >

        <div ref={sectionNavScrollRef} className="tabs-scroll-x flex gap-1 overflow-x-auto">

          {SECTION_NAV.map((item) => (

            <button

              key={item.id}

              type="button"

              onClick={() => scrollToSection(item.id)}

              className={cn(

                'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition',

                activeSection === item.id

                  ? 'bg-[#1c1812] text-[#f7f0e3] shadow-sm'

                  : 'text-ink-muted hover:bg-white/80 hover:text-ink',

              )}

            >

              {item.label}

            </button>

          ))}

        </div>

      </nav>



      <div id="sub-overview" className="scroll-mt-28 space-y-10">

        <SubscriptionHero

          subscription={subscription}

          usable={usable}

          online={online}

          trialDays={trialDays}

          expiryIso={expiryIso}

          daysLeft={daysLeft}

          boutiqueLink={boutiqueLink}

          stripePortalEnabled={stripeEnabled && subscription.stripeEnabled}

          portalBusy={portalBusy}

          publishBusy={publishBusy}
          lastPublishedAt={lastPublishedAt}
          canPublish={online && usable}
          onRefresh={() => void refresh()}
          onPortal={() => void handlePortal()}
          onCopy={handleCopy}
          onPublish={() => void handlePublishStorefront()}
        />

        <StorefrontBrandingSection
          boutiqueLink={boutiqueLink}
          online={online}
          usable={usable}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <Kpi

            label="Plan actuel"

            value={planLabel(currentPlanId)}

            hint={subscription.email}

            tone="violet"

            icon={<IconSparkles />}

            spark={[3, 4, 4, 5, 5, 6]}

          />

          <Kpi

            label={subscription.status === 'trialing' ? 'Jours d’essai restants' : 'Jours restants'}

            value={daysLeft !== null ? daysLeft : '—'}

            hint={expiryIso ? `Échéance proche` : undefined}

            tone="accent"

            icon={<IconClock />}

            spark={
              daysLeft !== null
                ? [
                    trialDays,
                    Math.max(0, trialDays - 4),
                    Math.max(0, trialDays - 8),
                    Math.max(0, trialDays - 12),
                    daysLeft + 2,
                    daysLeft,
                  ]
                : undefined
            }

          />

          <Kpi

            label="Paiements validés"

            value={acceptedPayments}

            hint={`${payments.length} transaction${payments.length > 1 ? 's' : ''}`}

            tone="amber"

            icon={<IconMobile />}

          />

          <Kpi

            label="Mode hors ligne"

            value="7 jours"

            hint="Licence en cache locale"

            tone="sky"

            icon={<IconShield />}

          />

        </div>



        {!usable ? (

          <div className="flex items-start gap-4 rounded-2xl border border-amber-200/80 bg-linear-to-r from-amber-50 to-orange-50 px-5 py-5 shadow-sm">

            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">

              <IconZap className="h-5 w-5" />

            </span>

            <div>

              <div className="flex flex-wrap items-center gap-2">

                <p className="font-bold text-amber-950">Abonnement inactif ou expiré</p>

                <Badge tone="warning">Action requise</Badge>

              </div>

              <p className="mt-2 text-sm leading-relaxed text-amber-900/85">

                Choisissez une formule ci-dessous pour réactiver tous les modules. La consultation

                de base reste accessible.

              </p>

            </div>

          </div>

        ) : null}

      </div>



      <div className="mt-14">

        <SubscriptionPlansSection

          plans={plans}

          currentPlanId={currentPlanId}

          trialDays={trialDays}

          canPayOnline={canPayOnline}

          mobileMoneyEnabled={mobileMoneyEnabled}

          stripeEnabled={stripeEnabled}

          busyPlan={busyPlan}

          onMobilePay={setMobilePlan}

          onCardPay={(id) => void handleCheckout(id)}

        />

      </div>



      <div className="mt-14">

        <SubscriptionBillingSection

          billingPhone={billingPhone}

          smsRemindersEnabled={smsRemindersEnabled}

          settingsBusy={settingsBusy}

          online={online}

          payments={payments}

          historyBusy={historyBusy}

          onBillingPhoneChange={setBillingPhone}

          onSmsToggle={setSmsRemindersEnabled}

          onSaveSettings={() => void handleSaveSettings()}

          onRefreshHistory={() => void loadHistory()}

        />

      </div>



      {mobilePlan ? (

        <MobileMoneyCheckoutModal

          open

          onClose={() => setMobilePlan(null)}

          licenseKey={subscription.licenseKey}

          planId={mobilePlan.id}

          planName={mobilePlan.name}

          amountFcfa={mobilePlan.priceFcfa}

          storeCode={subscription.storeCode}

        />

      ) : null}

    </div>

  )

}


