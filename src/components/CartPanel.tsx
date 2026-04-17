import type { Ref } from 'react'
import type { CartLine, MobileMoneyOperator } from '../db/types'
import type { CheckoutPaymentState } from '../lib/checkoutPayment'
import { validateCheckoutPayment } from '../lib/checkoutPayment'
import {
  formatFCFA,
  totalsFromLinesTTC,
  vatSlicesFromLinesTTC,
} from '../lib/money'
import { MOBILE_OPERATOR_LABELS } from '../lib/paymentDisplay'
import { Button, IconButton } from '../ui/Button'
import { Field, Input } from '../ui/Input'
import { Switch } from '../ui/Switch'
import { Tabs } from '../ui/Tabs'
import { cn } from '../ui/cn'
import {
  IconCard,
  IconCash,
  IconChevronRight,
  IconClose,
  IconMinus,
  IconMobile,
  IconPlus,
  IconReceipt,
} from '../ui/icons'

type Props = {
  lines: CartLine[]
  products: { id: string; stock: number }[]
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
}

function stockFor(
  products: { id: string; stock: number }[],
  productId: string,
): number {
  return products.find((p) => p.id === productId)?.stock ?? 0
}

export function CartPanel({
  lines,
  products,
  discountPct,
  // Conservé dans Props pour stabilité de l'API ; non affiché ici.
  maxDiscountPct: _maxDiscountPct,
  promoInput,
  onPromoInputChange,
  onApplyPromo,
  promoFeedback,
  payment,
  onPaymentPatch,
  online,
  onInc,
  onDec,
  onRemove,
  onClear,
  onCancelTransaction,
  onCheckout,
  checkoutBusy,
  onClose,
  countBadgeRef,
}: Props) {
  const totals = totalsFromLinesTTC(lines, discountPct)
  const vatSlices = vatSlicesFromLinesTTC(lines, discountPct)
  const count = lines.reduce((s, l) => s + l.qty, 0)
  const canPayElectronic = online
  const totalRounded = Math.round(totals.totalTTC)
  const validation = validateCheckoutPayment(payment, totalRounded, online)
  const checkoutDisabled =
    lines.length === 0 || checkoutBusy || !validation.ok

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

  return (
    <aside className="flex h-full w-full min-w-0 shrink-0 flex-col border-l border-zinc-200 bg-white lg:w-[360px]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le panier"
              className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <IconReceipt className="h-4 w-4 text-zinc-400" />
          )}
          <h2 className="text-[14px] font-semibold text-zinc-900">Panier</h2>
          <span
            ref={countBadgeRef}
            className="inline-block text-[12px] text-zinc-500 transition-transform duration-300 ease-out"
          >
            ({count})
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onCancelTransaction ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancelTransaction}
              disabled={lines.length === 0 || checkoutBusy}
            >
              Annuler
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={lines.length === 0}
          >
            Vider
          </Button>
        </div>
      </div>

      {/* Lines */}
      <div className="ui-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <IconReceipt className="h-5 w-5" />
            </span>
            <p className="text-[13px] font-semibold text-zinc-700">
              Panier vide
            </p>
            <p className="text-[12px] text-zinc-500">
              Scannez ou cliquez un article pour commencer.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {lines.map((line) => {
              const max = stockFor(products, line.productId)
              return (
                <li
                  key={line.productId}
                  className="rounded-lg border border-zinc-200 bg-white p-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-zinc-900">
                        {line.name}
                      </p>
                      <p className="mt-0.5 font-mono-nums text-[11px] text-zinc-500">
                        {formatFCFA(line.unitPriceTTC)} l’unité
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(line.productId)}
                      className="rounded p-1 text-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-700"
                      aria-label={`Retirer ${line.name}`}
                    >
                      <IconClose className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center gap-1 rounded-md border border-zinc-200">
                      <button
                        type="button"
                        onClick={() => onDec(line.productId)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-50"
                        aria-label="Diminuer"
                      >
                        <IconMinus className="h-3 w-3" />
                      </button>
                      <span className="min-w-[1.5rem] text-center font-mono-nums text-[12px] font-semibold text-zinc-900">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onInc(line.productId)}
                        disabled={line.qty >= max}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Augmenter"
                      >
                        <IconPlus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="font-mono-nums text-[13px] font-semibold text-zinc-900">
                      {formatFCFA(line.unitPriceTTC * line.qty)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer (sticky) */}
      <div className="border-t border-zinc-100 bg-zinc-50/40 px-4 py-3">
        {/* Promo */}
        <div className="flex gap-1.5">
          <Input
            value={promoInput}
            onChange={(e) => onPromoInputChange(e.target.value)}
            placeholder="Code promo"
            className="text-[12px]"
          />
          <Button size="md" variant="secondary" onClick={onApplyPromo}>
            OK
          </Button>
        </div>
        {promoFeedback ? (
          <p className="mt-1 text-[11px] text-zinc-600">{promoFeedback}</p>
        ) : null}
        {discountPct > 0 ? (
          <p className="mt-1 text-[11px] font-medium text-emerald-700">
            Remise panier : {discountPct} %
          </p>
        ) : null}

        {/* Totals */}
        <div className="mt-3 space-y-1 border-t border-zinc-200/80 pt-3 text-[12px] text-zinc-600">
          <div className="flex justify-between">
            <span>Sous-total HT</span>
            <span className="font-mono-nums">
              {formatFCFA(totals.subtotalHT)}
            </span>
          </div>
          {vatSlices.map((s) => (
            <div key={s.ratePct} className="flex justify-between">
              <span>TVA {s.ratePct} %</span>
              <span className="font-mono-nums">{formatFCFA(s.tva)}</span>
            </div>
          ))}
          <div className="mt-1 flex items-baseline justify-between border-t border-zinc-200/80 pt-2">
            <span className="text-[12px] font-medium text-zinc-700">
              Total TTC
            </span>
            <span className="font-mono-nums text-[18px] font-bold text-zinc-900">
              {formatFCFA(totals.totalTTC)}
            </span>
          </div>
        </div>

        {/* Payment */}
        <div className="mt-4">
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
            <Tabs
              variant="segmented"
              items={[
                {
                  id: 'cash' as const,
                  label: 'Espèces',
                  icon: <IconCash />,
                },
                {
                  id: 'card' as const,
                  label: 'Carte',
                  icon: <IconCard />,
                },
                {
                  id: 'mobile' as const,
                  label: 'Mobile',
                  icon: <IconMobile />,
                },
              ]}
              active={payment.method}
              onChange={(id) => {
                if (id === 'cash') {
                  onPaymentPatch({
                    method: 'cash',
                    cashReceived:
                      payment.cashReceived.trim() === ''
                        ? String(totalRounded)
                        : payment.cashReceived,
                  })
                } else if (
                  (id === 'card' || id === 'mobile') &&
                  canPayElectronic
                ) {
                  onPaymentPatch({ method: id })
                }
              }}
              className="w-full [&>*]:flex-1"
            />
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
                      'rounded-md border px-2 py-1 text-[11px] font-semibold transition',
                      payment.mobileOperator === id
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
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

        <Button
          variant="accent"
          size="lg"
          fullWidth
          loading={checkoutBusy}
          onClick={onCheckout}
          disabled={checkoutDisabled}
          className="mt-4"
        >
          {checkoutBusy ? 'Traitement…' : `Encaisser · ${formatFCFA(totalRounded)}`}
        </Button>
        <p className="mt-1.5 text-center text-[10px] text-zinc-400">
          Reçu généré et imprimé automatiquement
        </p>
      </div>

      {/* Suppress unused warning if IconButton isn't used (keep import) */}
      <span className="hidden">
        <IconButton aria-label="reserved" />
      </span>
    </aside>
  )
}
