import { useMemo, useState, type Ref } from 'react'
import type { CartLine, MobileMoneyOperator } from '../db/types'
import type { CheckoutPaymentState } from '../lib/checkoutPayment'
import { validateCheckoutPayment } from '../lib/checkoutPayment'
import {
  formatFCFA,
  totalsFromLinesTTC,
  vatSlicesFromLinesTTC,
} from '../lib/money'
import { MOBILE_OPERATOR_LABELS } from '../lib/paymentDisplay'
import { Button } from '../ui/Button'
import { Field, Input, Select } from '../ui/Input'
import { Switch } from '../ui/Switch'
import { cn } from '../ui/cn'
import { ProductImage } from './ProductImage'
import {
  IconCard,
  IconCash,
  IconChevronRight,
  IconChevronDown,
  IconClose,
  IconMinus,
  IconMobile,
  IconPlus,
  IconReceipt,
} from '../ui/icons'

type Props = {
  lines: CartLine[]
  products: {
    id: string
    stock: number
    name: string
    category?: string
    imageUrl?: string
    imageDataUrl?: string
  }[]
  discountPct: number
  /** Plafond remise (affichage aide, aligné sur les permissions). */
  maxDiscountPct: number
  promoInput: string
  onPromoInputChange: (v: string) => void
  onApplyPromo: () => void
  promoFeedback: string | null
  payment: CheckoutPaymentState
  onPaymentPatch: (patch: Partial<CheckoutPaymentState>) => void
  online: boolean
  canPayElectronic?: boolean
  receiptPrinterEnabled?: boolean
  onInc: (productId: string) => void
  onDec: (productId: string) => void
  onRemove: (productId: string) => void
  onClear: () => void
  /** Annulation transaction en cours (audit). */
  onCancelTransaction?: () => void
  onCheckout: () => void
  checkoutBusy: boolean
  /** Si fourni, ajoute un bouton de fermeture (drawer mobile). */
  onClose?: () => void
  /** Cible pour animation « ajout au panier » (compteur dans l’en-tête). */
  countBadgeRef?: Ref<HTMLSpanElement | null>
  tableOptions?: { id: string; name: string; status?: string; statusCode?: string }[]
  selectedTableId?: string
  onSelectedTableIdChange?: (tableId: string) => void
  loyaltyPhone?: string
  onLoyaltyPhoneChange?: (value: string) => void
  loyaltyPointsAvailable?: number
  loyaltyRedeemPoints?: string
  onLoyaltyRedeemPointsChange?: (value: string) => void
  loyaltyRedeemAmountTTC?: number
  payableTotalTTC?: number
  dayClosed?: boolean
  dayClosedLabel?: string
}

function stockFor(
  products: Props['products'],
  productId: string,
): number {
  return products.find((p) => p.id === productId)?.stock ?? 0
}

function quickCashSuggestions(amountDue: number): number[] {
  if (!Number.isFinite(amountDue) || amountDue <= 0) return []
  const fixedDenominations = [1000, 2000, 5000, 10000, 15000, 20000]
  const nearestHigherFixed =
    fixedDenominations.find((v) => v >= amountDue) ?? Math.ceil(amountDue / 5000) * 5000
  const candidates = [amountDue, nearestHigherFixed, ...fixedDenominations]
  return [...new Set(candidates)]
    .filter((v) => v >= amountDue)
    .sort((a, b) => a - b)
    .slice(0, 6)
}

const PAYMENT_METHODS = [
  {
    id: 'cash' as const,
    label: 'Espèces',
    Icon: IconCash,
    iconClass: 'text-emerald-600',
    activeClass:
      'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]',
  },
  {
    id: 'card' as const,
    label: 'Carte',
    Icon: IconCard,
    iconClass: 'text-sky-600',
    activeClass:
      'border-sky-300 bg-sky-50 text-sky-900 shadow-[0_0_0_1px_rgba(14,165,233,0.25)]',
  },
  {
    id: 'mobile' as const,
    label: 'Mobile',
    Icon: IconMobile,
    iconClass: 'text-orange-600',
    activeClass:
      'border-orange-300 bg-orange-50 text-orange-900 shadow-[0_0_0_1px_rgba(249,115,22,0.25)]',
  },
]

export function CartPanel({
  lines,
  products,
  discountPct,
  promoInput,
  onPromoInputChange,
  onApplyPromo,
  promoFeedback,
  payment,
  onPaymentPatch,
  online,
  canPayElectronic = online,
  onInc,
  onDec,
  onRemove,
  onClear,
  onCancelTransaction,
  onCheckout,
  checkoutBusy,
  onClose,
  countBadgeRef,
  tableOptions = [],
  selectedTableId = '',
  onSelectedTableIdChange,
  loyaltyPhone = '',
  onLoyaltyPhoneChange,
  loyaltyPointsAvailable = 0,
  loyaltyRedeemPoints = '',
  onLoyaltyRedeemPointsChange,
  loyaltyRedeemAmountTTC = 0,
  payableTotalTTC,
  dayClosed = false,
  dayClosedLabel,
}: Props) {
  const totals = totalsFromLinesTTC(lines, discountPct)
  const vatSlices = vatSlicesFromLinesTTC(lines, discountPct)
  const count = lines.reduce((s, l) => s + l.qty, 0)
  const totalRounded = Math.round(payableTotalTTC ?? totals.totalTTC)
  const validation = validateCheckoutPayment(payment, totalRounded, canPayElectronic)
  const selectedTable = tableOptions.find((table) => table.id === selectedTableId)
  const selectedTableIsUnavailable =
    selectedTable?.statusCode === 'occupied' || selectedTable?.statusCode === 'reserved'
  const checkoutDisabled =
    lines.length === 0 ||
    checkoutBusy ||
    !validation.ok ||
    selectedTableIsUnavailable ||
    dayClosed

  const showMobileOperators =
    (!payment.mixed && payment.method === 'mobile') || payment.mixed

  const changePreview =
    validation.ok && validation.changeDue != null
      ? validation.changeDue
      : null

  const mobileSplit =
    Number.parseInt(payment.splitMobile.replace(/\s/g, '') || '0', 10)
  const cardSplit =
    Number.parseInt(payment.splitCard.replace(/\s/g, '') || '0', 10)
  const cashSplit =
    Number.parseInt(payment.splitCash.replace(/\s/g, '') || '0', 10)
  const cashDue = payment.mixed ? Math.max(0, cashSplit) : totalRounded
  const quickAmounts = quickCashSuggestions(cashDue)

  const hasTableFeature = tableOptions.length > 0 && !!onSelectedTableIdChange
  const hasLoyaltyFeature = !!onLoyaltyPhoneChange
  const hasCollapsibleExtras = hasTableFeature || hasLoyaltyFeature
  const extrasActive =
    Boolean(selectedTableId) ||
    loyaltyPhone.trim().length > 0 ||
    loyaltyRedeemPoints.trim().length > 0
  const [showExtras, setShowExtras] = useState(extrasActive)
  const [showTaxDetail, setShowTaxDetail] = useState(false)
  const promoActive =
    promoInput.trim().length > 0 || discountPct > 0 || Boolean(promoFeedback)

  const displayTotal = payableTotalTTC ?? totals.totalTTC
  const hasLoyaltyDiscount = displayTotal < totals.totalTTC
  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  )

  const activePaymentLabel = payment.mixed
    ? 'Paiement mixte'
    : PAYMENT_METHODS.find((m) => m.id === payment.method)?.label ?? 'Paiement'

  return (
    <aside className="caisse-cart flex h-full min-h-0 w-full min-w-0 shrink-0 flex-col lg:w-[380px] xl:w-[400px]">
      {/* Header compact */}
      <div className="caisse-cart-header flex shrink-0 items-center justify-between gap-2 px-3 py-2 sm:px-3.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le panier"
              className="-ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-amber-600 transition hover:bg-amber-50 hover:text-amber-800"
            >
              <IconChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <IconReceipt className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          )}
          <h2 className="text-[13px] font-semibold tracking-tight text-caisse-ink">
            Panier
          </h2>
          <span
            ref={countBadgeRef}
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-[rgba(184,146,46,0.25)] bg-caisse-gold-soft px-1 text-[10px] font-bold text-caisse-gold transition-transform duration-300 ease-out"
          >
            {count}
          </span>
          {count > 0 ? (
            <span className="caisse-total-display ml-1 truncate font-mono-nums text-[14px]">
              {formatFCFA(displayTotal)}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onCancelTransaction ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancelTransaction}
              disabled={lines.length === 0 || checkoutBusy}
              className="h-7 px-2 text-[11px]"
            >
              Annuler
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={lines.length === 0}
            className="h-7 px-2 text-[11px]"
          >
            Vider
          </Button>
        </div>
      </div>

      {/* Corps unique : articles + options + paiement */}
      <div
        className={cn(
          'caisse-cart-body caisse-cart-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3',
          lines.length === 0 && 'flex flex-col',
        )}
      >
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(184,146,46,0.2)] bg-[linear-gradient(145deg,#fffefb,#f7f0e3)] text-caisse-gold">
              <IconReceipt className="h-6 w-6" />
            </span>
            <p className="text-[14px] font-semibold text-caisse-ink">Panier vide</p>
            <p className="max-w-[220px] text-[12px] leading-relaxed text-caisse-muted">
              Scannez un code-barres ou sélectionnez un article du catalogue.
            </p>
          </div>
        ) : (
            <ul className="flex flex-col gap-1.5">
            {lines.map((line) => {
              const max = stockFor(products, line.productId)
              const product = productById.get(line.productId)
              const atStockLimit = max > 0 && line.qty >= max
              const lineTotal = line.unitPriceTTC * line.qty
              return (
                <li key={line.productId} className="caisse-cart-line px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    {product ? (
                      <ProductImage
                        product={product}
                        className="h-8 w-8 shrink-0 rounded-md border border-[rgba(184,146,46,0.16)] object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[rgba(184,146,46,0.16)] bg-caisse-gold-soft text-[9px] font-bold text-caisse-gold"
                        aria-hidden
                      >
                        {line.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium leading-tight text-caisse-ink">
                        {line.name}
                      </p>
                      <p className="mt-px font-mono-nums text-[10px] text-caisse-muted">
                        {formatFCFA(line.unitPriceTTC)}
                        {atStockLimit ? (
                          <span className="ml-1.5 font-medium text-amber-700">· max {max}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="caisse-qty-control inline-flex shrink-0 items-center gap-0 p-0.5">
                      <button
                        type="button"
                        onClick={() => onDec(line.productId)}
                        className="caisse-qty-btn flex h-6 w-6 items-center justify-center rounded text-rose-600 transition hover:bg-rose-50 active:scale-95"
                        aria-label="Diminuer"
                      >
                        <IconMinus className="h-3 w-3" />
                      </button>
                      <span className="min-w-5 text-center font-mono-nums text-[12px] font-semibold text-caisse-ink">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onInc(line.productId)}
                        disabled={atStockLimit}
                        className="caisse-qty-btn flex h-6 w-6 items-center justify-center rounded text-emerald-600 transition hover:bg-emerald-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Augmenter"
                      >
                        <IconPlus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="caisse-price w-[4.5rem] shrink-0 text-right font-mono-nums text-[12px]">
                      {formatFCFA(lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(line.productId)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Retirer ${line.name}`}
                    >
                      <IconClose className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {lines.length > 0 ? (
        <div className="caisse-cart-recap mt-4 border-t border-[rgba(184,146,46,0.14)] pt-4">
        {hasCollapsibleExtras ? (
          <button
            type="button"
            onClick={() => setShowExtras((open) => !open)}
            className="mb-2 flex w-full items-center justify-between gap-2 rounded-xl border border-[rgba(184,146,46,0.16)] bg-white/80 px-3 py-2 text-left transition hover:border-[rgba(184,146,46,0.3)]"
            aria-expanded={showExtras}
          >
            <span className="text-[12px] font-semibold text-caisse-ink">
              Table & fidélité
            </span>
            <span className="flex items-center gap-1.5">
              {extrasActive && !showExtras ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  Actif
                </span>
              ) : null}
              <IconChevronDown
                className={cn(
                  'h-4 w-4 text-violet-500 transition-transform',
                  showExtras && 'rotate-180',
                )}
              />
            </span>
          </button>
        ) : null}

        {(showExtras || !hasCollapsibleExtras) && (
          <>
        {/* Table */}
        {hasTableFeature ? (
          <div className="mb-2">
            <Field label="Affecter à une table">
              <Select
                value={selectedTableId}
                onChange={(e) => onSelectedTableIdChange(e.target.value)}
              >
                <option value="">Aucune table</option>
                {tableOptions.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                    {table.status ? ` (${table.status})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            {selectedTableIsUnavailable ? (
              <p className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                Encaissement bloqué : la table sélectionnée est occupée ou réservée.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Fidélité */}
        {hasLoyaltyFeature ? (
          <div className="mb-2 grid gap-1.5">
            <Field label="Client fidélité (téléphone)">
              <Input
                value={loyaltyPhone}
                onChange={(e) => onLoyaltyPhoneChange(e.target.value)}
                placeholder="07 00 00 00 00"
              />
            </Field>
            <Field label={`Points à utiliser (solde: ${loyaltyPointsAvailable})`}>
              <Input
                inputMode="numeric"
                value={loyaltyRedeemPoints}
                onChange={(e) => onLoyaltyRedeemPointsChange?.(e.target.value)}
                placeholder="0"
              />
            </Field>
            {loyaltyRedeemAmountTTC > 0 ? (
              <p className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
                Réduction fidélité: {formatFCFA(loyaltyRedeemAmountTTC)}
              </p>
            ) : null}
          </div>
        ) : null}

          </>
        )}

        {/* Promo — toujours visible */}
        <div
          className={cn(
            'rounded-xl border border-[rgba(184,146,46,0.14)] bg-white/70 p-2.5',
            hasCollapsibleExtras ? 'mt-2' : 'mb-0',
          )}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-caisse-muted">
              Code promo
            </p>
            {promoActive ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                {discountPct > 0 ? `−${discountPct} %` : 'Saisi'}
              </span>
            ) : null}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={promoInput}
              onChange={(e) => onPromoInputChange(e.target.value)}
              placeholder="Ex. BIENVENUE10"
              className="min-w-0 flex-1 text-[12px]"
            />
            <Button size="md" variant="secondary" onClick={onApplyPromo} className="shrink-0">
              OK
            </Button>
          </div>
          {promoFeedback ? (
            <p className="mt-1.5 text-[11px] text-zinc-600">{promoFeedback}</p>
          ) : null}
          {discountPct > 0 ? (
            <p className="mt-1 text-[11px] font-medium text-emerald-700">
              Remise panier : {discountPct} %
            </p>
          ) : null}
        </div>

        {/* Totals */}
        <div className="caisse-cart-summary mt-3 rounded-xl border border-[rgba(184,146,46,0.14)] bg-white/75 p-3">
          <button
            type="button"
            onClick={() => setShowTaxDetail((open) => !open)}
            className="flex w-full items-center justify-between gap-2 text-left"
            aria-expanded={showTaxDetail}
          >
            <span className="text-[12px] font-semibold text-caisse-ink">Récapitulatif</span>
            <span className="flex items-center gap-1.5">
              <span className="caisse-price font-mono-nums text-[14px]">
                {formatFCFA(totals.totalTTC)}
              </span>
              <IconChevronDown
                className={cn(
                  'h-4 w-4 text-sky-500 transition-transform',
                  showTaxDetail && 'rotate-180',
                )}
              />
            </span>
          </button>

          {showTaxDetail ? (
            <div className="mt-2 space-y-1 border-t border-[rgba(184,146,46,0.1)] pt-2 text-[12px] text-caisse-muted">
              <div className="flex justify-between">
                <span>Sous-total HT</span>
                <span className="font-mono-nums text-caisse-ink">
                  {formatFCFA(totals.subtotalHT)}
                </span>
              </div>
              {vatSlices.map((s) => (
                <div key={s.ratePct} className="flex justify-between">
                  <span>TVA {s.ratePct} %</span>
                  <span className="font-mono-nums text-caisse-ink">{formatFCFA(s.tva)}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex items-baseline justify-between border-t border-[rgba(184,146,46,0.12)] pt-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-caisse-muted">
              Total TTC
            </span>
            <span className="caisse-total-display font-mono-nums text-[15px]">
              {formatFCFA(totals.totalTTC)}
            </span>
          </div>

          {loyaltyRedeemAmountTTC > 0 ? (
            <div className="mt-1 flex justify-between text-[12px] text-emerald-700">
              <span>Fidélité</span>
              <span className="font-mono-nums">− {formatFCFA(loyaltyRedeemAmountTTC)}</span>
            </div>
          ) : null}

          {hasLoyaltyDiscount ? (
            <div className="mt-1 flex items-baseline justify-between rounded-lg bg-emerald-50/80 px-2 py-1.5">
              <span className="text-[12px] font-semibold text-emerald-800">À payer</span>
              <span className="font-mono-nums text-[16px] font-bold text-emerald-800">
                {formatFCFA(displayTotal)}
              </span>
            </div>
          ) : null}
        </div>

        {/* Payment */}
        <div className="caisse-cart-payment mt-4 rounded-xl border border-[rgba(184,146,46,0.14)] bg-white/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="ui-eyebrow">Paiement</p>
            <Switch
              label="Mixte"
              checked={payment.mixed}
              onChange={(e) => {
                const mixed = e.target.checked
                if (mixed) {
                  onPaymentPatch({
                    mixed: true,
                    splitCash: String(totalRounded),
                    splitCard: '0',
                    splitMobile: '0',
                  })
                } else {
                  onPaymentPatch({ mixed: false })
                }
              }}
            />
          </div>

          {!canPayElectronic && !payment.mixed ? (
            <p className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              Hors ligne : espèces uniquement.
            </p>
          ) : null}

          {!payment.mixed ? (
            <div
              className="grid grid-cols-3 gap-1.5"
              role="group"
              aria-label="Mode de paiement"
            >
              {PAYMENT_METHODS.map(({ id, label, Icon, iconClass, activeClass }) => {
                const disabled =
                  (id === 'card' || id === 'mobile') && !canPayElectronic
                const active = payment.method === id
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (id === 'cash') {
                        onPaymentPatch({
                          method: 'cash',
                          cashReceived:
                            payment.cashReceived.trim() === ''
                              ? String(totalRounded)
                              : payment.cashReceived,
                        })
                      } else if (canPayElectronic) {
                        onPaymentPatch({ method: id })
                      }
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition',
                      active
                        ? activeClass
                        : 'border-[rgba(184,146,46,0.2)] bg-white text-[#5c6678] hover:border-[rgba(184,146,46,0.35)]',
                      disabled && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', iconClass)} />
                    {label}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-2">
              <p className="text-[11px] text-zinc-500">
                Répartition (somme = {formatFCFA(totalRounded)})
              </p>
              <Field label="Espèces (FCFA)">
                <Input
                  inputMode="numeric"
                  value={payment.splitCash}
                  onChange={(e) =>
                    onPaymentPatch({ splitCash: e.target.value })
                  }
                  className="font-mono-nums"
                />
              </Field>
              <Field label="Carte TPE (FCFA)">
                <Input
                  inputMode="numeric"
                  value={payment.splitCard}
                  onChange={(e) =>
                    onPaymentPatch({ splitCard: e.target.value })
                  }
                  className="font-mono-nums"
                />
              </Field>
              <Field label="Mobile money (FCFA)">
                <Input
                  inputMode="numeric"
                  value={payment.splitMobile}
                  onChange={(e) =>
                    onPaymentPatch({ splitMobile: e.target.value })
                  }
                  className="font-mono-nums"
                />
              </Field>
            </div>
          )}

          {showMobileOperators ? (
            <div className="mt-3">
              <p className="mb-1 text-[11px] font-medium text-zinc-500">
                Opérateur mobile
              </p>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['orange', MOBILE_OPERATOR_LABELS.orange],
                    ['mtn', MOBILE_OPERATOR_LABELS.mtn],
                    ['wave', MOBILE_OPERATOR_LABELS.wave],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      onPaymentPatch({
                        mobileOperator: id as MobileMoneyOperator,
                      })
                    }
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                      payment.mobileOperator === id
                        ? 'caisse-operator-active'
                        : 'border-[rgba(184,146,46,0.2)] bg-white text-[#5c6678] hover:border-[rgba(184,146,46,0.35)]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!payment.mixed && payment.method === 'cash' ? (
            <div className="mt-3 space-y-1">
              <Field label="Montant reçu (FCFA)">
                <Input
                  inputMode="numeric"
                  value={payment.cashReceived}
                  onChange={(e) =>
                    onPaymentPatch({ cashReceived: e.target.value })
                  }
                  placeholder={String(totalRounded)}
                  className="font-mono-nums"
                />
              </Field>
              {quickAmounts.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {quickAmounts.map((value) => (
                    <button
                      key={`quick-cash-${value}`}
                      type="button"
                      onClick={() => onPaymentPatch({ cashReceived: String(value) })}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-[11px] font-mono-nums font-semibold transition',
                        payment.cashReceived.replace(/\s/g, '') === String(value)
                          ? 'caisse-operator-active'
                          : 'border-[rgba(184,146,46,0.2)] bg-white text-[#5c6678] hover:border-[rgba(184,146,46,0.35)]',
                      )}
                    >
                      {formatFCFA(value)}
                    </button>
                  ))}
                </div>
              ) : null}
              {changePreview !== null ? (
                <p className="rounded-md bg-emerald-50 px-2 py-1 text-[12px] font-semibold text-emerald-800">
                  Monnaie à rendre :{' '}
                  <span className="font-mono-nums">
                    {formatFCFA(changePreview)}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {payment.mixed && cashSplit > 0 ? (
            <div className="mt-3 space-y-1">
              <Field label="Reçu en espèces (FCFA)">
                <Input
                  inputMode="numeric"
                  value={payment.cashReceived}
                  onChange={(e) =>
                    onPaymentPatch({ cashReceived: e.target.value })
                  }
                  className="font-mono-nums"
                />
              </Field>
              {quickAmounts.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {quickAmounts.map((value) => (
                    <button
                      key={`quick-mixed-cash-${value}`}
                      type="button"
                      onClick={() => onPaymentPatch({ cashReceived: String(value) })}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-[11px] font-mono-nums font-semibold transition',
                        payment.cashReceived.replace(/\s/g, '') === String(value)
                          ? 'caisse-operator-active'
                          : 'border-[rgba(184,146,46,0.2)] bg-white text-[#5c6678] hover:border-[rgba(184,146,46,0.35)]',
                      )}
                    >
                      {formatFCFA(value)}
                    </button>
                  ))}
                </div>
              ) : null}
              {changePreview !== null ? (
                <p className="rounded-md bg-emerald-50 px-2 py-1 text-[12px] font-semibold text-emerald-800">
                  Monnaie à rendre :{' '}
                  <span className="font-mono-nums">
                    {formatFCFA(changePreview)}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {(!payment.mixed && payment.method === 'card') ||
          (payment.mixed && cardSplit > 0) ? (
            <Field label="Réf. TPE (optionnel)" className="mt-3">
              <Input
                value={payment.cardRef}
                onChange={(e) => onPaymentPatch({ cardRef: e.target.value })}
                placeholder="Auto si vide"
                className="font-mono text-[11px]"
              />
            </Field>
          ) : null}

          {(!payment.mixed && payment.method === 'mobile') ||
          (payment.mixed && mobileSplit > 0) ? (
            <Field label="Réf. transaction mobile (optionnel)" className="mt-3">
              <Input
                value={payment.mobileRef}
                onChange={(e) => onPaymentPatch({ mobileRef: e.target.value })}
                placeholder="Auto si vide"
                className="font-mono text-[11px]"
              />
            </Field>
          ) : null}

          {!validation.ok && lines.length > 0 ? (
            <p className="mt-2 text-[11px] text-rose-700">
              {validation.message}
            </p>
          ) : null}
        </div>
        </div>
        ) : null}
      </div>

      {/* Encaissement compact */}
      <div className="caisse-cart-checkout shrink-0 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        {(changePreview !== null && changePreview > 0) || lines.length > 0 ? (
          <div className="mb-1.5 flex min-h-0 items-center justify-between gap-2 text-[11px]">
            {changePreview !== null && changePreview > 0 ? (
              <span className="caisse-cart-change inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                Monnaie
                <span className="font-mono-nums">{formatFCFA(changePreview)}</span>
              </span>
            ) : lines.length > 0 ? (
              <span className="text-caisse-muted">{activePaymentLabel}</span>
            ) : (
              <span />
            )}
            {lines.length > 0 ? (
              <span className="font-mono-nums font-semibold text-caisse-ink">
                {formatFCFA(totalRounded)}
              </span>
            ) : null}
          </div>
        ) : null}

        <Button
          variant="accent"
          size="md"
          fullWidth
          loading={checkoutBusy}
          onClick={onCheckout}
          disabled={checkoutDisabled}
          className="caisse-checkout-btn h-10"
        >
          {checkoutBusy ? 'Traitement…' : `Encaisser · ${formatFCFA(totalRounded)}`}
        </Button>
        {lines.length > 0 && checkoutDisabled && !checkoutBusy && !validation.ok && validation.message ? (
          <p className="mt-1 text-center text-[10px] text-rose-700">{validation.message}</p>
        ) : null}
        {dayClosed ? (
          <p className="mt-1 rounded-md bg-amber-50 px-2 py-0.5 text-center text-[10px] font-medium text-amber-800">
            {dayClosedLabel ??
              'Journée clôturée : encaissement bloqué. Réouvrez la journée depuis le journal.'}
          </p>
        ) : null}
      </div>
    </aside>
  )
}
