import type { CartLine, MobileMoneyOperator } from '../db/types'
import type { CheckoutPaymentState } from '../lib/checkoutPayment'
import { validateCheckoutPayment } from '../lib/checkoutPayment'
import {
  formatFCFA,
  totalsFromLinesTTC,
  vatSlicesFromLinesTTC,
} from '../lib/money'
import { MOBILE_OPERATOR_LABELS } from '../lib/paymentDisplay'

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
  maxDiscountPct,
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
}: Props) {
  const totals = totalsFromLinesTTC(lines, discountPct)
  const vatSlices = vatSlicesFromLinesTTC(lines, discountPct)
  const count = lines.reduce((s, l) => s + l.qty, 0)
  const canPayElectronic = online
  const totalRounded = Math.round(totals.totalTTC)
  const validation = validateCheckoutPayment(
    payment,
    totalRounded,
    online,
  )
  const checkoutDisabled =
    lines.length === 0 || checkoutBusy || !validation.ok

  const showMobileOperators =
    (!payment.mixed && payment.method === 'mobile') || payment.mixed

  const changePreview =
    validation.ok && validation.changeDue != null
      ? validation.changeDue
      : null

  return (
    <aside className="flex w-full min-w-0 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-slate-50/80 lg:w-68">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
        <h2 className="text-base font-semibold text-slate-900">
          Panier / commande{' '}
          <span className="font-normal text-slate-500">({count})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {onCancelTransaction ? (
            <button
              type="button"
              onClick={onCancelTransaction}
              disabled={lines.length === 0 || checkoutBusy}
              className="text-xs font-medium text-amber-800 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Annuler transaction
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClear}
            disabled={lines.length === 0}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Vider
          </button>
        </div>
      </div>

      <div className="px-3 py-2.5">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
            <span className="mb-2 text-4xl opacity-40" aria-hidden>
              🛒
            </span>
            <p className="text-sm">Aucune ligne — scan, recherche ou catalogue</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {lines.map((line) => {
              const max = stockFor(products, line.productId)
              return (
                <li
                  key={line.productId}
                  className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm"
                >
                  <div className="flex justify-between gap-2">
                    <p className="min-w-0 flex-1 text-[13px] font-medium text-slate-900">
                      {line.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => onRemove(line.productId)}
                      className="shrink-0 text-xs text-slate-400 hover:text-red-600"
                      aria-label={`Retirer ${line.name}`}
                    >
                      ✕
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                    {formatFCFA(line.unitPriceTTC)}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDec(line.productId)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-base leading-none hover:bg-slate-100"
                      aria-label="Diminuer"
                    >
                      −
                    </button>
                    <span className="min-w-7 text-center text-xs font-medium">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onInc(line.productId)}
                      disabled={line.qty >= max}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-base leading-none hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Augmenter"
                    >
                      +
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Promotion
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={promoInput}
            onChange={(e) => onPromoInputChange(e.target.value)}
            placeholder="Code promo…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
          />
          <button
            type="button"
            onClick={onApplyPromo}
            className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Appliquer
          </button>
        </div>
        {promoFeedback ? (
          <p className="mt-1.5 text-xs text-slate-600">{promoFeedback}</p>
        ) : null}
        {maxDiscountPct < 100 ? (
          <p className="mt-1 text-[11px] text-slate-500">
            Remise max. autorisée :{' '}
            <strong className="text-slate-700">{maxDiscountPct} %</strong>
            {maxDiscountPct <= 0 ? ' (aucune)' : ''} — codes PROMO5 / PROMO10
          </p>
        ) : null}
        {discountPct > 0 ? (
          <p className="mt-1 text-xs text-emerald-700">
            Remise panier : {discountPct} %
          </p>
        ) : null}

        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Sous-total HT</span>
            <span className="font-mono-nums">{formatFCFA(totals.subtotalHT)}</span>
          </div>
          {vatSlices.map((s) => (
            <div
              key={s.ratePct}
              className="flex justify-between text-slate-600"
            >
              <span>TVA {s.ratePct} %</span>
              <span className="font-mono-nums">{formatFCFA(s.tva)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
            <span>Total TTC</span>
            <span className="font-mono-nums text-emerald-600">
              {formatFCFA(totals.totalTTC)}
            </span>
          </div>
        </div>

        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Paiement multi-modes
        </p>

        <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
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
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>Paiement mixte (espèces + carte et/ou mobile)</span>
        </label>
        {!canPayElectronic && !payment.mixed ? (
          <p className="mb-2 text-[11px] text-amber-800">
            Hors ligne : espèces uniquement. Réseau requis pour carte ou mobile.
          </p>
        ) : null}

        {!payment.mixed ? (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() =>
                onPaymentPatch({
                  method: 'cash',
                  cashReceived:
                    payment.cashReceived.trim() === ''
                      ? String(totalRounded)
                      : payment.cashReceived,
                })
              }
              className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-1.5 py-2.5 text-[11px] font-medium leading-tight transition sm:gap-1 sm:px-2 sm:py-3 sm:text-xs ${
                payment.method === 'cash'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <span aria-hidden>💵</span>
              Espèces
            </button>
            <button
              type="button"
              title={
                canPayElectronic
                  ? undefined
                  : 'Connexion requise pour la carte'
              }
              disabled={!canPayElectronic}
              onClick={() => onPaymentPatch({ method: 'card' })}
              className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-1.5 py-2.5 text-[11px] font-medium leading-tight transition sm:gap-1 sm:px-2 sm:py-3 sm:text-xs ${
                payment.method === 'card'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              } disabled:cursor-not-allowed disabled:opacity-45`}
            >
              <span aria-hidden>💳</span>
              <span className="text-center leading-tight">Carte (TPE)</span>
            </button>
            <button
              type="button"
              title={
                canPayElectronic
                  ? undefined
                  : 'Connexion requise pour le mobile money'
              }
              disabled={!canPayElectronic}
              onClick={() => onPaymentPatch({ method: 'mobile' })}
              className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-1.5 py-2.5 text-[11px] font-medium leading-tight transition sm:gap-1 sm:px-2 sm:py-3 sm:text-xs ${
                payment.method === 'mobile'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              } disabled:cursor-not-allowed disabled:opacity-45`}
            >
              <span aria-hidden>📱</span>
              <span className="text-center leading-tight">Mobile money</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
            <p className="font-medium text-slate-700">
              Répartition (somme = {formatFCFA(totalRounded)})
            </p>
            <label className="block text-slate-600">
              Espèces (FCFA)
              <input
                inputMode="numeric"
                value={payment.splitCash}
                onChange={(e) =>
                  onPaymentPatch({ splitCash: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono-nums"
              />
            </label>
            <label className="block text-slate-600">
              Carte TPE (FCFA)
              <input
                inputMode="numeric"
                value={payment.splitCard}
                onChange={(e) =>
                  onPaymentPatch({ splitCard: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono-nums"
              />
            </label>
            <label className="block text-slate-600">
              Mobile money (FCFA)
              <input
                inputMode="numeric"
                value={payment.splitMobile}
                onChange={(e) =>
                  onPaymentPatch({ splitMobile: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono-nums"
              />
            </label>
          </div>
        )}

        {showMobileOperators ? (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-medium text-slate-500">
              Opérateur mobile
            </p>
            <div className="flex flex-wrap gap-1.5">
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
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    payment.mobileOperator === id
                      ? 'border-orange-500 bg-orange-50 text-orange-950'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!payment.mixed && payment.method === 'cash' ? (
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-medium text-slate-600">
              Montant reçu (FCFA)
              <input
                inputMode="numeric"
                value={payment.cashReceived}
                onChange={(e) =>
                  onPaymentPatch({ cashReceived: e.target.value })
                }
                placeholder={String(totalRounded)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-nums text-sm"
              />
            </label>
            {changePreview !== null ? (
              <p className="text-sm font-semibold text-emerald-800">
                Monnaie à rendre : {formatFCFA(changePreview)}
              </p>
            ) : null}
          </div>
        ) : null}

        {payment.mixed ? (
          <div className="mt-3 space-y-2">
            {(() => {
              const c = Number.parseInt(
                payment.splitCash.replace(/\s/g, '') || '0',
                10,
              )
              const cashPart =
                Number.isFinite(c) && c >= 0 ? c : 0
              if (cashPart <= 0) return null
              return (
                <>
                  <label className="block text-xs font-medium text-slate-600">
                    Montant reçu en espèces (FCFA)
                    <input
                      inputMode="numeric"
                      value={payment.cashReceived}
                      onChange={(e) =>
                        onPaymentPatch({ cashReceived: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-nums text-sm"
                    />
                  </label>
                  {changePreview !== null ? (
                    <p className="text-sm font-semibold text-emerald-800">
                      Monnaie à rendre : {formatFCFA(changePreview)}
                    </p>
                  ) : null}
                </>
              )
            })()}
          </div>
        ) : null}

        {!payment.mixed && payment.method === 'card' ? (
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Réf. TPE (optionnel — générée si vide)
            <input
              value={payment.cardRef}
              onChange={(e) => onPaymentPatch({ cardRef: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
              placeholder="Auto après validation"
            />
          </label>
        ) : null}

        {payment.mixed &&
        Number.parseInt(payment.splitCard.replace(/\s/g, '') || '0', 10) >
          0 ? (
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Réf. TPE carte (optionnel)
            <input
              value={payment.cardRef}
              onChange={(e) => onPaymentPatch({ cardRef: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
            />
          </label>
        ) : null}

        {(!payment.mixed && payment.method === 'mobile') ||
        (payment.mixed &&
          Number.parseInt(payment.splitMobile.replace(/\s/g, '') || '0', 10) >
            0) ? (
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Réf. transaction mobile (optionnel)
            <input
              value={payment.mobileRef}
              onChange={(e) => onPaymentPatch({ mobileRef: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
              placeholder="Auto après validation"
            />
          </label>
        ) : null}

        {!validation.ok && lines.length > 0 ? (
          <p className="mt-2 text-xs text-amber-800">{validation.message}</p>
        ) : null}

        <button
          type="button"
          onClick={onCheckout}
          disabled={checkoutDisabled}
          className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {checkoutBusy
            ? 'Traitement…'
            : 'Confirmer et encaisser (reçu immédiat)'}
        </button>
      </div>
    </aside>
  )
}
