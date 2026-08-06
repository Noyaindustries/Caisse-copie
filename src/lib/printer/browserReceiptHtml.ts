import { getAppSettings } from '../appSettings'
import { formatFCFA, type VatSliceByRate } from '../money'
import type { Sale, TicketInvoice } from '../../db/types'
import { SESSION_ID } from '../session'

/** Largeur imprimable approximative pour rouleau 58 mm. */
export type ReceiptPaperWidth = '58mm' | '80mm'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** ASCII simple — les pilotes POS en mode graphique plantent souvent sur accents / flex. */
function toPrintable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[œŒ]/g, (m) => (m === 'œ' ? 'oe' : 'OE'))
    .replace(/[æÆ]/g, (m) => (m === 'æ' ? 'ae' : 'AE'))
    .replace(/[€]/g, 'FCFA')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '?')
    .trim()
}

function line(label: string, value: string): string {
  return `<tr>
  <td style="padding:2px 0;color:#000;font-size:11px;">${escapeHtml(toPrintable(label))}</td>
  <td style="padding:2px 0;text-align:right;color:#000;font-size:11px;white-space:nowrap;">${escapeHtml(toPrintable(value))}</td>
</tr>`
}

/**
 * HTML pour impression ticket thermique via pilote Windows (ZPrinter / POS).
 * Tables uniquement — pas de flex/grid (souvent = page bizarre / caractères parasites).
 */
export function buildBrowserReceiptHtml(input: {
  sale: Sale
  businessName: string
  documentLabel: string
  dtLabel: string
  vatSlices: VatSliceByRate[]
  amounts: { cash: number; card: number; mobile: number }
  ticketInvoice?: TicketInvoice | null
  paperWidth?: ReceiptPaperWidth
}): string {
  const {
    sale,
    businessName,
    documentLabel,
    dtLabel,
    vatSlices,
    amounts,
    ticketInvoice,
    paperWidth = '58mm',
  } = input

  const bodyWidth = paperWidth === '58mm' ? '48mm' : '68mm'
  const fontSize = paperWidth === '58mm' ? '11px' : '12px'

  const linesHtml = sale.lines
    .map((item) => {
      const name = escapeHtml(toPrintable(item.name))
      const detail = escapeHtml(
        toPrintable(`${formatFCFA(item.unitPriceTTC)} x ${item.qty}`),
      )
      const total = escapeHtml(
        toPrintable(formatFCFA(item.unitPriceTTC * item.qty)),
      )
      return `<tr>
  <td style="padding:3px 0;color:#000;font-size:${fontSize};">${name}<br/><span style="font-size:10px;">${detail}</span></td>
  <td style="padding:3px 0;text-align:right;vertical-align:top;color:#000;font-size:${fontSize};white-space:nowrap;">${total}</td>
</tr>`
    })
    .join('')

  const totalsRows = [
    line('Sous-total HT', formatFCFA(sale.subtotalHT)),
    ...vatSlices.map((s) => line(`TVA ${s.ratePct} %`, formatFCFA(s.tva))),
    line('Total TTC', formatFCFA(sale.totalTTC)),
    amounts.cash > 0 ? line('Especes', formatFCFA(amounts.cash)) : '',
    amounts.card > 0 ? line('Carte', formatFCFA(amounts.card)) : '',
    amounts.mobile > 0 ? line('Mobile money', formatFCFA(amounts.mobile)) : '',
    sale.cashReceived != null
      ? line('Recu', formatFCFA(sale.cashReceived))
      : '',
    sale.changeDue != null && sale.changeDue > 0
      ? line('Monnaie', formatFCFA(sale.changeDue))
      : '',
  ].join('')

  const footerLine = escapeHtml(
    toPrintable(
      ticketInvoice?.notes?.trim() || getAppSettings().receiptFooterLine,
    ),
  )
  const receiptRef = escapeHtml(
    toPrintable(
      (ticketInvoice?.reference ?? sale.id.slice(0, 8)).toUpperCase(),
    ),
  )

  const headerBits = [
    `<div style="font-size:14px;font-weight:700;color:#000;">${escapeHtml(toPrintable(businessName))}</div>`,
    `<div style="font-size:11px;color:#000;margin-top:2px;">${escapeHtml(toPrintable(documentLabel))}</div>`,
    `<div style="font-size:10px;color:#000;margin-top:2px;">${escapeHtml(toPrintable(dtLabel))}</div>`,
    `<div style="font-size:10px;color:#000;">Session #${escapeHtml(String(SESSION_ID))}</div>`,
    `<div style="font-size:11px;color:#000;margin-top:2px;">Ref. ${receiptRef}</div>`,
  ]
  if (sale.cashierDisplayName) {
    headerBits.push(
      `<div style="font-size:10px;color:#000;">Caissier : ${escapeHtml(toPrintable(sale.cashierDisplayName))}</div>`,
    )
  }
  if (sale.storeName && sale.storeName.trim() !== businessName.trim()) {
    headerBits.push(
      `<div style="font-size:10px;color:#000;">PV : ${escapeHtml(toPrintable(sale.storeName))}</div>`,
    )
  }
  if (sale.tableName) {
    headerBits.push(
      `<div style="font-size:10px;color:#000;">Table : ${escapeHtml(toPrintable(sale.tableName))}</div>`,
    )
  }
  if (ticketInvoice?.customerName) {
    headerBits.push(
      `<div style="font-size:10px;color:#000;">Client : ${escapeHtml(toPrintable(ticketInvoice.customerName))}</div>`,
    )
  }

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Ticket</title>
    <style>
      @page { margin: 2mm; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
      }
      body { width: ${bodyWidth}; max-width: ${bodyWidth}; padding: 1mm; }
      table { width: 100%; border-collapse: collapse; }
      td { vertical-align: top; }
    </style>
  </head>
  <body>
    <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:4px;">
      ${headerBits.join('\n      ')}
    </div>
    <table style="margin-top:4px;">
      <tbody>${linesHtml}</tbody>
    </table>
    <table style="margin-top:4px;border-top:1px dashed #000;padding-top:4px;">
      <tbody>${totalsRows}</tbody>
    </table>
    <div style="margin-top:6px;text-align:center;font-size:10px;color:#000;">${footerLine}</div>
    <div style="margin-top:6px;font-size:10px;color:#000;">.<br/>.<br/>.</div>
  </body>
</html>`
}
