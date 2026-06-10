import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { OfflineBanner } from '../components/OfflineBanner'
import { useActiveStoreOptional } from '../context/ActiveStoreContext'
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
import { ProductImage } from '../components/ProductImage'
import { ProductDetailModal } from '../components/ProductDetailModal'
import { storeStockRowId } from '../lib/storeStockId'
import { BRAND_NAME } from '../brand'
import { BrandLogo } from '../components/BrandLogo'
import {
  getDeliveryProviderDemo,
  getKitchenStationDemo,
  isDeliveryModuleDemoOn,
  isKitchenModuleDemoOn,
} from '../lib/integrationsConfig'

import type { PublicStorefrontOrderInput } from '../lib/storefront/types'

type PublicStorefrontConfig = {
  storeName: string
  storeId: string
  products: ProductWithStock[]
  submitOrder: (
    order: PublicStorefrontOrderInput,
  ) => Promise<{ orderId: string; reference: string }>
}

type Props = {
  online: boolean
  seedReady: boolean
  onOpenStaffLogin: () => void
  publicStorefront?: PublicStorefrontConfig
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

const FREE_DELIVERY_THRESHOLD = 15000
const DESIRED_TIME_SLOTS: string[] = (() => {
  const slots = ['ASAP (des que possible)']
  const startMin = 7 * 60
  const endMin = 23 * 60
  for (let t = startMin; t < endMin; t += 15) {
    const next = t + 15
    const hh = String(Math.floor(t / 60)).padStart(2, '0')
    const mm = String(t % 60).padStart(2, '0')
    const hhNext = String(Math.floor(next / 60)).padStart(2, '0')
    const mmNext = String(next % 60).padStart(2, '0')
    slots.push(`${hh}h${mm} - ${hhNext}h${mmNext}`)
  }
  return slots
})()

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

function StatusIcon({
  tone,
  className,
}: {
  tone: 'success' | 'error'
  className?: string
}) {
  if (tone === 'success') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className={className ?? 'h-5 w-5'}
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="m8.5 12.3 2.2 2.3 4.8-5.1"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className ?? 'h-5 w-5'}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.5v5.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.8" r="1.1" fill="currentColor" />
    </svg>
  )
}

export function LuxuryStorefrontView({
  online,
  seedReady,
  onOpenStaffLogin,
  publicStorefront,
}: Props) {
  const storeCtx = useActiveStoreOptional()
  const displayProducts = publicStorefront?.products ?? storeCtx?.displayProducts ?? []
  const activeStoreId = publicStorefront?.storeId ?? storeCtx?.activeStoreId ?? 'store-main'
  const activeStore = publicStorefront
    ? {
        id: publicStorefront.storeId,
        name: publicStorefront.storeName,
        shortCode: '',
        sortOrder: 0,
      }
    : storeCtx?.activeStore
  const isPublicStorefront = Boolean(publicStorefront)
  const cardDensity: 'compact' | 'confort' = 'compact'
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [desiredTimeSlot, setDesiredTimeSlot] = useState('')
  const [fulfillmentMode, setFulfillmentMode] = useState<'pickup' | 'delivery'>(
    'pickup',
  )
  const [promoCode, setPromoCode] = useState('')
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null)
  const [discountPct, setDiscountPct] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile')
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [confirmationTone, setConfirmationTone] = useState<'success' | 'error'>(
    'success',
  )
  const [cartBadgePulse, setCartBadgePulse] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [flyToCart, setFlyToCart] = useState<FlyToCartAnim | null>(null)
  const [detailProduct, setDetailProduct] = useState<ProductWithStock | null>(
    null,
  )
  const promotions = useLiveQuery(() => db.promotions.toArray(), [], []) ?? []
  const productsSectionRef = useRef<HTMLElement | null>(null)
  const cartPanelRef = useRef<HTMLElement | null>(null)
  const checkoutFormRef = useRef<HTMLDivElement | null>(null)
  const contactRef = useRef<HTMLElement | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [contactSent, setContactSent] = useState(false)
  const cartBadgeRef = useRef<HTMLSpanElement | null>(null)
  const prevItemCountRef = useRef(0)
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const featuredProducts = useMemo(
    () => [...displayProducts].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [displayProducts],
  )
  const topOrderedProducts = useLiveQuery(async () => {
    if (isPublicStorefront) return []
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

  const scrollToContact = useCallback(() => {
    contactRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const submitContact = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!contactName.trim() || !contactMessage.trim()) return
      const subject = encodeURIComponent(
        `Contact boutique — ${contactName.trim()}`,
      )
      const body = encodeURIComponent(
        `${contactMessage.trim()}\n\n— ${contactName.trim()}${
          contactEmail.trim() ? ` (${contactEmail.trim()})` : ''
        }`,
      )
      window.location.href = `mailto:support@caisseci.local?subject=${subject}&body=${body}`
      setContactSent(true)
      window.setTimeout(() => setContactSent(false), 4000)
    },
    [contactName, contactEmail, contactMessage],
  )

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
    const prev = prevItemCountRef.current
    if (prev > 0 && itemCount === 0 && isCartOpen) {
      setIsCartOpen(false)
    }
    prevItemCountRef.current = itemCount
  }, [itemCount, isCartOpen])

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
    const now = Date.now()
    const promo = promotions.find((p) => p.code.toUpperCase() === code)
    if (!promo) {
      setDiscountPct(0)
      setPromoFeedback('Code promo non reconnu')
      return
    }
    if (!promo.active) {
      setDiscountPct(0)
      setPromoFeedback('Promotion inactive')
      return
    }
    if (promo.storeId && promo.storeId !== activeStoreId) {
      setDiscountPct(0)
      setPromoFeedback('Code non valable pour ce magasin')
      return
    }
    if (promo.startAt != null && now < promo.startAt) {
      setDiscountPct(0)
      setPromoFeedback('Promotion pas encore active')
      return
    }
    if (promo.endAt != null && now > promo.endAt) {
      setDiscountPct(0)
      setPromoFeedback('Promotion expirée')
      return
    }
    if (promo.maxUsage != null && promo.usageCount >= promo.maxUsage) {
      setDiscountPct(0)
      setPromoFeedback('Limite d’utilisation atteinte')
      return
    }
    const grossTotal = Math.round(totalsFromLinesTTC(cart, 0).totalTTC)
    if (promo.minCartTTC != null && grossTotal < promo.minCartTTC) {
      setDiscountPct(0)
      setPromoFeedback(
        `Panier minimum requis: ${formatFCFA(promo.minCartTTC)}`,
      )
      return
    }
    setDiscountPct(promo.discountPct)
    setPromoFeedback(`Code ${code} appliqué (${promo.discountPct}%)`)
  }, [activeStoreId, cart, promoCode, promotions])

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) {
      setConfirmationTone('error')
      setConfirmation('Ajoutez au moins un article pour valider la commande.')
      return
    }
    if (!customerName.trim()) {
      setConfirmationTone('error')
      setConfirmation('Merci de renseigner votre nom pour finaliser la commande.')
      return
    }
    if (fulfillmentMode === 'delivery' && !customerAddress.trim()) {
      setConfirmationTone('error')
      setConfirmation('Adresse requise pour une livraison.')
      return
    }
    if (!online && paymentMethod !== 'cash') {
      setConfirmationTone('error')
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
      const kitchenEnabled = isKitchenModuleDemoOn()

      const orderRecord: OnlineOrder = {
        id: orderId,
        createdAt,
        storeId: activeStoreId,
        storeName: activeStore?.name,
        customerName: customerLabel,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        customerNote: customerNote.trim() || undefined,
        desiredTimeSlot: desiredTimeSlot.trim() || undefined,
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
        kitchenStatus: kitchenEnabled ? 'queued' : undefined,
        kitchenPriority: kitchenEnabled
          ? fulfillmentMode === 'delivery'
            ? 'high'
            : 'normal'
          : undefined,
        kitchenStation: kitchenEnabled ? getKitchenStationDemo() : undefined,
        kitchenTicketCode: kitchenEnabled
          ? `K-${orderId.slice(0, 6).toUpperCase()}`
          : undefined,
        kitchenUpdatedAt: kitchenEnabled ? createdAt : undefined,
        deliveryStatus:
          fulfillmentMode === 'delivery' && isDeliveryModuleDemoOn()
            ? 'queued'
            : undefined,
        deliveryProvider:
          fulfillmentMode === 'delivery' && isDeliveryModuleDemoOn()
            ? getDeliveryProviderDemo()
            : undefined,
        deliveryUpdatedAt:
          fulfillmentMode === 'delivery' && isDeliveryModuleDemoOn()
            ? Date.now()
            : undefined,
      }

      for (const line of cart) {
        if (isPublicStorefront) {
          const product = displayProducts.find((p) => p.id === line.productId)
          if (!product) {
            throw new Error(`Le produit « ${line.name} » n'est plus disponible.`)
          }
          if (product.stock < line.qty) {
            throw new Error(
              `Stock insuffisant pour « ${line.name} » (reste ${product.stock}).`,
            )
          }
          continue
        }
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

      if (isPublicStorefront && publicStorefront) {
        const result = await publicStorefront.submitOrder({
          customerName: customerLabel,
          customerPhone: customerPhone.trim() || undefined,
          customerAddress: customerAddress.trim() || undefined,
          customerNote: customerNote.trim() || undefined,
          desiredTimeSlot: desiredTimeSlot.trim() || undefined,
          paymentMethod,
          fulfillmentMode,
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
        })
        setCart([])
        setCustomerName('')
        setCustomerPhone('')
        setCustomerAddress('')
        setCustomerNote('')
        setDesiredTimeSlot('')
        setPromoCode('')
        setPromoFeedback(null)
        setDiscountPct(0)
        setConfirmationTone('success')
        setConfirmation(
          `Commande envoyée pour validation. Référence: ${result.reference}.`,
        )
        return
      }

      await db.onlineOrders.put(orderRecord)

      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
      setCustomerNote('')
      setDesiredTimeSlot('')
      setPromoCode('')
      setPromoFeedback(null)
      setDiscountPct(0)
      setConfirmationTone('success')
      setConfirmation(
        `Commande envoyée pour validation. Référence: ${orderId
          .slice(0, 8)
          .toUpperCase()}.`,
      )
    } catch (error) {
      setConfirmationTone('error')
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
    customerNote,
    customerName,
    customerPhone,
    desiredTimeSlot,
    deliveryFeeTTC,
    discountPct,
    fulfillmentMode,
    grandTotalTTC,
    online,
    paymentMethod,
    promoCode,
    isPublicStorefront,
    publicStorefront,
    displayProducts,
  ])

  return (
    <div className="min-h-svh bg-linear-to-b from-[#090f1d] via-[#0f172a] to-premium-navy text-slate-100">
      {!online ? <OfflineBanner /> : null}
      <div className="mx-auto flex w-full max-w-7xl flex-col px-2 pb-16 pt-6 sm:px-5 lg:px-7">
        <header className="premium-dark-card sticky top-3 z-20 rounded-3xl bg-linear-to-r from-slate-900 via-slate-900 to-amber-950/70 p-3 shadow-2xl shadow-amber-900/20 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-slate-300">
            <p className="truncate">
              Boutique {publicStorefront?.storeName ?? BRAND_NAME} · Commande rapide et
              livraison locale
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-1 py-1">
            <button
              type="button"
              onClick={() => {
                setIsCartOpen(false)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              title="Retour à l'accueil"
              className="shrink-0 rounded-full border border-amber-200/35 bg-white/5 p-0.5 ring-1 ring-emerald-200/25"
            >
              <BrandLogo size="md" alt={BRAND_NAME} ring="gold" />
            </button>
            <nav className="ui-scroll flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap lg:justify-center">
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
                onClick={() => checkoutFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-slate-100 transition hover:border-amber-200/45 hover:text-amber-100"
              >
                Commander
              </button>
              <button
                type="button"
                onClick={scrollToContact}
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

        {confirmation ? (
          <div className="mt-3 flex justify-center">
            <div
              className={`inline-flex max-w-3xl items-center justify-center gap-2 rounded-xl border px-4 py-2 text-center text-sm ${
                confirmationTone === 'success'
                  ? 'border-emerald-200/40 bg-emerald-100/10 text-emerald-100'
                  : 'border-rose-200/40 bg-rose-100/10 text-rose-100'
              }`}
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">
                <StatusIcon tone={confirmationTone} className="h-4 w-4" />
              </span>
              <span>{confirmation}</span>
            </div>
          </div>
        ) : null}

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
                    <ProductImage
                      product={
                        productById.get(line.productId) ?? {
                          id: line.productId,
                          name: line.name,
                        }
                      }
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
              <select
                value={desiredTimeSlot}
                onChange={(e) => setDesiredTimeSlot(e.target.value)}
                aria-label="Creneau souhaite"
                className="premium-input w-full rounded-xl bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Choisir un creneau horaire</option>
                {DESIRED_TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Note client (code portail, instruction de livraison...)"
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
                      className={`overflow-hidden rounded-xl border bg-slate-950/70 transition hover:shadow-md hover:shadow-emerald-950/30 ${
                        soldOut
                          ? 'border-slate-600/55 hover:border-slate-500/70'
                          : 'border-emerald-400/35 hover:border-amber-200/55'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setDetailProduct(product)}
                        className="relative block w-full"
                        aria-label={`Voir le détail : ${product.name}`}
                      >
                        <ProductImage
                          product={product}
                          className="h-24 w-full object-cover"
                        />
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                          #{index + 1}
                        </span>
                        {soldOut ? (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
                            Rupture
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailProduct(product)}
                        className="block w-full space-y-1 p-2 text-left"
                      >
                        <p className="line-clamp-2 text-[10px] font-semibold text-slate-100">
                          {product.name}
                        </p>
                        <p className="font-mono-nums text-[10px] font-semibold text-emerald-400">
                          {formatFCFA(
                            discountPct > 0
                              ? product.priceTTC * (1 - discountPct / 100)
                              : product.priceTTC,
                          )}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {orderedQty} commande(s)
                        </p>
                      </button>
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
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <span className="absolute inset-0 rounded-full border-2 border-emerald-300/55" />
                  <BrandLogo
                    size="xl"
                    alt="Chargement catalogue"
                    ring="gold"
                    className="animate-pulse"
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
                            className={`group overflow-hidden border bg-slate-950/75 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 ${
                              soldOut
                                ? 'border-slate-600/50 hover:border-slate-500/65'
                                : 'border-emerald-400/35 hover:border-amber-200/55'
                            } ${
                              cardDensity === 'compact' ? 'rounded-lg' : 'rounded-xl'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setDetailProduct(product)}
                              className="relative block w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                              aria-label={`Voir le détail : ${product.name}`}
                            >
                              <ProductImage
                                product={product}
                                className={`w-full object-cover transition duration-300 group-hover:scale-[1.06] ${
                                  cardDensity === 'compact'
                                    ? 'h-24 sm:h-28'
                                    : 'h-32 sm:h-36'
                                }`}
                              />
                              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent opacity-70 transition duration-300 group-hover:opacity-90" />
                              {soldOut ? (
                                <span className="absolute right-2 top-2 rounded-full bg-slate-700 px-2 py-1 text-[10px] font-semibold uppercase text-slate-300">
                                  Rupture
                                </span>
                              ) : null}
                            </button>

                            <button
                              type="button"
                              onClick={() => setDetailProduct(product)}
                              className={`block w-full cursor-pointer text-left ${
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
                                className={`mt-0.5 font-mono-nums font-semibold text-emerald-400 ${
                                  cardDensity === 'compact'
                                    ? 'text-[10px]'
                                    : 'text-[11px]'
                                }`}
                              >
                                {formatFCFA(
                                  discountPct > 0
                                    ? product.priceTTC * (1 - discountPct / 100)
                                    : product.priceTTC,
                                )}
                              </p>
                            </button>

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

          <section
            ref={contactRef}
            id="contact"
            className="premium-dark-card premium-ring mt-6 scroll-mt-24 rounded-3xl border border-amber-200/20 bg-linear-to-br from-slate-950 via-slate-900 to-amber-950/40 p-5 sm:p-7"
          >
            <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/80">
                  Restons en contact
                </p>
                <h2 className="premium-dark-title mt-2 font-display text-2xl font-semibold sm:text-3xl">
                  Une question ? Une commande spéciale ?
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
                  Notre équipe vous répond du lundi au samedi. Pour les
                  livraisons groupées, événements ou demandes professionnelles,
                  contactez-nous directement.
                </p>

                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  <li>
                    <a
                      href="tel:+22507000000"
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3 transition hover:border-amber-200/40 hover:bg-slate-900/70"
                    >
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200/10 text-amber-200"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Téléphone
                        </span>
                        <span className="block font-mono-nums text-sm font-semibold text-slate-100">
                          +225 07 00 00 00 00
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          Appel direct
                        </span>
                      </span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://wa.me/22507000000"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3 transition hover:border-emerald-300/40 hover:bg-slate-900/70"
                    >
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4"
                        >
                          <path d="M20.52 3.48A11.86 11.86 0 0 0 12.04 0C5.46 0 .12 5.34.12 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.66a11.9 11.9 0 0 0 5.74 1.46h.01c6.58 0 11.92-5.34 11.92-11.92 0-3.18-1.24-6.18-3.45-8.4ZM12.04 21.78h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.85 9.85 0 0 1-1.51-5.23c0-5.45 4.43-9.88 9.89-9.88a9.83 9.83 0 0 1 7 2.9 9.82 9.82 0 0 1 2.9 7c0 5.45-4.44 9.88-9.9 9.88Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.49-.9-.8-1.5-1.78-1.67-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.03 1-1.03 2.45 0 1.45 1.06 2.85 1.21 3.05.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.7.22 1.34.19 1.84.12.56-.08 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          WhatsApp
                        </span>
                        <span className="block font-mono-nums text-sm font-semibold text-slate-100">
                          +225 07 00 00 00 00
                        </span>
                        <span className="block text-[11px] text-emerald-300/90">
                          Message instantané
                        </span>
                      </span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="mailto:support@caisseci.local"
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3 transition hover:border-amber-200/40 hover:bg-slate-900/70"
                    >
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200/10 text-amber-200"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <path d="m3 7 9 6 9-6" />
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Email
                        </span>
                        <span className="block truncate text-sm font-semibold text-slate-100">
                          support@caisseci.local
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          Réponse sous 24 h
                        </span>
                      </span>
                    </a>
                  </li>
                  <li>
                    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200/10 text-amber-200"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Adresse
                        </span>
                        <span className="block text-sm font-semibold text-slate-100">
                          Cocody, Abidjan
                        </span>
                        <a
                          href="https://maps.google.com/?q=Cocody+Abidjan"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-amber-200 underline decoration-dotted underline-offset-2 hover:text-amber-100"
                        >
                          Voir l'itinéraire
                        </a>
                      </span>
                    </div>
                  </li>
                </ul>

                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Horaires d'ouverture
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li className="flex items-center justify-between gap-3 text-slate-200">
                      <span>Lundi — Vendredi</span>
                      <span className="font-mono-nums text-amber-100">
                        8h00 — 20h00
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-3 text-slate-200">
                      <span>Samedi</span>
                      <span className="font-mono-nums text-amber-100">
                        9h00 — 21h00
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-3 text-slate-400">
                      <span>Dimanche</span>
                      <span className="font-mono-nums">Fermé</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Formulaire */}
              <form
                onSubmit={submitContact}
                className="rounded-3xl border border-amber-200/15 bg-slate-950/60 p-4 sm:p-5"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/80">
                  Écrivez-nous
                </p>
                <h3 className="premium-dark-title mt-1 text-lg font-semibold">
                  Message rapide
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Votre client mail s'ouvrira pré-rempli.
                </p>

                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Nom *
                    </span>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Votre nom"
                      required
                      className="premium-input mt-1 w-full rounded-xl bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Email
                    </span>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="vous@domaine.com"
                      className="premium-input mt-1 w-full rounded-xl bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Message *
                    </span>
                    <textarea
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Votre demande, commande spéciale, événement…"
                      rows={4}
                      required
                      className="premium-input mt-1 w-full resize-none rounded-xl bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!contactName.trim() || !contactMessage.trim()}
                  className="premium-btn mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  Envoyer le message
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="m22 2-11 11" />
                    <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
                  </svg>
                </button>
                {contactSent ? (
                  <p
                    role="status"
                    className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200"
                  >
                    Votre client mail s'est ouvert. Si rien ne s'affiche,
                    écrivez directement à{' '}
                    <span className="font-semibold">
                      support@caisseci.local
                    </span>
                    .
                  </p>
                ) : null}

                <p className="mt-3 text-[11px] text-slate-500">
                  En soumettant, vous acceptez d'être recontacté à propos de
                  votre demande.
                </p>
              </form>
            </div>
          </section>
        </main>

        <footer className="premium-dark-card premium-ring mt-6 rounded-3xl border border-white/10 bg-slate-950/75 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <BrandLogo size="xl" alt={BRAND_NAME} ring="gold" />
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
                <button
                  type="button"
                  onClick={scrollToContact}
                  className="rounded-lg border border-amber-200/35 bg-amber-200/10 px-2 py-1 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-200/20"
                >
                  Contact
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                Contact & Horaires
              </p>
              <a
                href="tel:+22507000000"
                className="mt-2 block text-sm text-slate-200 hover:text-amber-100"
              >
                +225 07 00 00 00 00
              </a>
              <a
                href="mailto:support@caisseci.local"
                className="block text-sm text-slate-200 hover:text-amber-100"
              >
                support@caisseci.local
              </a>
              <p className="mt-1 text-xs text-slate-400">
                Lun-Ven 8h-20h · Sam 9h-21h
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

      <ProductDetailModal
        product={detailProduct}
        cartQty={detailProduct ? lineQty(detailProduct.id) : 0}
        allProducts={featuredProducts}
        variant="storefront"
        onClose={() => setDetailProduct(null)}
        onAdd={(p, q) => {
          for (let i = 0; i < q; i++) handleAdd(p)
        }}
        onSelect={(p) => setDetailProduct(p)}
      />
    </div>
  )
}
