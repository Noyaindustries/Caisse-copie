import { useEffect, useMemo } from 'react'
import type { OnlineOrder, Sale } from '../db/types'
import { formatFCFA, vatSlicesFromLinesTTC } from '../lib/money'
import {
  paymentMethodShortLabel,
  salePaymentAmounts,
} from '../lib/paymentDisplay'
import { saleNetTTC } from '../lib/refundMath'
import { SESSION_ID } from '../lib/session'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { IconPrinter } from '../ui/icons'

export type ReceiptModalSource =
  | { kind: 'sale'; sale: Sale }
  | { kind: 'onlineOrder'; order: OnlineOrder }

type Props = {
  source: ReceiptModalSource
  autoPrint?: boolean
  onClose: () => void
}

function syntheticSaleFromOnlineOrder(order: OnlineOrder): Sale {
  return {
    id: order.id,
    createdAt: order.createdAt,
    lines: order.lines,
    subtotalHT: order.subtotalHT,
    tva: order.tva,
    totalTTC: order.totalTTC,
    discountPct: order.discountPct ?? 0,
    paymentMethod: order.paymentMethod,
    synced: false,
    storeId: order.storeId,
    storeName: order.storeName,
  }
}

function onlineOrderPaymentCaption(method: OnlineOrder['paymentMethod']): string {
  switch (method) {
    case 'cash':
      return 'Espèces à la livraison / au retrait'
    case 'card':
      return 'Carte bancaire'
    case 'mobile':
      return 'Mobile money'
    default:
      return 'Paiement mixte'
  }
}

function onlineOrderStatusLabel(status: OnlineOrder['status']): string {
  switch (status) {
    case 'pending':
      return 'En attente de validation'
    case 'approved':
      return 'Validée'
    case 'rejected':
      return 'Rejetée'
  }
}

export function ReceiptModal({ source, autoPrint = false, onClose }: Props) {
  const isOnline = source.kind === 'onlineOrder'
  const order = isOnline ? source.order : null
  const sale = useMemo(
    () =>
      source.kind === 'sale' ? source.sale : syntheticSaleFromOnlineOrder(source.order),
    [source],
  )

  const receiptKey = source.kind === 'sale' ? source.sale.id : source.order.id

  useEffect(() => {
    if (!autoPrint) return
    const id = window.setTimeout(() => {
      window.print()
    }, 150)
    return () => clearTimeout(id)
  }, [autoPrint, receiptKey])

  const dt = new Date(sale.createdAt)
  const amt = salePaymentAmounts(sale)
  const vatSlices = vatSlicesFromLinesTTC(sale.lines, sale.discountPct)

  const modalTitle = isOnline ? 'Reçu commande en ligne' : 'Reçu de vente'
  const tagline = isOnline
    ? 'Digitalpro Solutions · Commande web'
    : 'Digitalpro Solutions · Ticket de caisse'

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={modalTitle}
      subtitle={`Réf. ${sale.id.slice(0, 8).toUpperCase()}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="primary"
            iconLeft={<IconPrinter />}
            onClick={() => window.print()}
          >
            Imprimer
          </Button>
        </>
      }
    >
      <div id="print-receipt" className="space-y-4 text-zinc-800">
        <header className="border-b border-dashed border-zinc-200 pb-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-700">
            {tagline}
          </p>
          <p className="mt-1.5 font-mono-nums text-[12px] text-zinc-500">
            {dt.toLocaleString('fr-FR', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
          <p className="mt-1 font-mono-nums text-[10px] text-zinc-500">
            Session #{SESSION_ID}
          </p>
          {order ? (
            <div className="mt-2 space-y-1 rounded-lg bg-zinc-50 px-2 py-2 text-[11px] text-zinc-700">
              <p>
                <span className="text-zinc-500">Client :</span>{' '}
                <span className="font-semibold text-zinc-900">{order.customerName}</span>
              </p>
              {order.customerPhone ? (
                <p>
                  <span className="text-zinc-500">Tél. :</span> {order.customerPhone}
                </p>
              ) : null}
              {order.customerAddress ? (
                <p>
                  <span className="text-zinc-500">Adresse :</span> {order.customerAddress}
                </p>
              ) : null}
              <p className="text-zinc-600">
                {order.fulfillmentMode === 'delivery' ? 'Livraison' : 'Retrait boutique'}
                {' · '}
                <span className="font-medium">{onlineOrderStatusLabel(order.status)}</span>
              </p>
            </div>
          ) : null}
          {sale.cashierDisplayName ? (
            <p className="mt-1 text-[11px] text-zinc-600">
              Caissier :{' '}
              <span className="font-semibold text-zinc-800">
                {sale.cashierDisplayName}
              </span>
            </p>
          ) : null}
          {sale.storeName ? (
            <p className="text-[11px] text-zinc-600">
              Point de vente :{' '}
              <span className="font-semibold text-zinc-800">
                {sale.storeName}
              </span>
            </p>
          ) : null}
        </header>

        <ul className="space-y-2 text-[13px]">
          {sale.lines.map((line) => (
            <li
              key={`${line.productId}-${line.name}`}
              className="flex justify-between gap-2 border-b border-zinc-100 pb-2"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium">{line.name}</span>
                <span className="block font-mono-nums text-[11px] text-zinc-500">
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
          <p className="text-[11px] text-emerald-700">
            Remise appliquée : {sale.discountPct} %
            {order?.promoCode ? (
              <span className="font-mono text-zinc-600"> · {order.promoCode}</span>
            ) : null}
          </p>
        ) : null}

        {order && order.deliveryFeeTTC && order.deliveryFeeTTC > 0 ? (
          <p className="text-[11px] text-zinc-600">
            Frais de livraison TTC :{' '}
            <span className="font-mono-nums font-semibold text-zinc-800">
              {formatFCFA(order.deliveryFeeTTC)}
            </span>
          </p>
        ) : null}

        {(sale.refundsTotalTTC ?? 0) > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <p className="font-semibold">Remboursements (audit)</p>
            <p className="mt-0.5 font-mono-nums">
              Remboursé : {formatFCFA(sale.refundsTotalTTC ?? 0)} · CA net :{' '}
              {formatFCFA(saleNetTTC(sale))}
            </p>
          </div>
        ) : null}

        <div className="space-y-1 border-t border-dashed border-zinc-200 pt-3 font-mono-nums text-[13px]">
          <div className="flex justify-between text-zinc-600">
            <span>Sous-total HT</span>
            <span>{formatFCFA(sale.subtotalHT)}</span>
          </div>
          {vatSlices.map((s) => (
            <div key={s.ratePct} className="flex justify-between text-zinc-600">
              <span>TVA {s.ratePct} %</span>
              <span>{formatFCFA(s.tva)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-[15px] font-bold text-zinc-900">
            <span>Total TTC</span>
            <span>{formatFCFA(sale.totalTTC)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[13px]">
          <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Paiement
          </p>
          <p className="mt-1 text-center font-semibold text-zinc-900">
            {order
              ? onlineOrderPaymentCaption(order.paymentMethod)
              : paymentMethodShortLabel(sale.paymentMethod)}
          </p>
          <ul className="mt-2 space-y-1 font-mono-nums text-zinc-700">
            {amt.cash > 0 ? (
              <li className="flex justify-between">
                <span>Espèces</span>
                <span>{formatFCFA(amt.cash)}</span>
              </li>
            ) : null}
            {amt.card > 0 ? (
              <li className="flex justify-between">
                <span>Carte (TPE)</span>
                <span>{formatFCFA(amt.card)}</span>
              </li>
            ) : null}
            {amt.mobile > 0 ? (
              <li className="flex justify-between">
                <span>Mobile money</span>
                <span>{formatFCFA(amt.mobile)}</span>
              </li>
            ) : null}
          </ul>
          {sale.cashReceived != null ? (
            <p className="mt-2 border-t border-zinc-200 pt-2 text-[11px] text-zinc-600">
              Reçu : {formatFCFA(sale.cashReceived)}
            </p>
          ) : null}
          {sale.changeDue != null && sale.changeDue > 0 ? (
            <p className="mt-0.5 text-[13px] font-bold text-emerald-700">
              Monnaie : {formatFCFA(sale.changeDue)}
            </p>
          ) : null}
          {sale.cardTpeReference ? (
            <p className="mt-1 font-mono text-[10px] text-zinc-500">
              Réf. TPE : {sale.cardTpeReference}
            </p>
          ) : null}
          {sale.mobileMoneyReference ? (
            <p className="font-mono text-[10px] text-zinc-500">
              Réf. mobile : {sale.mobileMoneyReference}
            </p>
          ) : null}
        </div>

        {order?.reviewedByDisplayName && order.status !== 'pending' ? (
          <p className="text-center text-[10px] text-zinc-500">
            Traité par {order.reviewedByDisplayName}
            {order.reviewedAt
              ? ` · ${new Date(order.reviewedAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}`
              : null}
          </p>
        ) : null}

        <footer className="pt-2 text-center text-[10px] text-zinc-400">
          {isOnline
            ? 'Commande en ligne · Document non fiscal'
            : 'Merci de votre achat · Document non fiscal'}
        </footer>
      </div>
    </Modal>
  )
}
