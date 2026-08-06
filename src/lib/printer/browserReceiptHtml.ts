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
    .replace(/[€]/g, 'F')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '?')
    .trim()
}

/** Montants courts pour 58 mm (evite la coupe a droite). */
function formatPrintMoney(amount: number): string {
  return toPrintable(formatFCFA(amount).replace(/\s*FCFA$/i, 'F'))
}

function line(label: string, value: string, fontSize: string): string {
  return `<tr>
  <td style="padding:1px 0;color:#000;font-size:${fontSize};width:58%;">${escapeHtml(toPrintable(label))}</td>
  <td style="padding:1px 0 1px 2px;text-align:right;color:#000;font-size:${fontSize};width:42%;">${escapeHtml(toPrintable(value))}</td>
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

  // Zone imprimable reelle ~48-50 mm sur rouleau 58 mm (marges pilote).
  const bodyWidth = paperWidth === '58mm' ? '46mm' : '68mm'
  const fontSize = paperWidth === '58mm' ? '9px' : '12px'
  const smallSize = paperWidth === '58mm' ? '8px' : '10px'
  const titleSize = paperWidth === '58mm' ? '11px' : '14px'

  const linesHtml = sale.lines
    .map((item) => {
      const name = escapeHtml(toPrintable(item.name))
      const detail = escapeHtml(
        toPrintable(`${formatPrintMoney(item.unitPriceTTC)} x ${item.qty}`),
      )
      const total = escapeHtml(formatPrintMoney(item.unitPriceTTC * item.qty))
      // Ligne + montant sur 2 colonnes etroites (pas de float = plus fiable sur POS).
      return `<tr>
  <td style="padding:2px 0;color:#000;font-size:${fontSize};width:62%;">${name}<br/><span style="font-size:${smallSize};">${detail}</span></td>
  <td style="padding:2px 0 2px 2px;text-align:right;vertical-align:top;color:#000;font-size:${fontSize};font-weight:700;width:38%;">${total}</td>
</tr>`
    })
    .join('')

  const totalsRows = [
    line('Sous-tot HT', formatPrintMoney(sale.subtotalHT), fontSize),
    ...vatSlices.map((s) =>
      line(`TVA ${s.ratePct}%`, formatPrintMoney(s.tva), fontSize),
    ),
    line('TOTAL TTC', formatPrintMoney(sale.totalTTC), fontSize),
    amounts.cash > 0 ? line('Especes', formatPrintMoney(amounts.cash), fontSize) : '',
    amounts.card > 0 ? line('Carte', formatPrintMoney(amounts.card), fontSize) : '',
    amounts.mobile > 0
      ? line('Mobile', formatPrintMoney(amounts.mobile), fontSize)
      : '',
    sale.cashReceived != null
      ? line('Recu', formatPrintMoney(sale.cashReceived), fontSize)
      : '',
    sale.changeDue != null && sale.changeDue > 0
      ? line('Monnaie', formatPrintMoney(sale.changeDue), fontSize)
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
    `<div style="font-size:${titleSize};font-weight:700;color:#000;">${escapeHtml(toPrintable(businessName))}</div>`,
    `<div style="font-size:${fontSize};color:#000;margin-top:1px;">${escapeHtml(toPrintable(documentLabel))}</div>`,
    `<div style="font-size:${smallSize};color:#000;margin-top:1px;">${escapeHtml(toPrintable(dtLabel))}</div>`,
    `<div style="font-size:${smallSize};color:#000;">Session #${escapeHtml(String(SESSION_ID))}</div>`,
    `<div style="font-size:${fontSize};color:#000;margin-top:1px;">Ref. ${receiptRef}</div>`,
  ]
  if (sale.cashierDisplayName) {
    headerBits.push(
      `<div style="font-size:${smallSize};color:#000;">Caissier : ${escapeHtml(toPrintable(sale.cashierDisplayName))}</div>`,
    )
  }
  if (sale.storeName && sale.storeName.trim() !== businessName.trim()) {
    headerBits.push(
      `<div style="font-size:${smallSize};color:#000;">PV : ${escapeHtml(toPrintable(sale.storeName))}</div>`,
    )
  }
  if (sale.tableName) {
    headerBits.push(
      `<div style="font-size:${smallSize};color:#000;">Table : ${escapeHtml(toPrintable(sale.tableName))}</div>`,
    )
  }
  if (ticketInvoice?.customerName) {
    headerBits.push(
      `<div style="font-size:${smallSize};color:#000;">Client : ${escapeHtml(toPrintable(ticketInvoice.customerName))}</div>`,
    )
  }

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Ticket</title>
    <style>
      @page {
        size: 58mm 200mm;
        margin: 0;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
      }
      body {
        width: ${bodyWidth};
        max-width: ${bodyWidth};
        padding: 1mm 1.5mm 0;
        box-sizing: border-box;
        overflow: hidden;
      }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      td { vertical-align: top; word-wrap: break-word; overflow-wrap: anywhere; }
      .cut-space { height: 18mm; margin-top: 4mm; }
    </style>
  </head>
  <body>
    <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:3px;">
      ${headerBits.join('\n      ')}
    </div>
    <table style="margin-top:3px;">
      <tbody>${linesHtml}</tbody>
    </table>
    <table style="margin-top:3px;border-top:1px dashed #000;padding-top:3px;">
      <tbody>${totalsRows}</tbody>
    </table>
    <div style="margin-top:4px;text-align:center;font-size:${smallSize};color:#000;">${footerLine}</div>
    <div class="cut-space" aria-hidden="true">&nbsp;</div>
  </body>
</html>`
}
