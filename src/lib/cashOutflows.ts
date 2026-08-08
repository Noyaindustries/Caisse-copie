import type { CashOutflow, Sale } from '../db/types'

export function sumCashOutflows(rows: CashOutflow[]): number {
  return rows.reduce((sum, row) => sum + Math.max(0, row.amount || 0), 0)
}

export function filterCashOutflowsByDate(
  rows: CashOutflow[],
  dateYmd: string,
): CashOutflow[] {
  return rows.filter((row) => row.dateYmd === dateYmd)
}

/** Total monnaie rendue aux clients (espèces). */
export function sumChangeDue(sales: Sale[]): number {
  return sales.reduce((sum, sale) => {
    const due = sale.changeDue
    return sum + (typeof due === 'number' && due > 0 ? due : 0)
  }, 0)
}
