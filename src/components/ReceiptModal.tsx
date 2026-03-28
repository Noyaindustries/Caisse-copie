import { useEffect } from 'react'
import type { Sale } from '../db/types'
import { formatFCFA, vatSlicesFromLinesTTC } from '../lib/money'
import {
  paymentMethodShortLabel,
  salePaymentAmounts,
} from '../lib/paymentDisplay'
import { saleNetTTC } from '../lib/refundMath'
import { SESSION_ID } from '../lib/session'

type Props = {
  sale: Sale
  /** Si true (ex. après encaissement), lance l’impression dès que le reçu est affiché. */
  autoPrint?: boolean
  onClose: () => void
}

export function ReceiptModal({ sale, autoPrint = false, onClose }: Props) {
  useEffect(() => {
    if (!autoPrint) return
    const id = window.setTimeout(() => {
      window.print()
    }, 150)
    return () => clearTimeout(id)
  }, [autoPrint, sale.id])

  const dt = new Date(sale.createdAt)
  const amt = salePaymentAmounts(sale)
  const vatSlices = vatSlicesFromLinesTTC(sale.lines, sale.discountPct)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 id="receipt-title" className="text-sm font-semibold text-slate-900">
            Reçu de vente
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Imprimer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Fermer
            </button>
          </div>
        </div>

        <div
          id="print-receipt"
          className="space-y-4 p-6 font-display text-slate-800"
        >
          <header className="border-b border-dashed border-slate-300 pb-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">
              CaisseCI
            </p>
            <p className="mt-1 text-xs text-slate-500">Ticket de caisse</p>
            <p className="mt-2 font-mono-nums text-xs text-slate-600">
              N° {sale.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="mt-1 font-mono-nums text-xs text-slate-600">
              {dt.toLocaleString('fr-FR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Session #{SESSION_ID}
            </p>
            {sale.cashierDisplayName ? (
              <p className="mt-2 text-xs text-slate-600">
                Caissier :{' '}
                <span className="font-medium text-slate-800">
                  {sale.cashierDisplayName}
                </span>
              </p>
            ) : null}
            {sale.storeName ? (
              <p className="mt-1 text-xs text-slate-600">
                Point de vente :{' '}
                <span className="font-medium text-slate-800">
                  {sale.storeName}
                </span>
              </p>
            ) : null}
          </header>

          <ul className="space-y-2 text-sm">
            {sale.lines.map((line) => (
              <li
                key={`${line.productId}-${line.name}`}
                className="flex justify-between gap-2 border-b border-slate-100 pb-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{line.name}</span>
                  <span className="block font-mono-nums text-xs text-slate-500">
                    {formatFCFA(line.unitPriceTTC)} × {line.qty}
                  </span>
                </span>
                <span className="shrink-0 font-mono-nums font-semibold">
                  {formatFCFA(line.unitPriceTTC * line.qty)}
                </span>
              </li>
            ))}
          </ul>

          {sale.discountPct > 0 ? (
            <p className="text-xs text-emerald-700">
              Remise appliquée : {sale.discountPct} %
            </p>
          ) : null}

          {(sale.refundsTotalTTC ?? 0) > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <p className="font-semibold">Remboursements (audit)</p>
              <p className="mt-1 font-mono-nums">
                Déjà remboursé : {formatFCFA(sale.refundsTotalTTC ?? 0)} · CA
                net ticket : {formatFCFA(saleNetTTC(sale))}
              </p>
            </div>
          ) : null}

          <div className="space-y-1 border-t border-dashed border-slate-300 pt-3 font-mono-nums text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Sous-total HT</span>
              <span>{formatFCFA(sale.subtotalHT)}</span>
            </div>
            {vatSlices.map((s) => (
              <div
                key={s.ratePct}
                className="flex justify-between text-slate-600"
              >
                <span>TVA {s.ratePct} %</span>
                <span>{formatFCFA(s.tva)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Total TTC</span>
              <span className="text-emerald-700">
                {formatFCFA(sale.totalTTC)}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              Paiement
            </p>
            <p className="mt-2 text-center font-semibold text-slate-900">
              {paymentMethodShortLabel(sale.paymentMethod)}
            </p>
            <ul className="mt-3 space-y-1.5 font-mono-nums text-slate-700">
              {amt.cash > 0 ? (
                <li className="flex justify-between gap-2">
                  <span>Espèces</span>
                  <span>{formatFCFA(amt.cash)}</span>
                </li>
              ) : null}
              {amt.card > 0 ? (
                <li className="flex justify-between gap-2">
                  <span>Carte (TPE)</span>
                  <span>{formatFCFA(amt.card)}</span>
                </li>
              ) : null}
              {amt.mobile > 0 ? (
                <li className="flex justify-between gap-2">
                  <span>Mobile money</span>
                  <span>{formatFCFA(amt.mobile)}</span>
                </li>
              ) : null}
            </ul>
            {sale.cashReceived != null ? (
              <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-600">
                Montant reçu : {formatFCFA(sale.cashReceived)}
              </p>
            ) : null}
            {sale.changeDue != null && sale.changeDue > 0 ? (
              <p className="mt-1 text-sm font-bold text-emerald-800">
                Monnaie à rendre : {formatFCFA(sale.changeDue)}
              </p>
            ) : null}
            {sale.cardTpeReference ? (
              <p className="mt-2 font-mono text-[11px] text-slate-500">
                Réf. TPE : {sale.cardTpeReference}
              </p>
            ) : null}
            {sale.mobileMoneyReference ? (
              <p className="mt-1 font-mono text-[11px] text-slate-500">
                Réf. mobile : {sale.mobileMoneyReference}
              </p>
            ) : null}
            <p className="mt-3 text-center text-[11px] text-slate-400">
              Reçu émis immédiatement après confirmation
            </p>
          </div>

          <footer className="pt-2 text-center text-[10px] text-slate-400">
            Merci de votre achat · Document non fiscal (démo locale)
          </footer>
        </div>
      </div>
    </div>
  )
}
