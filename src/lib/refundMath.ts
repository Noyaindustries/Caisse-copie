import type { Sale, SaleLine } from '../db/types'

const discountFactor = (discountPct: number) =>
  Math.max(0, 1 - discountPct / 100)

export function refundedQtyForLine(sale: Sale, productId: string): number {
  return sale.refundedLineQty?.[productId] ?? 0
}

export function refundableQty(line: SaleLine, sale: Sale): number {
  return Math.max(0, line.qty - refundedQtyForLine(sale, line.productId))
}

/** Montant TTC remboursé pour une quantité sur une ligne (avec remise panier). */
export function lineRefundAmountTTC(
  line: SaleLine,
  qty: number,
  discountPct: number,
): number {
  if (qty <= 0) return 0
  const f = discountFactor(discountPct)
  return Math.round(line.unitPriceTTC * qty * f)
}

export type LineRefundQtyMap = Record<string, number>

/**
 * Calcule le montant TTC total et valide les quantités demandées.
 */
export function computeRefundFromLineQty(
  sale: Sale,
  requested: LineRefundQtyMap,
): { ok: true; amountTTC: number; adjustments: { productId: string; qty: number }[] } | { ok: false; message: string } {
  const adjustments: { productId: string; qty: number }[] = []
  let amountTTC = 0

  for (const line of sale.lines) {
    const want = Math.floor(requested[line.productId] ?? 0)
    if (want < 0) {
      return { ok: false, message: 'Quantité invalide.' }
    }
    const max = refundableQty(line, sale)
    if (want > max) {
      return {
        ok: false,
        message: `Quantité trop élevée pour « ${line.name} » (max ${max}).`,
      }
    }
    if (want > 0) {
      adjustments.push({ productId: line.productId, qty: want })
      amountTTC += lineRefundAmountTTC(line, want, sale.discountPct)
    }
  }

  if (adjustments.length === 0) {
    return {
      ok: false,
      message: 'Indiquez au moins une quantité à rembourser.',
    }
  }

  return { ok: true, amountTTC, adjustments }
}

export function saleNetTTC(sale: Sale): number {
  const r = sale.refundsTotalTTC ?? 0
  return Math.max(0, Math.round(sale.totalTTC - r))
}

export function saleFullyRefunded(sale: Sale): boolean {
  return saleNetTTC(sale) <= 0 && (sale.refundsTotalTTC ?? 0) > 0
}
