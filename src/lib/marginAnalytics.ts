import type { Product, Sale } from '../db/types'

export type TopProductMarginRow = {
  name: string
  qty: number
  revenueTTC: number
  costTTC: number | null
  marginTTC: number | null
  marginPct: number | null
}

const disc = (pct: number) => Math.max(0, 1 - pct / 100)

function productMap(products: Product[]): Map<string, Product> {
  return new Map(products.map((p) => [p.id, p]))
}

/** Top articles avec marge si prix de revient renseigné sur le produit. */
export function topProductsWithMargins(
  sales: Sale[],
  products: Product[],
  limit: number,
): TopProductMarginRow[] {
  const pmap = productMap(products)
  const map = new Map<
    string,
    {
      qty: number
      revenueTTC: number
      costTTC: number
      hasCost: boolean
    }
  >()

  for (const s of sales) {
    const f = disc(s.discountPct)
    for (const line of s.lines) {
      const rq = s.refundedLineQty?.[line.productId] ?? 0
      const eq = Math.max(0, line.qty - rq)
      if (eq <= 0) continue
      const p = pmap.get(line.productId)
      const cur = map.get(line.name) ?? {
        qty: 0,
        revenueTTC: 0,
        costTTC: 0,
        hasCost: false,
      }
      cur.qty += eq
      cur.revenueTTC += Math.round(line.unitPriceTTC * eq * f)
      const costUnit = p?.purchasePriceTTC
      if (p != null && costUnit != null && Number.isFinite(costUnit) && costUnit >= 0) {
        cur.hasCost = true
        cur.costTTC += Math.round(costUnit * eq)
      }
      map.set(line.name, cur)
    }
  }

  return [...map.entries()]
    .map(([name, v]) => {
      const marginTTC = v.hasCost ? v.revenueTTC - v.costTTC : null
      const marginPct =
        v.hasCost && v.revenueTTC > 0
          ? Math.round((marginTTC! / v.revenueTTC) * 1000) / 10
          : null
      return {
        name,
        qty: v.qty,
        revenueTTC: v.revenueTTC,
        costTTC: v.hasCost ? v.costTTC : null,
        marginTTC,
        marginPct,
      }
    })
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
}

/** Totaux période : CA net global et marge sur la part avec prix de revient. */
export function periodMarginTotals(
  sales: Sale[],
  products: Product[],
): {
  revenueTTC: number
  revenueWithCostTTC: number
  costTTC: number
  marginOnKnownTTC: number
  marginPctOnKnown: number | null
} {
  const pmap = productMap(products)
  let revenueTTC = 0
  let costTTC = 0
  let revenueWithCost = 0

  for (const s of sales) {
    const f = disc(s.discountPct)
    for (const line of s.lines) {
      const rq = s.refundedLineQty?.[line.productId] ?? 0
      const eq = Math.max(0, line.qty - rq)
      if (eq <= 0) continue
      const p = pmap.get(line.productId)
      const rev = Math.round(line.unitPriceTTC * eq * f)
      revenueTTC += rev
      const costUnit = p?.purchasePriceTTC
      if (p != null && costUnit != null && Number.isFinite(costUnit) && costUnit >= 0) {
        revenueWithCost += rev
        costTTC += Math.round(costUnit * eq)
      }
    }
  }

  const marginOnKnownTTC = revenueWithCost - costTTC
  const marginPctOnKnown =
    revenueWithCost > 0
      ? Math.round((marginOnKnownTTC / revenueWithCost) * 1000) / 10
      : null

  return {
    revenueTTC,
    revenueWithCostTTC: revenueWithCost,
    costTTC,
    marginOnKnownTTC,
    marginPctOnKnown,
  }
}
