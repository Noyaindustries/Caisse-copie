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
import { type CategoryTab } from './components/Sidebar'
import { ViewHeader } from './components/ViewHeader'
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
import { db, ensureAllStoreStockRows } from './db/db'
import type { CartLine, Product, ProductWithStock, Sale } from './db/types'
import {
  confirmCheckoutSummary,
  defaultCheckoutPayment,
  validateCheckoutPayment,
  type CheckoutPaymentState,
} from './lib/checkoutPayment'
import { DEFAULT_VAT_RATE_PCT, formatFCFA, totalsFromLinesTTC } from './lib/money'
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

type Props = {
  staff: StaffProfile
  online: boolean
  onLogout: () => void
}

export function Shell({ staff, online, onLogout }: Props) {
  const {
    displayProducts,
    activeStoreId,
    activeStore,
    stores,
    setActiveStoreId,
    canSwitchStore,
  } = useActiveStore()

  const perms = useMemo(() => effectivePermissions(staff), [staff])
  const navSections = useMemo(() => navSectionsForRole(staff.role), [staff.role])
  const allowedViews = useMemo(() => {
    return flattenedNavViewIds(navSections)
  }, [navSections])

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

  const queueItems = useLiveQuery(() => db.syncQueue.toArray(), [], []) ?? []
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
    if (cart.length === 0 && isFloatingCartOpen) {
      setIsFloatingCartOpen(false)
    }
  }, [cart.length, isFloatingCartOpen])

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
      }
      if (r.mode === 'failed' && r.error) {
        window.alert(r.error)
      }
    } finally {
      setSyncBusy(false)
    }
  }, [online, refreshSyncMeta])

  const refocusBarcodeField = useCallback(() => {
    requestAnimationFrame(() => barcodeFieldRef.current?.focus())
  }, [])

  const handleAdd = useCallback((p: ProductWithStock) => {
    if (p.archived) return
    const vat = p.vatRatePct ?? DEFAULT_VAT_RATE_PCT
    setCart((prev) => {
      const line = prev.find((l) => l.productId === p.id)
      const currentQty = line?.qty ?? 0
      if (currentQty >= p.stock) return prev
      if (!line) {
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
  }, [])

  const handleAddFromGrid = useCallback(
    (p: ProductWithStock) => {
      handleAdd(p)
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
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
      return
    }
    handleClear()
  }, [cart, discountPct, staff.displayName, staff.id, handleClear])

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
    },
    [activeStoreId],
  )

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return
    if (discountPct > perms.maxDiscountPct) {
      window.alert(
        `Remise non autorisée (max. ${perms.maxDiscountPct} % pour ce profil).`,
      )
      return
    }

    const totals = totalsFromLinesTTC(cart, discountPct)
    const totalR = Math.round(totals.totalTTC)
    const payCheck = validateCheckoutPayment(checkoutPayment, totalR, online)
    if (!payCheck.ok) {
      window.alert(payCheck.message)
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

      if (online) {
        const r = await flushSyncQueue()
        if (r.mode === 'cloud' || r.mode === 'local') {
          refreshSyncMeta()
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      window.alert(msg)
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
  ])

  const handleLogoutClick = useCallback(() => {
    clearStaffSession()
    onLogout()
  }, [onLogout])

  return (
    <div className="flex min-h-svh min-w-0 flex-col">
      {!online ? <OfflineBanner /> : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
        <div className="premium-dark-card border-b border-white/10 px-4 py-3 text-slate-100 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-200">
                Espace interne
              </span>
              <span className="truncate text-sm font-medium text-slate-200">
                {staff.displayName} ({staff.role})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {stores.length > 0 ? (
                canSwitchStore && stores.length > 1 ? (
                  <select
                    value={activeStoreId}
                    onChange={(e) => setActiveStoreId(e.target.value)}
                    aria-label="Choisir le magasin"
                    className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-lg bg-white/6 px-2 py-1.5 text-xs text-slate-300">
                    {stores.find((s) => s.id === activeStoreId)?.name ?? '—'}
                  </span>
                )
              ) : null}
              <button
                type="button"
                disabled={!online || syncBusy}
                onClick={handleSyncNow}
                className="premium-btn-dark rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                title={syncLabel}
              >
                {syncBusy
                  ? 'Synchronisation…'
                  : online
                    ? 'Sync'
                    : 'Hors ligne'}
              </button>
              <button
                type="button"
                onClick={handleLogoutClick}
                className="premium-btn-dark rounded-lg px-3 py-1.5 text-xs font-semibold"
              >
                Changer de profil
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <nav className="premium-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
            {navSections.flatMap((section) => section.items).map((item) => {
              const isActive = activeView === item.id
              const badgeCount = item.badge === 'lowStock' ? lowStockCount : 0
              const showStockBadges = 'stockBadges' in item && item.stockBadges
              const showOnlineOrdersBadge =
                item.id === 'onlineOrders' && onlineOrdersPending > 0
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? 'border-emerald-300/40 bg-emerald-500/20 text-white'
                      : 'border-white/12 bg-white/5 text-slate-300 hover:border-emerald-300/30 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {showStockBadges ? (
                    <span className="flex shrink-0 gap-1">
                      {ruptureCount > 0 ? (
                        <span
                          className="rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                          title="Rupture"
                        >
                          {ruptureCount}
                        </span>
                      ) : null}
                      {lowStockCount > 0 ? (
                        <span
                          className="rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-950"
                          title="Sous le seuil"
                        >
                          {lowStockCount}
                        </span>
                      ) : null}
                    </span>
                  ) : showOnlineOrdersBadge ? (
                    <span className="shrink-0 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                      {onlineOrdersPending}
                    </span>
                  ) : badgeCount > 0 ? (
                    <span className="shrink-0 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                      {badgeCount}
                    </span>
                  ) : null}
                </button>
              )
            })}
            </nav>
            <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-white/12 bg-white/6 p-1">
              <button
                type="button"
                onClick={() => setProductGridDensity('compact')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  productGridDensity === 'compact'
                    ? 'bg-emerald-500/25 text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setProductGridDensity('confort')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  productGridDensity === 'confort'
                    ? 'bg-emerald-500/25 text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Confort
              </button>
            </div>
          </div>
        </div>
        {activeView === 'caisse' ? (
          <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
            <main className="premium-scrollbar min-w-0 flex-1 overflow-y-auto bg-slate-100/70 p-4 pb-24 xl:p-6 xl:pb-6">
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
              {activeStore ? (
                <p className="mb-3 text-xs font-medium text-slate-600">
                  Point de vente :{' '}
                  <span className="text-slate-900">{activeStore.name}</span>
                  {stores.length > 1 && !canSwitchStore ? (
                    <span className="text-slate-400">
                      {' '}
                      (changement réservé aux profils autorisés)
                    </span>
                  ) : null}
                </p>
              ) : null}
              {ruptureCount > 0 ? (
                <div
                  className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                    perms.canManageStocks
                      ? 'border-red-200 bg-red-50/90 text-red-950'
                      : 'border-amber-200 bg-amber-50/90 text-amber-950'
                  }`}
                  role="alert"
                >
                  <span>
                    <strong>{ruptureCount}</strong> article
                    {ruptureCount > 1 ? 's' : ''} en{' '}
                    <strong>rupture de stock</strong>
                    {!perms.canManageStocks
                      ? ' — prévenir un responsable pour réapprovisionnement.'
                      : ''}
                  </span>
                  {perms.canManageStocks ? (
                    <button
                      type="button"
                      onClick={() => setActiveView('stocks')}
                      className="shrink-0 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                    >
                      Gérer les stocks
                    </button>
                  ) : null}
                </div>
              ) : null}
              <ProductGrid
                products={displayProducts}
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
          <div className="flex min-w-0 flex-1 flex-col bg-linear-to-b from-slate-100 via-slate-50 to-white">
            <ViewHeader
              view={activeView}
              sessionId={SESSION_ID}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setActiveView('caisse')}
                  className="premium-btn-dark rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Retour caisse
                </button>
              }
            />
            <div className="flex-1 overflow-y-auto px-4 pb-10 pt-2 lg:px-8 lg:pt-0">
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
          </div>
        )}
        {activeView === 'caisse' ? (
          <>
            <button
              type="button"
              onClick={() => setIsFloatingCartOpen(true)}
              className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xl shadow-emerald-700/30 transition hover:bg-emerald-500 xl:hidden"
            >
              <span>Panier</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {cartItemCount}
              </span>
              <span className="text-xs font-medium text-emerald-100">
                {formatFCFA(cartTotalTTC)}
              </span>
            </button>
            {isFloatingCartOpen ? (
              <div className="fixed inset-0 z-40 xl:hidden">
                <button
                  type="button"
                  aria-label="Fermer le panier"
                  className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px]"
                  onClick={() => setIsFloatingCartOpen(false)}
                />
                <div className="absolute inset-y-0 right-0 w-[min(92vw,24rem)]">
                  <div className="flex h-full flex-col bg-white shadow-2xl">
                    <div className="flex items-center justify-end border-b border-slate-200 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setIsFloatingCartOpen(false)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        Fermer
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
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
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
