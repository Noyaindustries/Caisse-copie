import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { NavViewId } from '../navigation'
import { refreshSubscription, verifyMobileMoneyPayment } from '../lib/subscription/api'
import { planAtLeast, viewAllowedByPlan } from '../lib/subscription/plans'
import {
  clearOrganizationCredentials,
  effectiveUsable,
  getCachedSubscription,
  getOrganizationCredentials,
  setCachedSubscription,
  setOrganizationCredentials,
} from '../lib/subscription/store'
import type { OrganizationCredentials, PlanId, SubscriptionSnapshot } from '../lib/subscription/types'

type SubscriptionContextValue = {
  ready: boolean
  organization: OrganizationCredentials | null
  subscription: SubscriptionSnapshot | null
  usable: boolean
  online: boolean
  completeOnboarding: (snap: SubscriptionSnapshot) => void
  refresh: () => Promise<void>
  disconnect: () => void
  canAccessView: (view: NavViewId) => boolean
  hasPlan: (planId: PlanId) => boolean
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

export function SubscriptionProvider({
  online,
  children,
}: {
  online: boolean
  children: ReactNode
}) {
  const [ready, setReady] = useState(false)
  const [organization, setOrganization] = useState<OrganizationCredentials | null>(
    () => getOrganizationCredentials(),
  )
  const [subscription, setSubscription] = useState<SubscriptionSnapshot | null>(
    () => getCachedSubscription(),
  )

  const applySnapshot = useCallback((snap: SubscriptionSnapshot) => {
    setSubscription(snap)
    setCachedSubscription(snap)
    setOrganization({
      licenseKey: snap.licenseKey,
      organizationId: snap.organizationId,
      name: snap.name,
      storeCode: snap.storeCode,
    })
    setOrganizationCredentials({
      licenseKey: snap.licenseKey,
      organizationId: snap.organizationId,
      name: snap.name,
      storeCode: snap.storeCode,
    })
  }, [])

  const refresh = useCallback(async () => {
    const creds = getOrganizationCredentials()
    if (!creds) return
    try {
      const snap = await refreshSubscription(creds.licenseKey)
      applySnapshot(snap)
    } catch {
      const cached = getCachedSubscription()
      if (cached) setSubscription(cached)
    }
  }, [applySnapshot])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const creds = getOrganizationCredentials()
      if (creds && online) {
        try {
          const snap = await refreshSubscription(creds.licenseKey)
          if (!cancelled) applySnapshot(snap)
        } catch {
          const cached = getCachedSubscription()
          if (!cancelled && cached) setSubscription(cached)
        }
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [applySnapshot, online])

  useEffect(() => {
    if (!online || !organization) return
    const id = window.setInterval(() => {
      void refresh()
    }, 15 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [online, organization, refresh])

  useEffect(() => {
    const creds = getOrganizationCredentials()
    if (!creds || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('subscription') !== 'success') return
    const tx = params.get('tx')?.trim()
    if (!tx) return

    void (async () => {
      try {
        const result = await verifyMobileMoneyPayment(creds.licenseKey, tx)
        if (result.status === 'accepted') {
          await refresh()
        }
      } finally {
        params.delete('subscription')
        params.delete('tx')
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
        window.history.replaceState({}, '', next)
      }
    })()
  }, [refresh])

  const completeOnboarding = useCallback(
    (snap: SubscriptionSnapshot) => {
      applySnapshot(snap)
    },
    [applySnapshot],
  )

  const disconnect = useCallback(() => {
    clearOrganizationCredentials()
    setOrganization(null)
    setSubscription(null)
  }, [])

  const usable = effectiveUsable(subscription, online)

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      ready,
      organization,
      subscription,
      usable,
      online,
      completeOnboarding,
      refresh,
      disconnect,
      canAccessView: (view: NavViewId) => {
        if (view === 'subscription') return true
        if (!subscription) return false
        const freeWhenExpired: NavViewId[] = [
          'caisse',
          'dash',
          'catalogue',
          'stocks',
          'journal',
          'pointage',
          'personnel',
        ]
        if (!usable) return freeWhenExpired.includes(view)
        return viewAllowedByPlan(view, subscription.planId)
      },
      hasPlan: (planId: PlanId) => {
        if (!subscription) return false
        return planAtLeast(subscription.planId, planId)
      },
    }),
    [
      ready,
      organization,
      subscription,
      usable,
      online,
      completeOnboarding,
      refresh,
      disconnect,
    ],
  )

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) {
    throw new Error('useSubscription doit être utilisé dans SubscriptionProvider')
  }
  return ctx
}
