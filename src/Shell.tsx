import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { effectivePermissions } from './auth/permissions'
import { clearStaffSession } from './auth/session'
import type { StaffProfile } from './auth/types'
import { AddProductModal } from './components/AddProductModal'
import { CartPanel } from './components/CartPanel'
import { CaisseHeader } from './components/CaisseHeader'
import { OfflineBanner } from './components/OfflineBanner'
import { ReceiptModal } from './components/ReceiptModal'
import { ProductGrid, type ProductGridDensity } from './components/ProductGrid'
import { MobileNavDrawer, Sidebar, type CategoryTab } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { useActiveStore } from './context/ActiveStoreContext'
import { SubscriptionBanner } from './components/SubscriptionBanner'
import { useSubscription } from './context/SubscriptionContext'
import {
  filterNavSections,
  flattenedNavViewIds,
  navSectionsForRole,
  type NavViewId,
} from './navigation'
import { DashboardView } from './views/DashboardView'
import {
  db,
  ensureAllStoreStockRows,
  syncProductCategoriesFromProducts,
} from './db/db'
import type {
  CartLine,
  OnlineOrder,
  Product,
  ProductWithStock,
  Sale,
  TicketInvoice,
  DiningTableStatus,
} from './db/types'
import {
  confirmCheckoutSummary,
  defaultCheckoutPayment,
  validateCheckoutPayment,
  type CheckoutPaymentState,
} from './lib/checkoutPayment'
import { DEFAULT_VAT_RATE_PCT, formatFCFA, totalsFromLinesTTC } from './lib/money'
import { productImageSrc } from './lib/productImage'
import { appendAuditEvent } from './lib/auditLog'
import { logCartCancellation } from './lib/refundApply'
import { SESSION_ID } from './lib/session'
import {
  cleanupStaleTerminalNodes,
  touchTerminalSyncTimestamp,
  upsertTerminalPresence,
} from './lib/terminalSync'
import { useBarcodeScannerWedge } from './hooks/useBarcodeScannerWedge'
import { storeStockRowId } from './lib/storeStockId'
import {
  formatLastSyncRelative,
  getLastSyncTimestamp,
} from './lib/syncMeta'
import { saleLocalYmd } from './lib/salesStats'
import { flushSyncQueue } from './lib/sync'
import {
  getDeviceConnectivityDemo,
  getKitchenStationDemo,
  isKitchenModuleDemoOn,
} from './lib/integrationsConfig'
import { Tabs } from './ui/Tabs'
import { Button } from './ui/Button'
import { useToast } from './ui/Toast'
import { IconArrowRight, IconReceipt, IconShield } from './ui/icons'

const DEBUG_LOG_ENDPOINT =
  'http://127.0.0.1:27772/ingest/cd30ae75-d94c-4f4b-a62c-8232a969c0d0'

function debugLog(
  location: string,
  message: string,
  hypothesisId: string,
  data: Record<string, unknown>,
): void {
  // #region agent log
  fetch(DEBUG_LOG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '5007b8',
    },
    body: JSON.stringify({
      sessionId: '5007b8',
      runId: 'run1',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}

type Props = {
  staff: StaffProfile
  online: boolean
  onLogout: () => void
}

type FlyToCartAnim = {
  id: number
  src: string
  x: number
  y: number
  dx: number
  dy: number
  active: boolean
}

function tableStatusLabel(status: DiningTableStatus): string {
  if (status === 'free') return 'libre'
  if (status === 'occupied') return 'occupée'
  if (status === 'reserved') return 'réservée'
  return 'nettoyage'
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

const SIDEBAR_KEY = 'caisseci-sidebar-collapsed'

const CatalogueView = lazy(() =>
  import('./views/CatalogueView').then((m) => ({ default: m.CatalogueView })),
)
const StocksView = lazy(() =>
  import('./views/StocksView').then((m) => ({ default: m.StocksView })),
)
const ComptabiliteView = lazy(() =>
  import('./views/ComptabiliteView').then((m) => ({
    default: m.ComptabiliteView,
  })),
)
const RhManagementView = lazy(() =>
  import('./views/RhManagementView').then((m) => ({
    default: m.RhManagementView,
  })),
)
const CrmView = lazy(() =>
  import('./views/CrmView').then((m) => ({ default: m.CrmView })),
)
const TablesManagementView = lazy(() =>
  import('./views/TablesManagementView').then((m) => ({
    default: m.TablesManagementView,
  })),
)
const PromotionsView = lazy(() =>
  import('./views/PromotionsView').then((m) => ({
    default: m.PromotionsView,
  })),
)
const LoyaltyProgramView = lazy(() =>
  import('./views/LoyaltyProgramView').then((m) => ({
    default: m.LoyaltyProgramView,
  })),
)
const KitchenView = lazy(() =>
  import('./views/KitchenView').then((m) => ({ default: m.KitchenView })),
)
const TicketsFacturesView = lazy(() =>
  import('./views/TicketsFacturesView').then((m) => ({
    default: m.TicketsFacturesView,
  })),
)
const OnlineOrdersValidationView = lazy(() =>
  import('./views/OnlineOrdersValidationView').then((m) => ({
    default: m.OnlineOrdersValidationView,
  })),
)
const JournalReportView = lazy(() =>
  import('./views/JournalReportView').then((m) => ({
    default: m.JournalReportView,
  })),
)
const PersonnelView = lazy(() =>
  import('./views/PersonnelView').then((m) => ({ default: m.PersonnelView })),
)
const PointageView = lazy(() =>
  import('./views/PointageView').then((m) => ({ default: m.PointageView })),
)
const AnalytiqueView = lazy(() =>
  import('./views/AnalytiqueView').then((m) => ({ default: m.AnalytiqueView })),
)
const IntegrationsView = lazy(() =>
  import('./views/IntegrationsView').then((m) => ({
    default: m.IntegrationsView,
  })),
)
const MultiStoreView = lazy(() =>
  import('./views/MultiStoreView').then((m) => ({ default: m.MultiStoreView })),
)
const SubscriptionView = lazy(() =>
  import('./views/SubscriptionView').then((m) => ({
    default: m.SubscriptionView,
  })),
)

export function Shell({ staff, online, onLogout }: Props) {
  const {
    displayProducts,
    activeStoreId,
    activeStore,
    stores,
    setActiveStoreId,
    canSwitchStore,
  } = useActiveStore()

  const toast = useToast()
  const { canAccessView } = useSubscription()

  const perms = useMemo(() => effectivePermissions(staff), [staff])
  const navSections = useMemo(() => {
    const roleSections =
      staff.role === 'admin'
        ? navSectionsForRole(staff.role)
        : navSectionsForRole(staff.role).map((section) => ({
            ...section,
            items: section.items.filter((item) => item.id !== 'subscription'),
          }))
    return filterNavSections(roleSections, canAccessView)
  }, [staff.role, canAccessView])
  const allowedViews = useMemo(() => {
    return flattenedNavViewIds(navSections)
  }, [navSections])

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed])

  const [addProductOpen, setAddProductOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [category, setCategory] = useState<CategoryTab>('Tous')
  const [productGridDensity, setProductGridDensity] =
    useState<ProductGridDensity>('compact')
  const [cart, setCart] = useState<CartLine[]>([])
  const [discountPct, setDiscountPct] = useState(0)
  const [promoInput, setPromoInput] = useState('')
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null)
  const [appliedPromotionId, setAppliedPromotionId] = useState<string | null>(null)
  const [selectedTableId, setSelectedTableId] = useState('')
  const [loyaltyPhoneInput, setLoyaltyPhoneInput] = useState('')
  const [loyaltyRedeemInput, setLoyaltyRedeemInput] = useState('')
  const [checkoutPayment, setCheckoutPayment] = useState<CheckoutPaymentState>(
    () => defaultCheckoutPayment(),
  )
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [activeView, setActiveView] = useState<NavViewId>('caisse')
  const [isFloatingCartOpen, setIsFloatingCartOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState<
    | { type: 'sale'; sale: Sale; autoPrint: boolean }
    | { type: 'onlineOrder'; order: OnlineOrder; autoPrint: boolean }
    | { type: 'ticketInvoice'; ticketInvoice: TicketInvoice; autoPrint: boolean }
    | null
  >(null)
  const [syncMetaTick, setSyncMetaTick] = useState(0)
  const [syncBusy, setSyncBusy] = useState(false)
  const [pendingLeaveCartUntil, setPendingLeaveCartUntil] = useState(0)
  const [pendingCancelCartUntil, setPendingCancelCartUntil] = useState(0)
  const [pendingCashDrawerBypassUntil, setPendingCashDrawerBypassUntil] = useState(0)
  const [pendingCheckoutUntil, setPendingCheckoutUntil] = useState(0)
  const [deviceConnectivity, setDeviceConnectivity] = useState(() =>
    getDeviceConnectivityDemo(),
  )

  const barcodeFieldRef = useRef<HTMLInputElement>(null)
  const sidebarCartCountRef = useRef<HTMLSpanElement>(null)
  const drawerCartCountRef = useRef<HTMLSpanElement>(null)
  const mobileFabBadgeRef = useRef<HTMLSpanElement>(null)
  const mobileFabEmptyRef = useRef<HTMLButtonElement>(null)
  const flyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevCartItemCountRef = useRef(0)
  const [, setFlyToCart] = useState<FlyToCartAnim | null>(null)

  const queueItems = useLiveQuery(() => db.syncQueue.toArray(), [], []) ?? []
  const productCategoryRows =
    useLiveQuery(
      () => db.productCategories.orderBy('sortOrder').toArray(),
      [],
      [],
    ) ?? []
  const categoryTabs = useMemo<CategoryTab[]>(() => {
    return ['Tous', ...productCategoryRows.map((r) => r.name)]
  }, [productCategoryRows])

  useEffect(() => {
    if (categoryTabs.length === 0) return
    if (!categoryTabs.includes(category)) {
      setCategory('Tous')
    }
  }, [categoryTabs, category])

  const onlineOrdersPending =
    useLiveQuery(
      () => db.onlineOrders.where('status').equals('pending').count(),
      [],
      0,
    ) ?? 0
  const diningTables =
    useLiveQuery(
      () =>
        db.diningTables.where('storeId').equals(activeStoreId).sortBy('sortOrder'),
      [activeStoreId],
      [],
    ) ?? []
  const promotions = useLiveQuery(() => db.promotions.toArray(), [], []) ?? []
  const dayClosureToday = useLiveQuery(
    () => db.dayClosures.get(saleLocalYmd(Date.now())),
    [],
    undefined,
  )
  const loyaltyCustomers =
    useLiveQuery(() => db.loyaltyCustomers.toArray(), [], []) ?? []

  useEffect(() => {
    if (!selectedTableId) return
    if (!diningTables.some((t) => t.id === selectedTableId)) {
      setSelectedTableId('')
    }
  }, [diningTables, selectedTableId])

  const refreshSyncMeta = useCallback(() => {
    setSyncMetaTick((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!online) return
    void flushSyncQueue().then((r) => {
      if (r.mode === 'cloud' || r.mode === 'local') {
        refreshSyncMeta()
      }
      if (r.mode === 'failed' && r.error) {
        console.warn('[Sync]', r.error)
      }
    })
  }, [online, refreshSyncMeta])

  useEffect(() => {
    let disposed = false
    const tick = async () => {
      if (disposed) return
      await upsertTerminalPresence({
        storeId: activeStoreId,
        storeName: activeStore?.name,
        profileId: staff.id,
        profileDisplayName: staff.displayName,
      })
      await cleanupStaleTerminalNodes()
    }
    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 15_000)
    return () => {
      disposed = true
      window.clearInterval(id)
    }
  }, [activeStoreId, activeStore?.name, staff.id, staff.displayName])

  useEffect(() => {
    if (online) return
    setCheckoutPayment((p) => {
      if (p.mixed) {
        return { ...p, mixed: false, method: 'cash' }
      }
      if (p.method !== 'cash') {
        return { ...p, method: 'cash' }
      }
      return p
    })
  }, [online])

  useEffect(() => {
    if (cart.length === 0) return
    setCheckoutPayment((p) => {
      if (p.mixed || p.method !== 'cash') return p
      if (p.cashReceived.trim() !== '') return p
      const t = Math.round(totalsFromLinesTTC(cart, discountPct).totalTTC)
      return { ...p, cashReceived: String(t) }
    })
  }, [cart, discountPct])

  useEffect(() => {
    if (activeView !== 'caisse' && isFloatingCartOpen) {
      setIsFloatingCartOpen(false)
    }
  }, [activeView, isFloatingCartOpen])

  useEffect(() => {
    return () => {
      if (flyTimeoutRef.current) {
        clearTimeout(flyTimeoutRef.current)
      }
    }
  }, [])

  const patchCheckoutPayment = useCallback(
    (patch: Partial<CheckoutPaymentState>) => {
      setCheckoutPayment((prev) => ({ ...prev, ...patch }))
    },
    [],
  )

  useEffect(() => {
    if (!allowedViews.has(activeView)) {
      setActiveView('caisse')
    }
  }, [staff.role, activeView, allowedViews])

  useEffect(() => {
    setDeviceConnectivity(getDeviceConnectivityDemo())
  }, [activeView])

  useEffect(() => {
    setDiscountPct((d) => Math.min(d, perms.maxDiscountPct))
  }, [perms.maxDiscountPct])

  const lowStockCount = useMemo(
    () =>
      displayProducts.filter(
        (p) => p.stock > 0 && p.stock <= p.lowStockThreshold,
      ).length,
    [displayProducts],
  )

  const ruptureCount = useMemo(
    () => displayProducts.filter((p) => p.stock <= 0).length,
    [displayProducts],
  )
  const cartItemCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.qty, 0),
    [cart],
  )

  const canLeaveCaisseWithCart = useCallback(
    (targetView: NavViewId) => {
      if (activeView !== 'caisse') return true
      if (targetView === 'caisse') return true
      if (cartItemCount === 0) return true
      const now = new Date().getTime()
      if (now > pendingLeaveCartUntil) {
        setPendingLeaveCartUntil(now + 7000)
        toast.warning(
          'Panier en cours',
          'Cliquez encore pour quitter la caisse sans encaisser (7s).',
        )
        return false
      }
      return true
    },
    [activeView, cartItemCount, pendingLeaveCartUntil, toast],
  )

  const handleSelectView = useCallback(
    (targetView: NavViewId) => {
      if (!canLeaveCaisseWithCart(targetView)) return
      setActiveView(targetView)
    },
    [canLeaveCaisseWithCart],
  )

  useEffect(() => {
    if (cartItemCount === 0) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [cartItemCount])

  useEffect(() => {
    const prev = prevCartItemCountRef.current
    if (prev > 0 && cartItemCount === 0 && isFloatingCartOpen) {
      setIsFloatingCartOpen(false)
    }
    prevCartItemCountRef.current = cartItemCount
  }, [cartItemCount, isFloatingCartOpen])

  const cartTotalTTC = useMemo(
    () => Math.round(totalsFromLinesTTC(cart, discountPct).totalTTC),
    [cart, discountPct],
  )
  const activeLoyaltyCustomer = useMemo(() => {
    const phone = normalizePhone(loyaltyPhoneInput)
    if (!phone) return null
    return loyaltyCustomers.find((c) => c.phone === phone) ?? null
  }, [loyaltyCustomers, loyaltyPhoneInput])
  const loyaltyRedeemPoints = useMemo(() => {
    const raw = Number.parseInt(loyaltyRedeemInput.trim() || '0', 10)
    if (!Number.isFinite(raw) || raw <= 0) return 0
    const maxByWallet = activeLoyaltyCustomer?.points ?? 0
    return Math.max(0, Math.min(raw, maxByWallet))
  }, [loyaltyRedeemInput, activeLoyaltyCustomer?.points])
  const loyaltyRedeemAmountTTC = useMemo(() => {
    const gross = Math.round(totalsFromLinesTTC(cart, discountPct).totalTTC)
    const byPoints = loyaltyRedeemPoints * 10
    return Math.max(0, Math.min(byPoints, gross))
  }, [cart, discountPct, loyaltyRedeemPoints])
  const payableTotalTTC = useMemo(() => {
    const gross = Math.round(totalsFromLinesTTC(cart, discountPct).totalTTC)
    return Math.max(0, gross - loyaltyRedeemAmountTTC)
  }, [cart, discountPct, loyaltyRedeemAmountTTC])

  const syncLabel = useMemo(() => {
    const pending = queueItems.length
    const last = formatLastSyncRelative(getLastSyncTimestamp())
    if (online) {
      const base =
        pending === 0
          ? 'En ligne · File vide'
          : `En ligne · ${pending} à envoyer`
      return `${base} · Dernier envoi : ${last}`
    }
    return `Hors ligne · ${pending} en file · Dernier envoi : ${last}`
  }, [online, queueItems.length, syncMetaTick])

  const handleSyncNow = useCallback(async () => {
    if (!online) return
    setSyncBusy(true)
    try {
      const r = await flushSyncQueue()
      if (r.mode === 'cloud' || r.mode === 'local') {
        refreshSyncMeta()
        await touchTerminalSyncTimestamp()
        toast.success('Synchronisation terminée')
      }
      if (r.mode === 'failed' && r.error) {
        toast.error('Synchronisation échouée', r.error)
      }
    } finally {
      setSyncBusy(false)
    }
  }, [online, refreshSyncMeta, toast])

  const refocusBarcodeField = useCallback(() => {
    requestAnimationFrame(() => barcodeFieldRef.current?.focus())
  }, [])

  const pickFlyCartTargetEl = useCallback((): HTMLElement | null => {
    if (isFloatingCartOpen) {
      const d = drawerCartCountRef.current
      if (d && d.getClientRects().length > 0) return d
    }
    const s = sidebarCartCountRef.current
    if (s && s.getClientRects().length > 0) return s
    const b = mobileFabBadgeRef.current
    if (b && b.getClientRects().length > 0) return b
    const f = mobileFabEmptyRef.current
    if (f && f.getClientRects().length > 0) return f
    return null
  }, [isFloatingCartOpen])

  const triggerFlyToCart = useCallback(
    (product: ProductWithStock, originEl?: HTMLElement | null) => {
      const target = pickFlyCartTargetEl()
      if (!originEl || !target) return
      const from = originEl.getBoundingClientRect()
      const to = target.getBoundingClientRect()
      const fromX = from.left + from.width / 2
      const fromY = from.top + from.height / 2
      const toX = to.left + to.width / 2
      const toY = to.top + to.height / 2

      const animId = Date.now()
      setFlyToCart({
        id: animId,
        src: productImageSrc(product),
        x: fromX,
        y: fromY,
        dx: toX - fromX,
        dy: toY - fromY,
        active: false,
      })

      requestAnimationFrame(() => {
        setFlyToCart((prev) =>
          prev && prev.id === animId ? { ...prev, active: true } : prev,
        )
      })

      if (flyTimeoutRef.current) {
        clearTimeout(flyTimeoutRef.current)
      }
      flyTimeoutRef.current = setTimeout(() => {
        setFlyToCart((prev) => (prev && prev.id === animId ? null : prev))
        flyTimeoutRef.current = null
      }, 620)
    },
    [pickFlyCartTargetEl],
  )

  const handleAdd = useCallback(
    (p: ProductWithStock, originEl?: HTMLElement | null) => {
      if (p.archived) return
      const vat = p.vatRatePct ?? DEFAULT_VAT_RATE_PCT
      let didAdd = false
      setCart((prev) => {
        const line = prev.find((l) => l.productId === p.id)
        const currentQty = line?.qty ?? 0
        if (currentQty >= p.stock) return prev
        if (!line) {
          didAdd = true
          return [
            ...prev,
            {
              productId: p.id,
              name: p.name,
              unitPriceTTC: p.priceTTC,
              qty: 1,
              vatRatePct: vat,
            },
          ]
        }
        didAdd = true
        return prev.map((l) =>
          l.productId === p.id
            ? {
                ...l,
                qty: l.qty + 1,
                unitPriceTTC: p.priceTTC,
                name: p.name,
                vatRatePct: vat,
              }
            : l,
        )
      })
      if (didAdd) {
        triggerFlyToCart(p, originEl)
      }
    },
    [triggerFlyToCart],
  )

  const handleAddFromGrid = useCallback(
    (p: ProductWithStock, originEl?: HTMLElement | null) => {
      handleAdd(p, originEl)
      refocusBarcodeField()
    },
    [handleAdd, refocusBarcodeField],
  )

  const handleInc = useCallback(
    (productId: string) => {
      setCart((prev) => {
        const prod = displayProducts.find((x) => x.id === productId)
        if (!prod) return prev
        return prev.map((l) => {
          if (l.productId !== productId) return l
          if (l.qty >= prod.stock) return l
          return {
            ...l,
            qty: l.qty + 1,
            unitPriceTTC: prod.priceTTC,
            name: prod.name,
            vatRatePct: prod.vatRatePct ?? DEFAULT_VAT_RATE_PCT,
          }
        })
      })
    },
    [displayProducts],
  )

  const handleDec = useCallback((productId: string) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId ? { ...l, qty: l.qty - 1 } : l,
        )
        .filter((l) => l.qty > 0),
    )
  }, [])

  const handleRemove = useCallback((productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }, [])

  const handleClear = useCallback(() => {
    setCart([])
    setDiscountPct(0)
    setPromoInput('')
    setPromoFeedback(null)
    setAppliedPromotionId(null)
    setLoyaltyRedeemInput('')
    setLoyaltyPhoneInput('')
    setCheckoutPayment(defaultCheckoutPayment())
  }, [])

  const handleCancelCartTransaction = useCallback(async () => {
    if (cart.length === 0) return
    const now = new Date().getTime()
    if (now > pendingCancelCartUntil) {
      setPendingCancelCartUntil(now + 7000)
      toast.warning(
        'Confirmer annulation',
        'Cliquez encore sur annuler transaction dans les 7 secondes.',
      )
      return
    }
    const reason = ''
    try {
      await logCartCancellation({
        actor: {
          profileId: staff.id,
          displayName: staff.displayName,
        },
        reason: reason.trim(),
        cartSnapshot: {
          lines: cart.map((l) => ({
            productId: l.productId,
            name: l.name,
            qty: l.qty,
            unitPriceTTC: l.unitPriceTTC,
          })),
          discountPct,
        },
      })
      toast.info('Transaction annulée', 'Consignée dans le journal d’audit')
      setPendingCancelCartUntil(0)
    } catch (e) {
      toast.error(
        'Échec de l’annulation',
        e instanceof Error ? e.message : String(e),
      )
      return
    }
    handleClear()
  }, [cart, discountPct, staff.displayName, staff.id, handleClear, pendingCancelCartUntil, toast])

  const handleApplyPromo = useCallback(() => {
    const c = promoInput.trim().toUpperCase()
    const max = perms.maxDiscountPct
    const prevPct = discountPct
    const totalTTC = Math.round(totalsFromLinesTTC(cart, discountPct).totalTTC)
    const apply = (requestedPct: number, promotionId?: string) => {
      if (max <= 0) {
        setDiscountPct(0)
        setAppliedPromotionId(null)
        setPromoFeedback('Aucune remise autorisée pour ce profil')
        void appendAuditEvent({
          kind: 'promo_applied',
          actor: { profileId: staff.id, displayName: staff.displayName },
          reason: `Code ${c} refusé (remise non autorisée pour le profil)`,
          payload: {
            code: c,
            requestedPct,
            appliedPct: 0,
            previousPct: prevPct,
            maxDiscountPct: max,
          },
        })
        return
      }
      const applied = Math.min(requestedPct, max)
      setDiscountPct(applied)
      setAppliedPromotionId(promotionId ?? null)
      setPromoFeedback(
        applied < requestedPct
          ? `Remise plafonnée à ${max} % (profil)`
          : `Remise ${applied} % appliquée`,
      )
      void appendAuditEvent({
        kind: 'promo_applied',
        actor: { profileId: staff.id, displayName: staff.displayName },
        reason:
          applied < requestedPct
            ? `Code ${c} — remise ${applied} % (plafond profil ${max} %)`
            : `Code ${c} — remise ${applied} % appliquée`,
        payload: {
          code: c,
          requestedPct,
          appliedPct: applied,
          previousPct: prevPct,
          maxDiscountPct: max,
        },
      })
    }
    if (c === 'PROMO10') {
      apply(10)
      return
    }
    if (c === 'PROMO5') {
      apply(5)
      return
    }
    const now = Date.now()
    const promo = promotions.find((p) => p.code.toUpperCase() === c)
    if (!promo) {
      setAppliedPromotionId(null)
      setPromoFeedback('Code promo non reconnu')
      return
    }
    if (!promo.active) {
      setAppliedPromotionId(null)
      setPromoFeedback('Promotion inactive')
      return
    }
    if (promo.storeId && promo.storeId !== activeStoreId) {
      setAppliedPromotionId(null)
      setPromoFeedback('Code non valable pour ce magasin')
      return
    }
    if (promo.startAt != null && now < promo.startAt) {
      setAppliedPromotionId(null)
      setPromoFeedback('Promotion pas encore active')
      return
    }
    if (promo.endAt != null && now > promo.endAt) {
      setAppliedPromotionId(null)
      setPromoFeedback('Promotion expirée')
      return
    }
    if (promo.maxUsage != null && promo.usageCount >= promo.maxUsage) {
      setAppliedPromotionId(null)
      setPromoFeedback('Limite d’utilisation atteinte')
      return
    }
    if (promo.minCartTTC != null && totalTTC < promo.minCartTTC) {
      setAppliedPromotionId(null)
      setPromoFeedback(`Panier minimum requis: ${formatFCFA(promo.minCartTTC)}`)
      return
    }
    apply(promo.discountPct, promo.id)
  }, [
    promoInput,
    perms.maxDiscountPct,
    discountPct,
    staff.displayName,
    staff.id,
    promotions,
    activeStoreId,
    cart,
  ])

  const processScannedBarcode = useCallback(
    (raw: string) => {
      const code = raw.trim()
      if (!code) return
      const p = displayProducts.find((x) => x.barcode === code)
      if (p) {
        handleAdd(p)
      } else {
        setSearch(code)
      }
      setBarcodeInput('')
      refocusBarcodeField()
    },
    [displayProducts, handleAdd, refocusBarcodeField],
  )

  const handleBarcodeSubmit = useCallback(() => {
    processScannedBarcode(barcodeInput)
  }, [barcodeInput, processScannedBarcode])

  const wedgeEnabled =
    activeView === 'caisse' && !receiptOpen && !addProductOpen

  useBarcodeScannerWedge(wedgeEnabled, processScannedBarcode)

  useEffect(() => {
    if (!wedgeEnabled) return
    const id = requestAnimationFrame(() => barcodeFieldRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [wedgeEnabled])

  const handleSaveNewProduct = useCallback(
    async (product: Product, initialStock: number) => {
      const dup = await db.products
        .where('barcode')
        .equals(product.barcode)
        .first()
      if (dup) {
        throw new Error('Ce code-barres existe déjà.')
      }
      await db.products.add(product)
      await ensureAllStoreStockRows()
      await db.storeStocks.put({
        id: storeStockRowId(activeStoreId, product.id),
        storeId: activeStoreId,
        productId: product.id,
        stock: initialStock,
      })
      await syncProductCategoriesFromProducts()
    },
    [activeStoreId],
  )

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return
    const now = new Date()
    const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const dayClosure = await db.dayClosures.get(todayYmd)
    debugLog(
      'src/Shell.tsx:handleCheckout:entry',
      'Checkout attempt while day closure state is evaluated',
      'H3',
      {
        todayYmd,
        hasDayClosureRow: !!dayClosure,
        isClosed: !!dayClosure?.closedAt,
        activeStoreId,
        staffRole: staff.role,
        cartLines: cart.length,
        payableTotalTTC,
      },
    )
    if (dayClosure?.closedAt) {
      toast.error(
        'Journée clôturée',
        'Réouvrez la journée dans le journal de caisse pour encaisser à nouveau.',
      )
      return
    }
    if (discountPct > perms.maxDiscountPct) {
      toast.error(
        'Remise non autorisée',
        `Plafond de ${perms.maxDiscountPct} % pour ce profil.`,
      )
      return
    }

    const totals = totalsFromLinesTTC(cart, discountPct)
    const totalR = payableTotalTTC
    const canPayElectronicNow = online && deviceConnectivity.paymentTerminals
    const payCheck = validateCheckoutPayment(
      checkoutPayment,
      totalR,
      canPayElectronicNow,
    )
    if (!payCheck.ok) {
      toast.error('Paiement incomplet', payCheck.message)
      return
    }
    if (payCheck.split.cash > 0 && !deviceConnectivity.cashDrawer) {
      toast.warning(
        'Tiroir-caisse désactivé',
        'Encaissement poursuivi en un clic.',
      )
    }
    toast.info(
      'Encaissement en cours',
      confirmCheckoutSummary(checkoutPayment, payCheck, totalR),
    )
    if (checkoutBusy) {
      return
    }

    const saleId = crypto.randomUUID()
    const createdAt = Date.now()
    const storeName = activeStore?.name
    const selectedTable = selectedTableId
      ? diningTables.find((t) => t.id === selectedTableId)
      : null
    const kitchenEnabled = isKitchenModuleDemoOn()

    setCheckoutBusy(true)
    try {
      const saleRecord: Sale = {
        id: saleId,
        createdAt,
        lines: cart.map((l) => ({
          productId: l.productId,
          name: l.name,
          unitPriceTTC: l.unitPriceTTC,
          qty: l.qty,
          vatRatePct: l.vatRatePct,
        })),
        subtotalHT: totals.subtotalHT,
        tva: totals.tva,
        totalTTC: totals.totalTTC,
        discountPct,
        paymentMethod: checkoutPayment.mixed ? 'mixed' : checkoutPayment.method,
        paymentSplit: payCheck.split,
        cashReceived: payCheck.cashReceived,
        changeDue: payCheck.changeDue,
        cardTpeReference: payCheck.cardTpeReference,
        mobileMoneyReference: payCheck.mobileMoneyReference,
        synced: false,
        storeId: activeStoreId,
        storeName,
        tableId: selectedTable?.id,
        tableName: selectedTable?.name,
        cashierProfileId: staff.id,
        cashierDisplayName: staff.displayName,
        promoCode:
          appliedPromotionId != null
            ? promotions.find((p) => p.id === appliedPromotionId)?.code
            : undefined,
        loyaltyCustomerId: activeLoyaltyCustomer?.id,
        loyaltyCustomerPhone: activeLoyaltyCustomer?.phone,
        loyaltyPointsEarned: Math.floor(totalR / 100),
        loyaltyPointsRedeemed: loyaltyRedeemPoints,
        loyaltyDiscountTTC: loyaltyRedeemAmountTTC,
      }

      await db.transaction(
        'rw',
        [
          db.products,
          db.sales,
          db.syncQueue,
          db.storeStocks,
          db.promotions,
          db.diningTables,
          db.onlineOrders,
          db.kitchenIngredients,
          db.kitchenIngredientStocks,
          db.productRecipeIngredients,
          db.loyaltyCustomers,
          db.loyaltyTransactions,
        ],
        async () => {
          for (const line of cart) {
            const p = await db.products.get(line.productId)
            if (!p || p.archived) {
              throw new Error(
                `Article « ${line.name} » indisponible (archivé ou supprimé).`,
              )
            }
            const rid = storeStockRowId(activeStoreId, line.productId)
            const row = await db.storeStocks.get(rid)
            const cur = row?.stock ?? 0
            if (cur < line.qty) {
              throw new Error(
                `Stock insuffisant pour « ${line.name} » (disponible : ${cur}).`,
              )
            }
            await db.storeStocks.put({
              id: rid,
              storeId: activeStoreId,
              productId: line.productId,
              stock: cur - line.qty,
            })
          }

          // Déduction stock ingrédients cuisine (recettes par produit).
          const recipeRows = await db.productRecipeIngredients.toArray()
          const ingredientUsage = new Map<string, number>()
          for (const line of cart) {
            const rows = recipeRows.filter((r) => r.productId === line.productId)
            for (const row of rows) {
              const used = row.qtyPerUnit * line.qty
              ingredientUsage.set(
                row.ingredientId,
                (ingredientUsage.get(row.ingredientId) ?? 0) + used,
              )
            }
          }
          for (const [ingredientId, usedQty] of ingredientUsage.entries()) {
            const ingredient = await db.kitchenIngredients.get(ingredientId)
            if (!ingredient || ingredient.archived) continue
            const stockId = `${activeStoreId}:${ingredientId}`
            const stockRow = await db.kitchenIngredientStocks.get(stockId)
            const currentStock = stockRow?.stock ?? 0
            if (currentStock < usedQty) {
              throw new Error(
                `Stock cuisine insuffisant pour « ${ingredient.name} » (disponible: ${currentStock}${ingredient.unit}).`,
              )
            }
          }
          for (const [ingredientId, usedQty] of ingredientUsage.entries()) {
            const ingredient = await db.kitchenIngredients.get(ingredientId)
            if (!ingredient || ingredient.archived) continue
            const stockId = `${activeStoreId}:${ingredientId}`
            const stockRow = await db.kitchenIngredientStocks.get(stockId)
            const currentStock = stockRow?.stock ?? 0
            await db.kitchenIngredientStocks.put({
              id: stockId,
              storeId: activeStoreId,
              ingredientId,
              stock: currentStock - usedQty,
            })
          }

          await db.sales.add(saleRecord)

          if (kitchenEnabled) {
            const table = selectedTableId
              ? await db.diningTables.get(selectedTableId)
              : null
            const tableLabel = table?.name
              ? `Table ${table.name}`
              : 'Vente caisse'
            const kitchenOrderId = crypto.randomUUID()
            await db.onlineOrders.put({
              id: kitchenOrderId,
              createdAt,
              storeId: activeStoreId,
              storeName,
              customerName: tableLabel,
              customerNote: `Commande sur place · Encaissement ${saleId.slice(0, 8).toUpperCase()}`,
              paymentMethod: saleRecord.paymentMethod,
              lines: saleRecord.lines,
              subtotalHT: saleRecord.subtotalHT,
              tva: saleRecord.tva,
              totalTTC: saleRecord.totalTTC,
              discountPct: saleRecord.discountPct || undefined,
              promoCode: saleRecord.promoCode,
              fulfillmentMode: 'pickup',
              status: 'approved',
              sourcePlatform: 'native',
              externalOrderRef: `onsite-${saleId.slice(0, 8).toUpperCase()}`,
              reviewedAt: createdAt,
              reviewedByProfileId: staff.id,
              reviewedByDisplayName: staff.displayName,
              kitchenStatus: 'queued',
              kitchenPriority: 'normal',
              kitchenStation: getKitchenStationDemo(),
              kitchenTicketCode: `K-${kitchenOrderId.slice(0, 6).toUpperCase()}`,
              kitchenUpdatedAt: createdAt,
              stockDeductedAt: createdAt,
            })
          }

          if (appliedPromotionId) {
            const promo = await db.promotions.get(appliedPromotionId)
            if (promo) {
              await db.promotions.update(appliedPromotionId, {
                usageCount: (promo.usageCount ?? 0) + 1,
                updatedAt: Date.now(),
              })
            }
          }

          if (selectedTableId) {
            const table = await db.diningTables.get(selectedTableId)
            if (table) {
              await db.diningTables.update(selectedTableId, {
                status: 'occupied',
                occupiedSince: table.occupiedSince ?? Date.now(),
              })
            }
          }

          const cleanPhone = normalizePhone(loyaltyPhoneInput)
          if (cleanPhone) {
            const earnPts = Math.floor(totalR / 100)
            const existing =
              activeLoyaltyCustomer ??
              (await db.loyaltyCustomers.where('phone').equals(cleanPhone).first())
            const customerId = existing?.id ?? crypto.randomUUID()
            const nextPoints =
              (existing?.points ?? 0) + earnPts - loyaltyRedeemPoints
            await db.loyaltyCustomers.put({
              id: customerId,
              phone: cleanPhone,
              displayName: existing?.displayName,
              points: Math.max(0, nextPoints),
              totalSpentTTC: (existing?.totalSpentTTC ?? 0) + totalR,
              visitCount: (existing?.visitCount ?? 0) + 1,
              createdAt: existing?.createdAt ?? Date.now(),
              updatedAt: Date.now(),
            })
            if (earnPts > 0) {
              await db.loyaltyTransactions.add({
                id: crypto.randomUUID(),
                customerId,
                saleId,
                createdAt: Date.now(),
                type: 'earn',
                points: earnPts,
                amountTTC: totalR,
                actorProfileId: staff.id,
              })
            }
            if (loyaltyRedeemPoints > 0) {
              await db.loyaltyTransactions.add({
                id: crypto.randomUUID(),
                customerId,
                saleId,
                createdAt: Date.now(),
                type: 'redeem',
                points: -loyaltyRedeemPoints,
                amountTTC: loyaltyRedeemAmountTTC,
                actorProfileId: staff.id,
              })
            }
          }

          await db.syncQueue.add({
            kind: 'sale',
            payload: JSON.stringify({ saleId }),
            createdAt: Date.now(),
          })
        },
      )

      setReceiptOpen({
        type: 'sale',
        sale: saleRecord,
        autoPrint: deviceConnectivity.receiptPrinters,
      })
      if (!deviceConnectivity.receiptPrinters) {
        toast.info(
          'Imprimante ticket désactivée',
          'Le reçu reste consultable à l’écran.',
        )
      }
      setCart([])
      setDiscountPct(0)
      setPromoInput('')
      setPromoFeedback(null)
      setAppliedPromotionId(null)
      setLoyaltyRedeemInput('')
      setLoyaltyPhoneInput('')
      setBarcodeInput('')
      setCheckoutPayment(defaultCheckoutPayment())
      toast.success(
        'Vente enregistrée',
        `${formatFCFA(totals.totalTTC)} encaissés`,
      )
      setPendingCashDrawerBypassUntil(0)
      setPendingCheckoutUntil(0)

      if (online) {
        const r = await flushSyncQueue()
        if (r.mode === 'cloud' || r.mode === 'local') {
          refreshSyncMeta()
          await touchTerminalSyncTimestamp()
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Encaissement impossible', msg)
    } finally {
      setCheckoutBusy(false)
    }
  }, [
    cart,
    discountPct,
    perms.maxDiscountPct,
    checkoutPayment,
    checkoutBusy,
    online,
    staff,
    refreshSyncMeta,
    activeStoreId,
    activeStore?.name,
    deviceConnectivity.cashDrawer,
    deviceConnectivity.receiptPrinters,
    deviceConnectivity.paymentTerminals,
    pendingCashDrawerBypassUntil,
    pendingCheckoutUntil,
    toast,
    appliedPromotionId,
    selectedTableId,
    diningTables,
    payableTotalTTC,
    promotions,
    activeLoyaltyCustomer,
    loyaltyPhoneInput,
    loyaltyRedeemAmountTTC,
    loyaltyRedeemPoints,
  ])

  const handleLogoutClick = useCallback(() => {
    clearStaffSession()
    onLogout()
  }, [onLogout])

  const isCaisse = activeView === 'caisse'
  const canAddProductFromCaisse =
    staff.role !== 'caissier' && perms.canManageCatalogFull
  const cartHideClass = 'lg:hidden'
  const cartDesktopClass = 'hidden lg:flex'
  const densityTabs = useMemo(
    () => [
      { id: 'compact' as const, label: 'Compact' },
      { id: 'confort' as const, label: 'Confort' },
    ],
    [],
  )

  return (
    <div className="flex min-h-svh w-full max-w-full flex-col overflow-x-clip bg-zinc-50">
      <SubscriptionBanner onOpenSubscription={() => setActiveView('subscription')} />
      <div className="flex min-h-0 flex-1">
      {receiptOpen ? (
        <ReceiptModal
          source={
            receiptOpen.type === 'sale'
              ? { kind: 'sale', sale: receiptOpen.sale }
              : receiptOpen.type === 'onlineOrder'
                ? { kind: 'onlineOrder', order: receiptOpen.order }
                : { kind: 'ticketInvoice', ticketInvoice: receiptOpen.ticketInvoice }
          }
          autoPrint={receiptOpen.autoPrint}
          onClose={() => setReceiptOpen(null)}
        />
      ) : null}
      {addProductOpen ? (
        <AddProductModal
          activeStoreLabel={activeStore?.name ?? 'Magasin'}
          onClose={() => setAddProductOpen(false)}
          onSave={handleSaveNewProduct}
        />
      ) : null}

      <Sidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        navSections={navSections}
        ruptureCount={ruptureCount}
        lowStockCount={lowStockCount}
        onlineOrdersPending={onlineOrdersPending}
        stores={stores}
        activeStoreId={activeStoreId}
        onActiveStoreChange={setActiveStoreId}
        canSwitchStore={canSwitchStore}
        user={{
          displayName: staff.displayName,
          initials: staff.initials,
          role: staff.role,
        }}
        onLogout={handleLogoutClick}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
      />

      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        activeView={activeView}
        onSelectView={handleSelectView}
        navSections={navSections}
        ruptureCount={ruptureCount}
        lowStockCount={lowStockCount}
        onlineOrdersPending={onlineOrdersPending}
        stores={stores}
        activeStoreId={activeStoreId}
        onActiveStoreChange={setActiveStoreId}
        canSwitchStore={canSwitchStore}
        user={{
          displayName: staff.displayName,
          initials: staff.initials,
          role: staff.role,
        }}
        onLogout={handleLogoutClick}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          view={activeView}
          online={online}
          syncLabel={syncLabel}
          syncBusy={syncBusy}
          onSyncNow={handleSyncNow}
          onOpenMobileMenu={() => setMobileNavOpen(true)}
          rightSlot={
            isCaisse ? (
              <Tabs
                variant="segmented"
                items={densityTabs}
                active={productGridDensity}
                onChange={setProductGridDensity}
                className="hidden sm:inline-flex"
              />
            ) : null
          }
        />
        {!online ? <OfflineBanner /> : null}

        {isCaisse ? (
          <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
            <main className="ui-scroll min-w-0 flex-1 overflow-y-auto px-1 pb-24 pt-3 sm:px-3 sm:pt-4 xl:px-5 xl:pt-6 xl:pb-6">
              <CaisseHeader
                ref={barcodeFieldRef}
                sessionId={SESSION_ID}
                barcode={barcodeInput}
                onBarcodeChange={setBarcodeInput}
                onBarcodeSubmit={handleBarcodeSubmit}
                search={search}
                onSearchChange={setSearch}
                onAddProduct={
                  canAddProductFromCaisse
                    ? () => setAddProductOpen(true)
                    : undefined
                }
              />
              {ruptureCount > 0 ? (
                <div
                  className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                    perms.canManageStocks
                      ? 'border-rose-200 bg-rose-50 text-rose-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                  }`}
                  role="alert"
                >
                  <span className="inline-flex items-center gap-2">
                    <IconShield className="h-4 w-4" />
                    <span>
                      <strong>{ruptureCount}</strong> article
                      {ruptureCount > 1 ? 's' : ''} en{' '}
                      <strong>rupture de stock</strong>
                      {!perms.canManageStocks
                        ? ' — prévenir un responsable.'
                        : ''}
                    </span>
                  </span>
                  {perms.canManageStocks ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleSelectView('stocks')}
                    >
                      Gérer les stocks
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <ProductGrid
                products={displayProducts}
                categoryTabs={categoryTabs}
                category={category}
                onCategoryChange={setCategory}
                search={search}
                onAdd={handleAddFromGrid}
                density={productGridDensity}
              />
            </main>
            <div className={cartDesktopClass}>
              <CartPanel
                lines={cart}
                products={displayProducts}
                discountPct={discountPct}
                maxDiscountPct={perms.maxDiscountPct}
                promoInput={promoInput}
                onPromoInputChange={setPromoInput}
                onApplyPromo={handleApplyPromo}
                promoFeedback={promoFeedback}
                tableOptions={diningTables.map((t) => ({
                  id: t.id,
                  name: t.name,
                  status: tableStatusLabel(t.status),
                  statusCode: t.status,
                }))}
                selectedTableId={selectedTableId}
                onSelectedTableIdChange={setSelectedTableId}
                loyaltyPhone={loyaltyPhoneInput}
                onLoyaltyPhoneChange={setLoyaltyPhoneInput}
                loyaltyPointsAvailable={activeLoyaltyCustomer?.points ?? 0}
                loyaltyRedeemPoints={loyaltyRedeemInput}
                onLoyaltyRedeemPointsChange={setLoyaltyRedeemInput}
                loyaltyRedeemAmountTTC={loyaltyRedeemAmountTTC}
                payableTotalTTC={payableTotalTTC}
                payment={checkoutPayment}
                onPaymentPatch={patchCheckoutPayment}
                online={online}
                canPayElectronic={online && deviceConnectivity.paymentTerminals}
                receiptPrinterEnabled={deviceConnectivity.receiptPrinters}
                onInc={handleInc}
                onDec={handleDec}
                onRemove={handleRemove}
                onClear={handleClear}
                onCancelTransaction={handleCancelCartTransaction}
                onCheckout={handleCheckout}
                checkoutBusy={checkoutBusy}
                dayClosed={!!dayClosureToday?.closedAt}
              />
            </div>
          </div>
        ) : (
          <div className="ui-scroll flex-1 overflow-y-auto px-3 pb-10 pt-3 sm:px-4 sm:pt-4 lg:px-8">
            <Suspense
              fallback={
                <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
                  Chargement du module...
                </div>
              }
            >
              {activeView === 'dash' ? (
                <DashboardView
                  onOpenOnlineOrders={() => handleSelectView('onlineOrders')}
                  onOpenTicketsFactures={
                    staff.role === 'admin'
                      ? () => handleSelectView('ticketsFactures')
                      : undefined
                  }
                />
              ) : null}
              {activeView === 'catalogue' ? (
                <CatalogueView
                  canManageCatalog={perms.canManageCatalogFull}
                  canEditPrices={perms.canEditPrices}
                  density={productGridDensity}
                  auditActor={{
                    profileId: staff.id,
                    displayName: staff.displayName,
                  }}
                  onAddClick={() => setAddProductOpen(true)}
                />
              ) : null}
              {activeView === 'stocks' ? (
                <StocksView
                  isAdmin={perms.canManageStocks}
                  auditActor={{
                    profileId: staff.id,
                    displayName: staff.displayName,
                  }}
                />
              ) : null}
              {activeView === 'comptabilite' ? (
                <ComptabiliteView canManageCompta={perms.canDailyClosure} />
              ) : null}
              {activeView === 'rh' ? (
                <RhManagementView
                  actor={{ id: staff.id, displayName: staff.displayName }}
                  canReview={staff.role === 'admin' || staff.role === 'gerant'}
                />
              ) : null}
              {activeView === 'crm' ? (
                <CrmView actor={{ id: staff.id, displayName: staff.displayName }} />
              ) : null}
              {activeView === 'tables' ? (
                <TablesManagementView
                  activeStoreId={activeStoreId}
                  activeStoreLabel={activeStore?.name ?? 'Magasin'}
                  canManageTables={perms.canManageStocks || staff.role === 'caissier'}
                />
              ) : null}
              {activeView === 'promotions' ? (
                <PromotionsView
                  activeStoreId={activeStoreId}
                  canManagePromotions={perms.canEditPrices}
                />
              ) : null}
              {activeView === 'loyalty' ? (
                <LoyaltyProgramView canManageLoyalty={perms.canEditPrices} />
              ) : null}
              {activeView === 'kitchen' ? (
                <KitchenView
                  activeStoreId={activeStoreId}
                  canManageKitchenActions={staff.role !== 'caissier'}
                />
              ) : null}
              {activeView === 'ticketsFactures' ? (
                <TicketsFacturesView
                  activeStoreId={activeStoreId}
                  activeStoreLabel={activeStore?.name ?? 'Magasin'}
                  actor={{ id: staff.id, displayName: staff.displayName }}
                  canViewAllDocuments={staff.role === 'admin' || staff.role === 'gerant'}
                  onViewReceipt={(ticketInvoice) =>
                    setReceiptOpen({
                      type: 'ticketInvoice',
                      ticketInvoice,
                      autoPrint: false,
                    })
                  }
                  onPrintReceipt={(ticketInvoice) =>
                    {
                      setReceiptOpen({
                        type: 'ticketInvoice',
                        ticketInvoice,
                        autoPrint: true,
                      })
                    }
                  }
                />
              ) : null}
              {activeView === 'onlineOrders' ? (
                <OnlineOrdersValidationView
                  online={online}
                  activeStoreId={activeStoreId}
                  activeStoreLabel={activeStore?.name ?? 'Magasin'}
                  canSwitchStore={canSwitchStore}
                  canValidateOnlineOrders={
                    staff.role === 'gerant' ||
                    staff.role === 'admin' ||
                    staff.role === 'caissier'
                  }
                  reviewer={{
                    id: staff.id,
                    displayName: staff.displayName,
                  }}
                  onPrintOrder={(order, autoPrint = false) =>
                    setReceiptOpen({ type: 'onlineOrder', order, autoPrint })
                  }
                />
              ) : null}
              {activeView === 'journal' ? (
                <JournalReportView
                  canDailyClosure={perms.canDailyClosure}
                  canReopenDay={staff.role === 'admin'}
                  canProcessRefunds={perms.canProcessRefunds}
                  currentProfile={{
                    id: staff.id,
                    displayName: staff.displayName,
                  }}
                  currentRole={staff.role}
                  onViewReceipt={(sale) =>
                    setReceiptOpen({ type: 'sale', sale, autoPrint: false })
                  }
                />
              ) : null}
              {activeView === 'personnel' ? (
                <PersonnelView currentProfileId={staff.id} />
              ) : null}
              {activeView === 'pointage' ? (
                <PointageView
                  staff={staff}
                  activeStoreId={activeStoreId}
                  activeStoreLabel={activeStore?.name ?? 'Magasin'}
                  canViewTeamPointage={perms.canViewTeamPointage}
                />
              ) : null}
              {activeView === 'analytique' ? <AnalytiqueView /> : null}
              {activeView === 'integrations' ? <IntegrationsView /> : null}
              {activeView === 'subscription' ? <SubscriptionView /> : null}
              {activeView === 'network' ? (
                <MultiStoreView
                  canConfigureStores={perms.canConfigureStoresAdmin}
                  canCreateTransfers={perms.canManageStocks}
                  profileId={staff.id}
                  auditActor={{
                    profileId: staff.id,
                    displayName: staff.displayName,
                  }}
                />
              ) : null}
            </Suspense>
          </div>
        )}

        {isCaisse ? (
          <>
            {/* Barre flottante panier (mobile / tablette) */}
            {!isFloatingCartOpen && cartItemCount > 0 ? (
              <button
                type="button"
                onClick={() => setIsFloatingCartOpen(true)}
                className={`fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-3 rounded-2xl border border-border bg-white/95 px-4 py-3 text-left text-ink shadow-(--shadow-pop) backdrop-blur-sm transition hover:bg-white ${cartHideClass}`}
              >
                <span className="flex items-center gap-3">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <IconReceipt className="h-4 w-4" />
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-accent px-1 text-[10px] font-bold text-white">
                      {cartItemCount}
                    </span>
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wider text-ink-subtle">
                      Panier
                    </span>
                    <span className="font-mono-nums text-[15px] font-bold">
                      {formatFCFA(cartTotalTTC)}
                    </span>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-white">
                  Encaisser
                  <IconArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            ) : null}

            {/* FAB minimal quand panier vide */}
            {!isFloatingCartOpen && cartItemCount === 0 ? (
              <button
                type="button"
                onClick={() => setIsFloatingCartOpen(true)}
                className={`fixed bottom-3 right-3 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-white text-accent shadow-(--shadow-pop) transition hover:bg-surface-sunken ${cartHideClass}`}
                aria-label="Ouvrir le panier"
              >
                <IconReceipt className="h-5 w-5" />
              </button>
            ) : null}

            {/* Drawer panier (mobile = full-width, tablette = max-w-md) */}
            {isFloatingCartOpen ? (
              <div
                className={`fixed inset-0 z-40 ${cartHideClass}`}
                role="dialog"
                aria-modal="true"
                aria-label="Panier"
              >
                <button
                  type="button"
                  aria-label="Fermer le panier"
                  className="absolute inset-0 animate-ui-fade-in bg-zinc-950/50 backdrop-blur-[2px]"
                  onClick={() => setIsFloatingCartOpen(false)}
                />
                <div className="absolute inset-y-0 right-0 w-full animate-ui-slide-up sm:w-[min(420px,92vw)]">
                  <div className="flex h-full flex-col border-l border-zinc-200 bg-white shadow-(--shadow-overlay)">
                    <CartPanel
                      lines={cart}
                      products={displayProducts}
                      discountPct={discountPct}
                      maxDiscountPct={perms.maxDiscountPct}
                      promoInput={promoInput}
                      onPromoInputChange={setPromoInput}
                      onApplyPromo={handleApplyPromo}
                      promoFeedback={promoFeedback}
                      tableOptions={diningTables.map((t) => ({
                        id: t.id,
                        name: t.name,
                        status: tableStatusLabel(t.status),
                        statusCode: t.status,
                      }))}
                      selectedTableId={selectedTableId}
                      onSelectedTableIdChange={setSelectedTableId}
                      loyaltyPhone={loyaltyPhoneInput}
                      onLoyaltyPhoneChange={setLoyaltyPhoneInput}
                      loyaltyPointsAvailable={activeLoyaltyCustomer?.points ?? 0}
                      loyaltyRedeemPoints={loyaltyRedeemInput}
                      onLoyaltyRedeemPointsChange={setLoyaltyRedeemInput}
                      loyaltyRedeemAmountTTC={loyaltyRedeemAmountTTC}
                      payableTotalTTC={payableTotalTTC}
                      payment={checkoutPayment}
                      onPaymentPatch={patchCheckoutPayment}
                      online={online}
                      canPayElectronic={online && deviceConnectivity.paymentTerminals}
                      receiptPrinterEnabled={deviceConnectivity.receiptPrinters}
                      onInc={handleInc}
                      onDec={handleDec}
                      onRemove={handleRemove}
                      onClear={handleClear}
                      onCancelTransaction={handleCancelCartTransaction}
                      onCheckout={handleCheckout}
                      checkoutBusy={checkoutBusy}
                      onClose={() => setIsFloatingCartOpen(false)}
                      dayClosed={!!dayClosureToday?.closedAt}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      </div>
    </div>
  )
}
