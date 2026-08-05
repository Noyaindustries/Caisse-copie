import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OnlineOrder, Sale, TicketInvoice } from '../db/types'
import { getAppSettings } from '../lib/appSettings'
import { formatFCFA, vatSlicesFromLinesTTC } from '../lib/money'
import {
  paymentMethodShortLabel,
  salePaymentAmounts,
} from '../lib/paymentDisplay'
import { printReceipt as printReceiptJob } from '../lib/printer/printReceipt'
import { saleNetTTC } from '../lib/refundMath'
import { SESSION_ID } from '../lib/session'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/Toast'
import { IconPrinter } from '../ui/icons'

export type ReceiptModalSource =
  | { kind: 'sale'; sale: Sale }
  | { kind: 'onlineOrder'; order: OnlineOrder }
  | { kind: 'ticketInvoice'; ticketInvoice: TicketInvoice }

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

function syntheticSaleFromTicketInvoice(doc: TicketInvoice): Sale {
  return {
    id: doc.id,
    createdAt: doc.createdAt,
    lines: doc.lines,
    subtotalHT: doc.subtotalHT,
    tva: doc.tva,
    totalTTC: doc.totalTTC,
    discountPct: 0,
    paymentMethod: 'cash',
    synced: false,
    storeId: doc.storeId,
    storeName: doc.storeName,
    cashierProfileId: doc.createdByProfileId,
    cashierDisplayName: doc.createdByDisplayName,
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
  const toast = useToast()
  const autoPrintedReceiptRef = useRef<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const isOnline = source.kind === 'onlineOrder'
  const isTicketInvoice = source.kind === 'ticketInvoice'
  const order = isOnline ? source.order : null
  const ticketInvoice = isTicketInvoice ? source.ticketInvoice : null
  const sale = useMemo(
    () => {
      if (source.kind === 'sale') return source.sale
      if (source.kind === 'onlineOrder') return syntheticSaleFromOnlineOrder(source.order)
      return syntheticSaleFromTicketInvoice(source.ticketInvoice)
    },
    [source],
  )

  const receiptKey =
    source.kind === 'sale'
      ? source.sale.id
      : source.kind === 'onlineOrder'
        ? source.order.id
        : source.ticketInvoice.id
  const dtLabel = useMemo(
    () =>
      new Date(sale.createdAt).toLocaleString('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [sale.createdAt],
  )
  const amt = salePaymentAmounts(sale)
  const vatSlices = vatSlicesFromLinesTTC(sale.lines, sale.discountPct)
  const modalTitle = isOnline
    ? 'Reçu commande en ligne'
    : isTicketInvoice
      ? ticketInvoice?.kind === 'facture'
        ? 'Facture'
        : 'Reçu'
      : 'Reçu de vente'
  const tagline = isOnline
    ? 'Infinitecore Système · Commande web'
    : isTicketInvoice
      ? `Infinitecore Système · ${ticketInvoice?.kind === 'facture' ? 'Facture' : 'Ticket'}`
      : 'Infinitecore Système · Ticket de caisse'

  const printViaBrowser = useCallback(() => {
    const printFrame = document.createElement('iframe')
    printFrame.style.position = 'fixed'
    printFrame.style.right = '0'
    printFrame.style.bottom = '0'
    printFrame.style.width = '0'
    printFrame.style.height = '0'
    printFrame.style.border = '0'
    printFrame.setAttribute('aria-hidden', 'true')
    document.body.appendChild(printFrame)
    const frameWindow = printFrame.contentWindow
    if (!frameWindow) {
      printFrame.remove()
      return
    }
    const linesHtml = sale.lines
      .map(
        (line) => `<tr>
  <td style="padding:4px 0;">${line.name}<br/><span style="font-size:11px;color:#666;">${formatFCFA(line.unitPriceTTC)} × ${line.qty}</span></td>
  <td style="padding:4px 0;text-align:right;white-space:nowrap;">${formatFCFA(line.unitPriceTTC * line.qty)}</td>
</tr>`,
      )
      .join('')
    const vatHtml = vatSlices
      .map(
        (s) => `<div style="display:flex;justify-content:space-between;font-size:12px;color:#555;">
  <span>TVA ${s.ratePct} %</span><span>${formatFCFA(s.tva)}</span>
</div>`,
      )
      .join('')
    const receiptRef = (ticketInvoice?.reference ?? sale.id.slice(0, 8)).toUpperCase()
    const clientBlock = ticketInvoice
      ? `<div style="margin-top:8px;font-size:12px;">
<div><strong>Référence :</strong> ${ticketInvoice.reference}</div>
<div><strong>Client :</strong> ${ticketInvoice.customerName ?? 'Client comptoir'}</div>
${ticketInvoice.customerPhone ? `<div><strong>Tél. :</strong> ${ticketInvoice.customerPhone}</div>` : ''}
${ticketInvoice.notes ? `<div><strong>Note :</strong> ${ticketInvoice.notes}</div>` : ''}
</div>`
      : ''
    frameWindow.document.open()
    frameWindow.document.write(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Impression reçu</title>
    <style>
      html, body { background: #fff; color: #111; font-family: Arial, sans-serif; }
      body { margin: 0; padding: 8mm; }
      .row { display:flex; justify-content:space-between; font-size:12px; }
    </style>
  </head>
  <body>
    <section id="print-receipt">
      <div style="text-align:center;border-bottom:1px dashed #999;padding-bottom:8px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;">${tagline}</div>
        <div style="font-size:12px;color:#555;margin-top:4px;">${dtLabel}</div>
        <div style="font-size:11px;color:#555;margin-top:2px;">Session #${SESSION_ID}</div>
        <div style="font-size:12px;margin-top:4px;"><strong>Réf.</strong> ${receiptRef}</div>
        ${sale.cashierDisplayName ? `<div style="font-size:12px;">Caissier : ${sale.cashierDisplayName}</div>` : ''}
        ${sale.storeName ? `<div style="font-size:12px;">Point de vente : ${sale.storeName}</div>` : ''}
        ${sale.tableName ? `<div style="font-size:12px;">Table : ${sale.tableName}</div>` : ''}
        ${clientBlock}
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;">
        <tbody>${linesHtml}</tbody>
      </table>
      <div style="margin-top:8px;border-top:1px dashed #999;padding-top:6px;">
        <div class="row"><span>Sous-total HT</span><span>${formatFCFA(sale.subtotalHT)}</span></div>
        ${vatHtml}
        <div class="row" style="font-weight:700;font-size:14px;border-top:1px solid #ddd;padding-top:6px;margin-top:4px;">
          <span>Total TTC</span><span>${formatFCFA(sale.totalTTC)}</span>
        </div>
      </div>
    </section>
  </body>
</html>`)
    frameWindow.document.close()
    frameWindow.focus()
    window.setTimeout(() => {
      frameWindow.print()
      window.setTimeout(() => {
        printFrame.remove()
      }, 300)
    }, 300)
  }, [dtLabel, sale, tagline, ticketInvoice, vatSlices])

  const printReceipt = useCallback(async () => {
    if (printing) return
    setPrinting(true)
    try {
      const result = await printReceiptJob(source, {
        openCashDrawer: amt.cash > 0,
        browserFallback: printViaBrowser,
      })
      if (result.mode === 'escpos') {
        toast.success('Ticket imprimé', result.message)
      }
    } catch (err) {
      toast.error(
        'Impression impossible',
        err instanceof Error ? err.message : 'Erreur inconnue',
      )
      printViaBrowser()
    } finally {
      setPrinting(false)
    }
  }, [amt.cash, printing, printViaBrowser, source, toast])

  useEffect(() => {
    if (!autoPrint) return
    if (autoPrintedReceiptRef.current === receiptKey) {
      return
    }
    autoPrintedReceiptRef.current = receiptKey
    const id = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void printReceipt()
        })
      })
    }, 900)
    return () => clearTimeout(id)
  }, [autoPrint, printReceipt, receiptKey])

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={modalTitle}
      subtitle={`Réf. ${(ticketInvoice?.reference ?? sale.id.slice(0, 8)).toUpperCase()}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="primary"
            iconLeft={<IconPrinter />}
            disabled={printing}
            onClick={() => void printReceipt()}
          >
            {printing ? 'Impression…' : 'Imprimer'}
          </Button>
        </>
      }
    >
      <div id="print-receipt" className="space-y-4 text-zinc-800">
        <header className="border-b border-dashed border-zinc-200 pb-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-700">
            {tagline}
          </p>
          <p className="mt-1.5 font-mono-nums text-[12px] text-zinc-500">{dtLabel}</p>
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
          {ticketInvoice ? (
            <div className="mt-2 space-y-1 rounded-lg bg-zinc-50 px-2 py-2 text-[11px] text-zinc-700">
              <p>
                <span className="text-zinc-500">Référence :</span>{' '}
                <span className="font-semibold text-zinc-900">{ticketInvoice.reference}</span>
              </p>
              <p>
                <span className="text-zinc-500">Client :</span>{' '}
                <span className="font-semibold text-zinc-900">
                  {ticketInvoice.customerName ?? 'Client comptoir'}
                </span>
              </p>
              {ticketInvoice.customerPhone ? (
                <p>
                  <span className="text-zinc-500">Tél. :</span> {ticketInvoice.customerPhone}
                </p>
              ) : null}
              {ticketInvoice.dueAt ? (
                <p>
                  <span className="text-zinc-500">Échéance :</span>{' '}
                  {new Date(ticketInvoice.dueAt).toLocaleDateString('fr-FR')}
                </p>
              ) : null}
              {ticketInvoice.notes ? (
                <p>
                  <span className="text-zinc-500">Note :</span> {ticketInvoice.notes}
                </p>
              ) : null}
              {ticketInvoice.updatedByDisplayName ? (
                <p>
                  <span className="text-zinc-500">Modifié par :</span>{' '}
                  <span className="font-semibold text-zinc-900">
                    {ticketInvoice.updatedByDisplayName}
                  </span>
                </p>
              ) : null}
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
          {sale.tableName ? (
            <p className="text-[11px] text-zinc-600">
              Table :{' '}
              <span className="font-semibold text-zinc-800">{sale.tableName}</span>
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

        {!isTicketInvoice ? (
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
        ) : null}

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
            : getAppSettings().receiptFooterLine}
        </footer>
      </div>
    </Modal>
  )
}
