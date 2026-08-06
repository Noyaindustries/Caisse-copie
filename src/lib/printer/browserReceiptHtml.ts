import { getAppSettings } from '../appSettings'
import { formatFCFA, type VatSliceByRate } from '../money'
import type { Sale, TicketInvoice } from '../../db/types'
import { SESSION_ID } from '../session'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HTML compact pour impression ticket thermique via pilote Windows / navigateur. */
export function buildBrowserReceiptHtml(input: {
  sale: Sale
  businessName: string
  documentLabel: string
  dtLabel: string
  vatSlices: VatSliceByRate[]
  amounts: { cash: number; card: number; mobile: number }
  ticketInvoice?: TicketInvoice | null
}): string {
  const { sale, businessName, documentLabel, dtLabel, vatSlices, amounts, ticketInvoice } =
    input

  const linesHtml = sale.lines
    .map(
      (line) => `<tr>
  <td style="padding:3px 0;word-break:break-word;color:#000;">${escapeHtml(line.name)}<br/><span style="font-size:10px;color:#000;">${formatFCFA(line.unitPriceTTC)} x ${line.qty}</span></td>
  <td style="padding:3px 0;text-align:right;white-space:nowrap;vertical-align:top;color:#000;">${formatFCFA(line.unitPriceTTC * line.qty)}</td>
</tr>`,
    )
    .join('')

  const vatHtml = vatSlices
    .map(
      (s) =>
        `<div class="row"><span>TVA ${s.ratePct} %</span><span>${formatFCFA(s.tva)}</span></div>`,
    )
    .join('')

  const payHtml = [
    amounts.cash > 0
      ? `<div class="row"><span>Especes</span><span>${formatFCFA(amounts.cash)}</span></div>`
      : '',
    amounts.card > 0
      ? `<div class="row"><span>Carte</span><span>${formatFCFA(amounts.card)}</span></div>`
      : '',
    amounts.mobile > 0
      ? `<div class="row"><span>Mobile money</span><span>${formatFCFA(amounts.mobile)}</span></div>`
      : '',
    sale.cashReceived != null
      ? `<div class="row"><span>Recu</span><span>${formatFCFA(sale.cashReceived)}</span></div>`
      : '',
    sale.changeDue != null && sale.changeDue > 0
      ? `<div class="row"><span>Monnaie</span><span>${formatFCFA(sale.changeDue)}</span></div>`
      : '',
  ].join('')

  const footerLine = escapeHtml(
    ticketInvoice?.notes?.trim() || getAppSettings().receiptFooterLine,
  )
  const receiptRef = escapeHtml(
    (ticketInvoice?.reference ?? sale.id.slice(0, 8)).toUpperCase(),
  )
  const clientBlock = ticketInvoice
    ? `<div style="margin-top:6px;font-size:11px;color:#000;">
<div><strong>Ref:</strong> ${escapeHtml(ticketInvoice.reference)}</div>
<div><strong>Client:</strong> ${escapeHtml(ticketInvoice.customerName ?? 'Client comptoir')}</div>
${ticketInvoice.customerPhone ? `<div><strong>Tel:</strong> ${escapeHtml(ticketInvoice.customerPhone)}</div>` : ''}
</div>`
    : ''

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Ticket</title>
    <style>
      @page { margin: 3mm; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.35;
      }
      body { padding: 2mm; width: 72mm; }
      .row { display: flex; justify-content: space-between; gap: 4px; color: #000; }
      .total { font-weight: 700; font-size: 13px; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; }
      .feed { margin-top: 8px; color: #000; font-size: 10px; }
    </style>
  </head>
  <body>
    <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;color:#000;">
      <div style="font-size:15px;font-weight:700;">${escapeHtml(businessName)}</div>
      <div style="font-size:11px;margin-top:3px;">${escapeHtml(documentLabel)}</div>
      <div style="font-size:11px;margin-top:3px;">${escapeHtml(dtLabel)}</div>
      <div style="font-size:11px;">Session #${SESSION_ID}</div>
      <div style="margin-top:3px;"><strong>Ref.</strong> ${receiptRef}</div>
      ${sale.cashierDisplayName ? `<div>Caissier : ${escapeHtml(sale.cashierDisplayName)}</div>` : ''}
      ${sale.storeName && sale.storeName.trim() !== businessName ? `<div>PV : ${escapeHtml(sale.storeName)}</div>` : ''}
      ${sale.tableName ? `<div>Table : ${escapeHtml(sale.tableName)}</div>` : ''}
      ${clientBlock}
    </div>
    <table style="margin-top:6px;">
      <tbody>${linesHtml}</tbody>
    </table>
    <div style="margin-top:6px;border-top:1px dashed #000;padding-top:6px;">
      <div class="row"><span>Sous-total HT</span><span>${formatFCFA(sale.subtotalHT)}</span></div>
      ${vatHtml}
      <div class="row total"><span>Total TTC</span><span>${formatFCFA(sale.totalTTC)}</span></div>
      ${payHtml}
    </div>
    <div style="margin-top:8px;text-align:center;">${footerLine}</div>
    <div class="feed">.<br/>.<br/>.</div>
  </body>
</html>`
}
