import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { OfflineBanner } from '../components/OfflineBanner'
import { useActiveStore } from '../context/ActiveStoreContext'
import { db } from '../db/db'
import type {
  CartLine,
  OnlineOrder,
  PaymentMethod,
  ProductWithStock,
} from '../db/types'
import {
  DEFAULT_VAT_RATE_PCT,
  formatFCFA,
  totalsFromLinesTTC,
} from '../lib/money'
import { productImageSrc } from '../lib/productImage'
import { storeStockRowId } from '../lib/storeStockId'

type Props = {
  online: boolean
  seedReady: boolean
  onOpenStaffLogin: () => void
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

const PROMO_CODES: Record<string, number> = {
  PROMO5: 5,
  PROMO10: 10,
}
const FREE_DELIVERY_THRESHOLD = 15000
const BRAND_LOGO_SRC = '/branding/greenfever-logo.png'

function CartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className ?? 'h-4 w-4'}
    >
      <path
        d="M3 5h2l1.2 8.2a2 2 0 0 0 2 1.7h8.7a2 2 0 0 0 2-1.6L20 8H7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="19" r="1.5" fill="currentColor" />
      <circle cx="17" cy="19" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function LuxuryStorefrontView({
  online,
  seedReady,
  onOpenStaffLogin,
}: Props) {
  const { displayProducts, activeStoreId, activeStore } = useActiveStore()
  const cardDensity: 'compact' | 'confort' = 'compact'
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [fulfillmentMode, setFulfillmentMode] = useState<'pickup' | 'delivery'>(
    'pickup',
  )
  const [promoCode, setPromoCode] = useState('')
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null)
  const [discountPct, setDiscountPct] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile')
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [cartBadgePulse, setCartBadgePulse] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [flyToCart, setFlyToCart] = useState<FlyToCartAnim | null>(null)
  const productsSectionRef = useRef<HTMLElement | null>(null)
  const cartPanelRef = useRef<HTMLElement | null>(null)
  const checkoutFormRef = useRef<HTMLDivElement | null>(null)
  const cartBadgeRef = useRef<HTMLSpanElement | null>(null)
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const featuredProducts = useMemo(
    () => [...displayProducts].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [displayProducts],
  )
  const topOrderedProducts = useLiveQuery(async () => {
    const [sales, onlineOrders] = await Promise.all([
      db.sales.toArray(),
      db.onlineOrders.toArray(),
    ])

    const qtyByProductId = new Map<string, number>()
    const addQty = (productId: string, qty: number) => {
      qtyByProductId.set(productId, (qtyByProductId.get(productId) ?? 0) + qty)
    }

    for (const sale of sales) {
      for (const line of sale.lines) {
        addQty(line.productId, line.qty)
      }
    }
    for (const order of onlineOrders) {
      if (order.status === 'rejected') continue
      for (const line of order.lines) {
        addQty(line.productId, line.qty)
      }
    }

    const byId = new Map(displayProducts.map((product) => [product.id, product]))
    return [...qtyByProductId.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([productId, orderedQty]) => {
        const product = byId.get(productId)
        if (!product) return null
        return { product, orderedQty }
      })
      .filter((entry): entry is { product: ProductWithStock; orderedQty: number } =>
        Boolean(entry),
      )
  }, [displayProducts])
  const featuredByCategory = useMemo(() => {
    const grouped = new Map<string, ProductWithStock[]>()
    for (const product of featuredProducts) {
      const category = product.category?.trim() || 'Autres'
      const list = grouped.get(category)
      if (list) {
        list.push(product)
      } else {
        grouped.set(category, [product])
      }
    }
    return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'))
  }, [featuredProducts])

  const grossTotals = useMemo(() => totalsFromLinesTTC(cart, 0), [cart])
  const totals = useMemo(
    () => totalsFromLinesTTC(cart, discountPct),
    [cart, discountPct],
  )
  const discountAmount = useMemo(
    () => Math.max(0, grossTotals.totalTTC - totals.totalTTC),
    [grossTotals.totalTTC, totals.totalTTC],
  )
  const deliveryFeeTTC = useMemo(
    () => (fulfillmentMode === 'delivery' ? 1000 : 0),
    [fulfillmentMode],
  )
  const grandTotalTTC = useMemo(
    () => totals.totalTTC + deliveryFeeTTC,
    [totals.totalTTC, deliveryFeeTTC],
  )

  const lineQty = useCallback(
    (productId: string): number =>
      cart.find((line) => line.productId === productId)?.qty ?? 0,
    [cart],
  )

  function triggerCartPulse() {
    setCartBadgePulse(true)
    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current)
    }
    pulseTimeoutRef.current = setTimeout(() => {
      setCartBadgePulse(false)
      pulseTimeoutRef.current = null
    }, 600)
  }

  const triggerFlyToCart = useCallback(
    (product: ProductWithStock, originEl?: HTMLElement | null) => {
      if (!originEl || !cartBadgeRef.current) return
      const from = originEl.getBoundingClientRect()
      const to = cartBadgeRef.current.getBoundingClientRect()
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
    [],
  )

  const handleAdd = (product: ProductWithStock, originEl?: HTMLElement | null) => {
    if (product.stock <= 0) return
    let didAdd = false
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id)
      const currentQty = existing?.qty ?? 0
      if (currentQty >= product.stock) return prev
      if (!existing) {
        didAdd = true
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unitPriceTTC: product.priceTTC,
            qty: 1,
            vatRatePct: product.vatRatePct ?? DEFAULT_VAT_RATE_PCT,
          },
        ]
      }
      return prev.map((line) =>
        line.productId === product.id
          ? ((didAdd = true),
            {
              ...line,
              qty: line.qty + 1,
              unitPriceTTC: product.priceTTC,
              vatRatePct: product.vatRatePct ?? DEFAULT_VAT_RATE_PCT,
            })
          : line,
      )
    })
    if (didAdd) {
      triggerCartPulse()
      triggerFlyToCart(product, originEl)
    }
  }

  const handleRemove = useCallback((productId: string) => {
    setCart((prev) => prev.filter((line) => line.productId !== productId))
  }, [])

  const handleClearCart = useCallback(() => {
    setCart([])
    setPromoCode('')
    setPromoFeedback(null)
    setDiscountPct(0)
    setConfirmation(null)
  }, [])

  const handleIncLine = useCallback(
    (productId: string) => {
      setCart((prev) => {
        const product = displayProducts.find((p) => p.id === productId)
        if (!product) return prev
        return prev.map((line) => {
          if (line.productId !== productId) return line
          if (line.qty >= product.stock) return line
          return { ...line, qty: line.qty + 1 }
        })
      })
    },
    [displayProducts],
  )

  const handleDecLine = useCallback((productId: string) => {
    setCart((prev) =>
      prev
        .map((line) =>
          line.productId === productId ? { ...line, qty: line.qty - 1 } : line,
        )
        .filter((line) => line.qty > 0),
    )
  }, [])

  const itemCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.qty, 0),
    [cart],
  )
  const distinctItemCount = cart.length
  const freeDeliveryProgressPct = useMemo(() => {
    if (FREE_DELIVERY_THRESHOLD <= 0) return 100
    return Math.min(
      100,
      Math.round((Math.max(0, totals.totalTTC) / FREE_DELIVERY_THRESHOLD) * 100),
    )
  }, [totals.totalTTC])
  const freeDeliveryRemaining = useMemo(
    () => Math.max(0, FREE_DELIVERY_THRESHOLD - totals.totalTTC),
    [totals.totalTTC],
  )
  const hasFreeDelivery = freeDeliveryRemaining <= 0
  const estimatedWindow =
    fulfillmentMode === 'delivery' ? 'Livraison 45-90 min' : 'Retrait 15-30 min'
  const productById = useMemo(
    () => new Map(displayProducts.map((p) => [p.id, p])),
    [displayProducts],
  )
  const fulfillmentLabel =
    fulfillmentMode === 'delivery' ? 'Livraison à domicile' : 'Retrait boutique'

  const openCart = useCallback(() => {
    setIsCartOpen(true)
  }, [])

  const toggleCart = useCallback(() => {
    setIsCartOpen((prev) => !prev)
  }, [])

  const scrollToProducts = useCallback(() => {
    productsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const scrollToCheckoutForm = useCallback(() => {
    setIsCartOpen(true)
  }, [])

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current)
      }
      if (flyTimeoutRef.current) {
        clearTimeout(flyTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isCartOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCartOpen(false)
    }
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('keydown', onEscape)
    }
  }, [isCartOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        onOpenStaffLogin()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onOpenStaffLogin])

  const handleApplyPromo = useCallback(() => {
    const code = promoCode.trim().toUpperCase()
    if (!code) {
      setDiscountPct(0)
      setPromoFeedback(null)
      return
    }
    const pct = PROMO_CODES[code]
    if (!pct) {
      setDiscountPct(0)
      setPromoFeedback('Code promo non reconnu')
      return
    }
    setDiscountPct(pct)
    setPromoFeedback(`Code ${code} appliqué (${pct}%)`)
  }, [promoCode])

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) {
      setConfirmation('Ajoutez au moins un article pour valider la commande.')
      return
    }
    if (!customerName.trim()) {
      setConfirmation('Merci de renseigner votre nom pour finaliser la commande.')
      return
    }
    if (fulfillmentMode === 'delivery' && !customerAddress.trim()) {
      setConfirmation('Adresse requise pour une livraison.')
      return
    }
    if (!online && paymentMethod !== 'cash') {
      setConfirmation(
        'Mode hors ligne : utilisez le paiement à la livraison en espèces.',
      )
      return
    }

    setSubmitting(true)
    try {
      const orderId = crypto.randomUUID()
      const createdAt = Date.now()
      const total = totalsFromLinesTTC(cart, discountPct)
      const customerLabel = customerName.trim()

      const orderRecord: OnlineOrder = {
        id: orderId,
        createdAt,
        storeId: activeStoreId,
        storeName: activeStore?.name,
        customerName: customerLabel,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        paymentMethod,
        lines: cart.map((line) => ({
          productId: line.productId,
          name: line.name,
          unitPriceTTC: line.unitPriceTTC,
          qty: line.qty,
          vatRatePct: line.vatRatePct,
        })),
        subtotalHT: total.subtotalHT,
        tva: total.tva,
        totalTTC: grandTotalTTC,
        netProductsTTC: total.totalTTC,
        discountPct: discountPct || undefined,
        promoCode: promoCode.trim().toUpperCase() || undefined,
        deliveryFeeTTC: deliveryFeeTTC || undefined,
        fulfillmentMode,
        status: 'pending',
      }

      for (const line of cart) {
        const product = await db.products.get(line.productId)
        if (!product || product.archived) {
          throw new Error(`Le produit « ${line.name} » n'est plus disponible.`)
        }
        const stockRow = await db.storeStocks.get(
          storeStockRowId(activeStoreId, line.productId),
        )
        const currentStock = stockRow?.stock ?? 0
        if (currentStock < line.qty) {
          throw new Error(
            `Stock insuffisant pour « ${line.name} » (reste ${currentStock}).`,
          )
        }
      }
      await db.onlineOrders.put(orderRecord)

      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
      setPromoCode('')
      setPromoFeedback(null)
      setDiscountPct(0)
      setConfirmation(
        `Commande envoyée pour validation. Référence: ${orderId
          .slice(0, 8)
          .toUpperCase()}.`,
      )
    } catch (error) {
      setConfirmation(
        error instanceof Error
          ? error.message
          : 'Impossible de finaliser la commande pour le moment.',
      )
    } finally {
      setSubmitting(false)
    }
  }, [
    activeStore?.name,
    activeStoreId,
    cart,
    customerAddress,
    customerName,
    customerPhone,
    deliveryFeeTTC,
    discountPct,
    fulfillmentMode,
    grandTotalTTC,
    online,
    paymentMethod,
    promoCode,
  ])

  return (
    <div className="min-h-svh bg-linear-to-b from-[#090f1d] via-[#0f172a] to-premium-navy text-slate-100">
      {!online ? <OfflineBanner /> : null}
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="premium-dark-card rounded-3xl bg-linear-to-r from-slate-900 via-slate-900 to-amber-950/70 p-6 shadow-2xl shadow-amber-900/20">
          <div className="mb-4 flex items-center gap-2 px-1 py-1">
            <button
              type="button"
              onDoubleClick={onOpenStaffLogin}
              title="Double-clic pour accéder à la gestion"
              className="shrink-0 rounded-full"
            >
              <img
                src={BRAND_LOGO_SRC}
                alt="Logo The Greenfever"
                className="h-9 w-9 rounded-full border border-amber-200/45 object-cover ring-2 ring-emerald-200/35 lg:h-10 lg:w-10"
              />
            </button>
            <nav className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap lg:justify-center">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-slate-100 transition hover:border-amber-200/45 hover:text-amber-100"
              >
                Accueil
              </button>
              <button
                type="button"
                onClick={scrollToProducts}
                className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-slate-100 transition hover:border-amber-200/45 hover:text-amber-100"
              >
                Produits
              </button>
              <button
                type="button"
                onClick={scrollToCheckoutForm}
                className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-slate-100 transition hover:border-amber-200/45 hover:text-amber-100"
              >
                Contact
              </button>
            </nav>
            <button
              type="button"
              onClick={toggleCart}
              aria-label="Afficher le panier"
              className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200/45 bg-black/25 text-amber-100 transition hover:bg-black/40"
            >
              <span
                ref={cartBadgeRef}
                className={`absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-200 px-1 py-0.5 text-[10px] font-bold leading-none text-slate-900 transition ${
                  cartBadgePulse ? 'animate-pulse ring-2 ring-amber-100/80' : ''
                }`}
              >
                {itemCount}
              </span>
              <CartIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        {isCartOpen ? (
          <>
            <button
              type="button"
              aria-label="Fermer le panier"
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[1px]"
            />
            <aside
              ref={cartPanelRef}
              className="premium-dark-card premium-ring fixed left-1/2 top-20 z-40 max-h-[calc(100svh-6rem)] w-[calc(100%-1.25rem)] max-w-lg -translate-x-1/2 overflow-y-auto rounded-3xl border border-amber-200/20 bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 p-4 shadow-2xl shadow-black/40 sm:left-auto sm:right-4 sm:w-[min(92vw,34rem)] sm:translate-x-0"
            >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100/10 text-amber-100 ring-1 ring-amber-200/25">
                <CartIcon className="h-4 w-4" />
              </span>
              Votre panier
            </h2>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex min-w-7 items-center justify-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-slate-900 transition ${
                  cartBadgePulse ? 'animate-pulse ring-2 ring-amber-100/80' : ''
                }`}
              >
                {itemCount}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                {distinctItemCount} ligne(s)
              </span>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Fermer
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Livraison locale ou retrait boutique.
          </p>
          <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-emerald-100">
                Livraison offerte des {formatFCFA(FREE_DELIVERY_THRESHOLD)}
              </span>
              <span className="font-semibold text-emerald-100">
                {freeDeliveryProgressPct}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-linear-to-r from-emerald-400 to-amber-300 transition-all duration-500"
                style={{ width: `${freeDeliveryProgressPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-emerald-100/90">
              {hasFreeDelivery
                ? 'Bravo, la livraison est offerte.'
                : `Encore ${formatFCFA(freeDeliveryRemaining)} pour debloquer la livraison offerte.`}
            </p>
          </div>
          <div className="mt-2 rounded-full border border-amber-200/25 bg-amber-100/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
            Panier + informations + paiement
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2">
            <p className="text-xs text-slate-300">Articles dans le panier</p>
            <p className="text-sm font-semibold text-amber-100">{itemCount}</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Réception
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">
                {fulfillmentLabel}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Paiement
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-100">
                {paymentMethod === 'mobile'
                  ? 'Mobile money'
                  : paymentMethod === 'card'
                    ? 'Carte bancaire'
                    : 'Espèces'}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {cart.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                Votre panier est vide.
              </p>
            ) : (
              cart.map((line) => (
                <div
                  key={line.productId}
                  className="rounded-2xl border border-amber-200/15 bg-linear-to-r from-slate-950/90 to-slate-900/70 px-2.5 py-2 shadow-lg shadow-black/20"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={productImageSrc({ name: line.name })}
                      alt={line.name}
                      className="h-9 w-9 rounded-xl border border-white/15 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-slate-100">
                        {line.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatFCFA(line.unitPriceTTC)} / unité
                      </p>
                      {productById.get(line.productId) ? (
                        <p className="text-[9px] text-slate-500">
                          Reste: {productById.get(line.productId)?.stock ?? 0}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-1.5">
                    <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950/75">
                      <button
                        type="button"
                        onClick={() => handleDecLine(line.productId)}
                        className="px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                      >
                        −
                      </button>
                      <span className="border-x border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-100">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleIncLine(line.productId)}
                        className="px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-semibold text-amber-100">
                        {formatFCFA(line.unitPriceTTC * line.qty)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRemove(line.productId)}
                        className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-red-300 hover:text-red-300"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Résumé de commande
              </p>
              <div className="flex items-center justify-between text-slate-300">
                <span>Sous-total HT</span>
                <span>{formatFCFA(totals.subtotalHT)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-slate-300">
                <span>TVA</span>
                <span>{formatFCFA(totals.tva)}</span>
              </div>
              {discountAmount > 0 ? (
                <div className="mt-1 flex items-center justify-between text-emerald-300">
                  <span>Remise promo</span>
                  <span>- {formatFCFA(discountAmount)}</span>
                </div>
              ) : null}
              {deliveryFeeTTC > 0 ? (
                <div className="mt-1 flex items-center justify-between text-slate-300">
                  <span>Livraison</span>
                  <span>{formatFCFA(deliveryFeeTTC)}</span>
                </div>
              ) : null}
              <div className="mt-1 flex items-center justify-between text-slate-300">
                <span>Delai estime</span>
                <span>{estimatedWindow}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-base font-semibold text-amber-100">
                <span>Total à payer</span>
                <span>{formatFCFA(grandTotalTTC)}</span>
              </div>
            </div>

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleClearCart}
              disabled={cart.length === 0}
              className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Vider le panier
            </button>
          </div>

          <div ref={checkoutFormRef} className="mt-2 max-w-md space-y-3">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nom complet"
                className="premium-input w-full rounded-xl bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Telephone"
                className="premium-input w-full rounded-xl bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={fulfillmentMode}
                  onChange={(e) =>
                    setFulfillmentMode(e.target.value as 'pickup' | 'delivery')
                  }
                  aria-label="Mode de réception"
                  className="premium-input w-full rounded-xl bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="pickup">Retrait boutique</option>
                  <option value="delivery">Livraison locale (+1000)</option>
                </select>
                <div className="flex gap-1.5">
                  <input
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value)
                      setPromoFeedback(null)
                    }}
                    placeholder="Code promo"
                    className="premium-input w-full rounded-xl bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="rounded-lg border border-amber-200/40 px-2.5 text-xs font-semibold text-amber-100 hover:bg-amber-100/10"
                  >
                    OK
                  </button>
                  {discountPct > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPromoCode('')
                        setPromoFeedback(null)
                        setDiscountPct(0)
                      }}
                      className="rounded-lg border border-slate-700 px-2.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white"
                    >
                      X
                    </button>
                  ) : null}
                </div>
              </div>
              <textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Adresse de livraison (optionnelle)"
                rows={2}
                className="premium-input w-full resize-none rounded-xl bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              />
              {promoFeedback ? (
                <p className="text-xs text-amber-200">{promoFeedback}</p>
              ) : null}
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                aria-label="Mode de paiement"
                className="premium-input w-full rounded-xl bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              >
                <option value="mobile">Mobile Money</option>
                <option value="card">Carte bancaire</option>
                <option value="cash">Especes a la livraison</option>
              </select>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <p className="rounded-lg border border-white/10 bg-slate-950/70 px-2.5 py-2">
                  Paiement securise SSL
                </p>
                <p className="rounded-lg border border-white/10 bg-slate-950/70 px-2.5 py-2">
                  Validation sous 10 min
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCheckout()}
                disabled={submitting || cart.length === 0}
                className="premium-btn w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {submitting ? 'Validation en cours...' : 'Valider la commande'}
              </button>
            </div>

          {confirmation ? (
            <p className="mt-3 max-w-md rounded-xl border border-amber-200/30 bg-amber-100/10 px-3 py-2 text-xs text-amber-100">
              {confirmation}
            </p>
          ) : null}
            </aside>
          </>
        ) : null}

        <main className="mt-6">
          {topOrderedProducts && topOrderedProducts.length > 0 ? (
            <section className="premium-dark-card mb-4 rounded-3xl border border-amber-200/20 bg-slate-900/75 p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-100/90">
                  Produits les plus commandés
                </h2>
                <span className="rounded-full border border-amber-200/35 bg-amber-100/10 px-2.5 py-1 text-[10px] font-semibold text-amber-100">
                  Top {topOrderedProducts.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {topOrderedProducts.map(({ product, orderedQty }, index) => {
                  const qty = lineQty(product.id)
                  const soldOut = product.stock <= 0
                  return (
                    <article
                      key={product.id}
                      className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70"
                    >
                      <div className="relative">
                        <img
                          src={productImageSrc(product)}
                          alt={product.name}
                          className="h-24 w-full object-cover"
                        />
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                          #{index + 1}
                        </span>
                        <span
                          className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                            soldOut
                              ? 'bg-slate-700 text-slate-300'
                              : 'bg-emerald-500/20 text-emerald-200'
                          }`}
                        >
                          {soldOut ? 'Rupture' : `${product.stock}`}
                        </span>
                      </div>
                      <div className="space-y-1 p-2">
                        <p className="line-clamp-2 text-[10px] font-semibold text-slate-100">
                          {product.name}
                        </p>
                        <p className="text-[9px] text-emerald-200/90">
                          {orderedQty} commande(s)
                        </p>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/10 px-2 py-1.5">
                        <p className="text-[9px] text-slate-400">Panier: {qty}</p>
                        <button
                          type="button"
                          disabled={soldOut}
                          onClick={(e) => handleAdd(product, e.currentTarget)}
                          className="rounded-md bg-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          Ajouter
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}
          <section
            ref={productsSectionRef}
            className="premium-dark-card rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl"
          >
            {!seedReady ? (
              <div className="mt-6 flex flex-col items-center gap-3 py-4">
                <div className="relative">
                  <span className="absolute inset-0 rounded-full border-2 border-emerald-300/55" />
                  <img
                    src={BRAND_LOGO_SRC}
                    alt="Chargement catalogue"
                    className="h-14 w-14 rounded-full border-2 border-amber-200/55 object-cover ring-2 ring-emerald-200/35 animate-[spin_3.2s_linear_infinite]"
                  />
                </div>
                <p className="text-sm text-slate-400">
                  Chargement du catalogue premium...
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {featuredByCategory.map(([category, products]) => (
                  <section key={category} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="h-px flex-1 bg-white/10" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100/85">
                        {category}
                      </p>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                    <div
                      className={`${
                        cardDensity === 'compact'
                          ? 'grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7'
                          : 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
                      }`}
                    >
                      {products.map((product) => {
                        const qty = lineQty(product.id)
                        const soldOut = product.stock <= 0
                        return (
                          <article
                            key={product.id}
                            className={`group overflow-hidden border border-white/10 bg-slate-950/75 transition duration-200 hover:-translate-y-0.5 hover:border-amber-200/40 hover:shadow-lg hover:shadow-black/30 ${
                              cardDensity === 'compact' ? 'rounded-lg' : 'rounded-xl'
                            }`}
                          >
                            <div className="relative">
                              <img
                                src={productImageSrc(product)}
                                alt={product.name}
                                className={`w-full object-cover transition duration-300 group-hover:scale-[1.06] ${
                                  cardDensity === 'compact'
                                    ? 'h-24 sm:h-28'
                                    : 'h-32 sm:h-36'
                                }`}
                              />
                              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent opacity-70 transition duration-300 group-hover:opacity-90" />
                              <span
                                className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                                  soldOut
                                    ? 'bg-slate-700 text-slate-300'
                                    : 'bg-emerald-500/20 text-emerald-200'
                                }`}
                              >
                                {soldOut ? 'Rupture' : `${product.stock} dispo`}
                              </span>
                              <p className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100 backdrop-blur-sm">
                                {formatFCFA(
                                  discountPct > 0
                                    ? product.priceTTC * (1 - discountPct / 100)
                                    : product.priceTTC,
                                )}
                              </p>
                            </div>

                            <div
                              className={`space-y-1 ${
                                cardDensity === 'compact' ? 'p-1.5' : 'p-2'
                              }`}
                            >
                              <h3
                                className={`line-clamp-2 font-semibold text-white transition-colors group-hover:text-amber-100 ${
                                  cardDensity === 'compact'
                                    ? 'text-[10px]'
                                    : 'text-[11px]'
                                }`}
                              >
                                {product.name}
                              </h3>
                              <p
                                className={`text-slate-400 ${
                                  cardDensity === 'compact'
                                    ? 'text-[9px]'
                                    : 'text-[10px]'
                                }`}
                              >
                                {product.category}
                              </p>
                            </div>

                            <div
                              className={`flex items-center justify-between border-t border-white/10 ${
                                cardDensity === 'compact'
                                  ? 'gap-1 px-1.5 py-1'
                                  : 'gap-1.5 px-2 py-1.5'
                              }`}
                            >
                              <p
                                className={`text-slate-400 ${
                                  cardDensity === 'compact'
                                    ? 'text-[9px]'
                                    : 'text-[10px]'
                                }`}
                              >
                                Panier: {qty}
                              </p>
                              <button
                                type="button"
                                disabled={soldOut}
                                onClick={(e) => handleAdd(product, e.currentTarget)}
                                className={`rounded-md bg-amber-200 font-semibold text-slate-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 ${
                                  cardDensity === 'compact'
                                    ? 'px-1.5 py-0.5 text-[9px]'
                                    : 'px-2 py-0.5 text-[10px]'
                                }`}
                              >
                                Ajouter
                              </button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {seedReady && featuredProducts.length === 0 ? (
              <p className="mt-8 text-sm text-slate-400">
                Aucun article disponible.
              </p>
            ) : null}
          </section>
        </main>

        <footer className="premium-dark-card premium-ring mt-6 rounded-3xl border border-white/10 bg-slate-950/75 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <img
                src={BRAND_LOGO_SRC}
                alt="Logo boutique"
                className="h-12 w-12 rounded-full border border-amber-200/35 object-cover"
              />
              <p className="mt-2 text-sm text-slate-300">
                Commande premium avec validation en magasin, livraison locale et
                retrait rapide.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                Navigation
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={scrollToProducts}
                  className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-slate-200 transition hover:border-amber-200/45 hover:text-amber-100"
                >
                  Produits
                </button>
                <button
                  type="button"
                  onClick={openCart}
                  className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-slate-200 transition hover:border-amber-200/45 hover:text-amber-100"
                >
                  Panier
                </button>
                <button
                  type="button"
                  onClick={scrollToCheckoutForm}
                  className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-slate-200 transition hover:border-amber-200/45 hover:text-amber-100"
                >
                  Commander
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                Contact & Horaires
              </p>
              <p className="mt-2 text-sm text-slate-300">+225 07 00 00 00 00</p>
              <p className="text-sm text-slate-300">support@caisseci.local</p>
              <p className="mt-1 text-xs text-slate-400">
                Lun-Sam: 8h00 - 20h00
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                Assistance client
              </p>
              <p className="mt-2 text-sm text-slate-300">
                FAQ, suivi commande et support achat.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Réponse rapide pendant les horaires d'ouverture.
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-slate-400">
            <p>
              Service de commande en ligne premium.
            </p>
          </div>
        </footer>
      </div>
      {itemCount > 0 ? (
        <div className="fixed bottom-3 left-1/2 z-20 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl border border-amber-200/35 bg-slate-950/90 p-2 shadow-2xl shadow-black/40 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={openCart}
            className="flex w-full items-center justify-between rounded-xl bg-amber-200 px-3 py-2 text-left text-slate-900"
          >
            <span className="text-sm font-bold">{formatFCFA(grandTotalTTC)}</span>
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <span
                className={`inline-flex min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-amber-100 transition ${
                  cartBadgePulse ? 'animate-pulse' : ''
                }`}
              >
                {itemCount}
              </span>
              <CartIcon className="h-4 w-4" />
            </span>
          </button>
        </div>
      ) : null}
      {flyToCart ? (
        <img
          src={flyToCart.src}
          alt=""
          aria-hidden
          className="pointer-events-none fixed z-40 h-10 w-10 rounded-lg border border-amber-100/60 object-cover shadow-xl shadow-black/50"
          style={{
            left: flyToCart.x - 20,
            top: flyToCart.y - 20,
            transform: flyToCart.active
              ? `translate(${flyToCart.dx}px, ${flyToCart.dy}px) scale(0.28)`
              : 'translate(0px, 0px) scale(1)',
            opacity: flyToCart.active ? 0.25 : 0.98,
            transition:
              'transform 560ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 560ms ease',
          }}
        />
      ) : null}
    </div>
  )
}
