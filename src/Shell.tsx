import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  flattenedNavViewIds,
  navSectionsForRole,
  type NavViewId,
} from './navigation'
import { AnalytiqueView } from './views/AnalytiqueView'
import { IntegrationsView } from './views/IntegrationsView'
import { CatalogueView } from './views/CatalogueView'
import { JournalReportView } from './views/JournalReportView'
import { DashboardView } from './views/DashboardView'
import { MultiStoreView } from './views/MultiStoreView'
import { OnlineOrdersValidationView } from './views/OnlineOrdersValidationView'
import { PersonnelView } from './views/PersonnelView'
import { StocksView } from './views/StocksView'
import {
  db,
  ensureAllStoreStockRows,
  syncProductCategoriesFromProducts,
} from './db/db'
import type { CartLine, Product, ProductWithStock, Sale } from './db/types'
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
import { useBarcodeScannerWedge } from './hooks/useBarcodeScannerWedge'
import { storeStockRowId } from './lib/storeStockId'
import {
  formatLastSyncRelative,
  getLastSyncTimestamp,
} from './lib/syncMeta'
import { flushSyncQueue } from './lib/sync'
import { Tabs } from './ui/Tabs'
import { Button } from './ui/Button'
import { useToast } from './ui/Toast'
import { IconArrowRight, IconReceipt, IconShield } from './ui/icons'

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

const SIDEBAR_KEY = 'caisseci-sidebar-collapsed'

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

  const perms = useMemo(() => effectivePermissions(staff), [staff])
  const navSections = useMemo(() => navSectionsForRole(staff.role), [staff.role])
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
  const [checkoutPayment, setCheckoutPayment] = useState<CheckoutPaymentState>(
    () => defaultCheckoutPayment(),
  )
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [activeView, setActiveView] = useState<NavViewId>('caisse')
  const [isFloatingCartOpen, setIsFloatingCartOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState<{
    sale: Sale
    autoPrint: boolean
  } | null>(null)
  const [syncMetaTick, setSyncMetaTick] = useState(0)
  const [syncBusy, setSyncBusy] = useState(false)

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
    setCheckoutPayment(defaultCheckoutPayment())
  }, [])

  const handleCancelCartTransaction = useCallback(async () => {
    if (cart.length === 0) return
    if (
      !window.confirm(
        'Annuler la transaction en cours ? Le panier sera vidé et l’opération sera consignée dans le journal d’audit.',
      )
    ) {
      return
    }
    const reason =
      window.prompt(
        'Motif (recommandé pour l’audit) — Entrée pour valider, Annuler pour laisser vide :',
      ) ?? ''
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
    } catch (e) {
      toast.error(
        'Échec de l’annulation',
        e instanceof Error ? e.message : String(e),
      )
      return
    }
    handleClear()
  }, [cart, discountPct, staff.displayName, staff.id, handleClear, toast])

  const handleApplyPromo = useCallback(() => {
    const c = promoInput.trim().toUpperCase()
    const max = perms.maxDiscountPct
    const prevPct = discountPct
    const apply = (requestedPct: number) => {
      if (max <= 0) {
        setDiscountPct(0)
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
    setPromoFeedback('Code promo non reconnu')
  }, [promoInput, perms.maxDiscountPct, discountPct, staff.displayName, staff.id])

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
    if (discountPct > perms.maxDiscountPct) {
      toast.error(
        'Remise non autorisée',
        `Plafond de ${perms.maxDiscountPct} % pour ce profil.`,
      )
      return
    }

    const totals = totalsFromLinesTTC(cart, discountPct)
    const totalR = Math.round(totals.totalTTC)
    const payCheck = validateCheckoutPayment(checkoutPayment, totalR, online)
    if (!payCheck.ok) {
      toast.error('Paiement incomplet', payCheck.message)
      return
    }
    if (
      !window.confirm(
        confirmCheckoutSummary(checkoutPayment, payCheck, totalR),
      )
    ) {
      return
    }

    const saleId = crypto.randomUUID()
    const createdAt = Date.now()
    const storeName = activeStore?.name

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
        cashierProfileId: staff.id,
        cashierDisplayName: staff.displayName,
      }

      await db.transaction(
        'rw',
        db.products,
        db.sales,
        db.syncQueue,
        db.storeStocks,
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

          await db.sales.add(saleRecord)

          await db.syncQueue.add({
            kind: 'sale',
            payload: JSON.stringify({ saleId }),
            createdAt: Date.now(),
          })
        },
      )

      setReceiptOpen({ sale: saleRecord, autoPrint: true })
      setCart([])
      setDiscountPct(0)
      setPromoInput('')
      setPromoFeedback(null)
      setBarcodeInput('')
      setCheckoutPayment(defaultCheckoutPayment())
      toast.success(
        'Vente enregistrée',
        `${formatFCFA(totals.totalTTC)} encaissés`,
      )

      if (online) {
        const r = await flushSyncQueue()
        if (r.mode === 'cloud' || r.mode === 'local') {
          refreshSyncMeta()
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
    online,
    staff,
    refreshSyncMeta,
    activeStoreId,
    activeStore?.name,
    toast,
  ])

  const handleLogoutClick = useCallback(() => {
    clearStaffSession()
    onLogout()
  }, [onLogout])

  const isCaisse = activeView === 'caisse'
  const densityTabs = useMemo(
    () => [
      { id: 'compact' as const, label: 'Compact' },
      { id: 'confort' as const, label: 'Confort' },
    ],
    [],
  )

  return (
    <div className="flex min-h-svh w-full max-w-full overflow-x-clip bg-zinc-50">
      {receiptOpen ? (
        <ReceiptModal
          sale={receiptOpen.sale}
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
        onSelectView={setActiveView}
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
        onSelectView={setActiveView}
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
          <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
            <main className="ui-scroll min-w-0 flex-1 overflow-y-auto p-3 pb-24 sm:p-4 xl:p-6 xl:pb-6">
              <CaisseHeader
                ref={barcodeFieldRef}
                sessionId={SESSION_ID}
                barcode={barcodeInput}
                onBarcodeChange={setBarcodeInput}
                onBarcodeSubmit={handleBarcodeSubmit}
                search={search}
                onSearchChange={setSearch}
                onAddProduct={
                  perms.canManageCatalogFull
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
                      onClick={() => setActiveView('stocks')}
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
            <div className="hidden xl:flex">
              <CartPanel
                lines={cart}
                products={displayProducts}
                discountPct={discountPct}
                maxDiscountPct={perms.maxDiscountPct}
                promoInput={promoInput}
                onPromoInputChange={setPromoInput}
                onApplyPromo={handleApplyPromo}
                promoFeedback={promoFeedback}
                payment={checkoutPayment}
                onPaymentPatch={patchCheckoutPayment}
                online={online}
                onInc={handleInc}
                onDec={handleDec}
                onRemove={handleRemove}
                onClear={handleClear}
                onCancelTransaction={handleCancelCartTransaction}
                onCheckout={handleCheckout}
                checkoutBusy={checkoutBusy}
              />
            </div>
          </div>
        ) : (
          <div className="ui-scroll flex-1 overflow-y-auto px-3 pb-10 pt-3 sm:px-4 sm:pt-4 lg:px-8">
            {activeView === 'dash' ? <DashboardView /> : null}
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
            {activeView === 'onlineOrders' ? (
              <OnlineOrdersValidationView
                online={online}
                reviewer={{
                  id: staff.id,
                  displayName: staff.displayName,
                }}
              />
            ) : null}
            {activeView === 'journal' ? (
              <JournalReportView
                canDailyClosure={perms.canDailyClosure}
                canProcessRefunds={perms.canProcessRefunds}
                currentProfile={{
                  id: staff.id,
                  displayName: staff.displayName,
                }}
                onViewReceipt={(sale) =>
                  setReceiptOpen({ sale, autoPrint: false })
                }
              />
            ) : null}
            {activeView === 'personnel' ? (
              <PersonnelView currentProfileId={staff.id} />
            ) : null}
            {activeView === 'analytique' ? <AnalytiqueView /> : null}
            {activeView === 'integrations' ? <IntegrationsView /> : null}
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
          </div>
        )}

        {isCaisse ? (
          <>
            {/* Barre flottante panier (mobile / tablette) */}
            {!isFloatingCartOpen && cartItemCount > 0 ? (
              <button
                type="button"
                onClick={() => setIsFloatingCartOpen(true)}
                className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-left text-white shadow-[0_12px_32px_-8px_rgba(9,9,11,0.45)] transition hover:bg-zinc-800 xl:hidden"
              >
                <span className="flex items-center gap-3">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <IconReceipt className="h-4 w-4" />
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-zinc-900 bg-emerald-500 px-1 text-[10px] font-bold text-white">
                      {cartItemCount}
                    </span>
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wider text-white/60">
                      Panier
                    </span>
                    <span className="font-mono-nums text-[15px] font-bold">
                      {formatFCFA(cartTotalTTC)}
                    </span>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white">
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
                className="fixed bottom-3 right-3 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white shadow-[0_12px_32px_-8px_rgba(9,9,11,0.45)] transition hover:bg-zinc-800 xl:hidden"
                aria-label="Ouvrir le panier"
              >
                <IconReceipt className="h-5 w-5" />
              </button>
            ) : null}

            {/* Drawer panier (mobile = full-width, tablette = max-w-md) */}
            {isFloatingCartOpen ? (
              <div
                className="fixed inset-0 z-40 xl:hidden"
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
                  <div className="flex h-full flex-col border-l border-zinc-200 bg-white shadow-[var(--shadow-overlay)]">
                    <CartPanel
                      lines={cart}
                      products={displayProducts}
                      discountPct={discountPct}
                      maxDiscountPct={perms.maxDiscountPct}
                      promoInput={promoInput}
                      onPromoInputChange={setPromoInput}
                      onApplyPromo={handleApplyPromo}
                      promoFeedback={promoFeedback}
                      payment={checkoutPayment}
                      onPaymentPatch={patchCheckoutPayment}
                      online={online}
                      onInc={handleInc}
                      onDec={handleDec}
                      onRemove={handleRemove}
                      onClear={handleClear}
                      onCancelTransaction={handleCancelCartTransaction}
                      onCheckout={handleCheckout}
                      checkoutBusy={checkoutBusy}
                      onClose={() => setIsFloatingCartOpen(false)}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
