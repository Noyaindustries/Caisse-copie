import type { Product } from './types'

function id(s: string): string {
  return s
}

/** Stocks initiaux sur le magasin principal (démo) — appliqués via storeStocks. */
export const SEED_INITIAL_STOCK_MAIN: Record<string, number> = {
  [id('p1')]: 48,
  [id('p2')]: 5,
  [id('p3')]: 0,
  [id('p4')]: 32,
  [id('p5')]: 7,
  [id('p6')]: 15,
  [id('p7')]: 22,
  [id('p8')]: 3,
  [id('p9')]: 100,
}

/** Données de démonstration — remplaçables par import CSV (PRD) */
export const SEED_PRODUCTS: Product[] = [
  {
    id: id('p1'),
    name: 'Eau minérale 1.5L',
    priceTTC: 500,
    category: 'Boissons',
    barcode: '3661234567890',
    lowStockThreshold: 10,
    vatRatePct: 18,
    archived: false,
  },
  {
    id: id('p2'),
    name: 'Jus de bissap 1L',
    priceTTC: 800,
    category: 'Boissons',
    barcode: '3661234567891',
    lowStockThreshold: 8,
    vatRatePct: 18,
    archived: false,
  },
  {
    id: id('p3'),
    name: 'Coca-Cola 33cl',
    priceTTC: 400,
    category: 'Boissons',
    barcode: '3661234567892',
    lowStockThreshold: 12,
    vatRatePct: 18,
    archived: false,
  },
  {
    id: id('p4'),
    name: 'Riz parfumé 1kg',
    priceTTC: 1200,
    category: 'Alimentation',
    barcode: '3661234567893',
    lowStockThreshold: 5,
    vatRatePct: 18,
    archived: false,
  },
  {
    id: id('p5'),
    name: 'Huile végétale 1L',
    priceTTC: 1500,
    category: 'Alimentation',
    barcode: '3661234567894',
    lowStockThreshold: 6,
    vatRatePct: 18,
    archived: false,
  },
  {
    id: id('p6'),
    name: 'Pain de mie',
    priceTTC: 600,
    category: 'Alimentation',
    barcode: '3661234567895',
    lowStockThreshold: 4,
    vatRatePct: 18,
    archived: false,
  },
  {
    id: id('p7'),
    name: 'Savon 250g',
    priceTTC: 350,
    category: 'Hygiène',
    barcode: '3661234567896',
    lowStockThreshold: 10,
    vatRatePct: 18,
    archived: false,
  },
  {
    id: id('p8'),
    name: 'Papier toilette (x4)',
    priceTTC: 900,
    category: 'Hygiène',
    barcode: '3661234567897',
    lowStockThreshold: 5,
    vatRatePct: 18,
    archived: false,
  },
  {
    id: id('p9'),
    name: 'Sacs réutilisables',
    priceTTC: 200,
    category: 'Autre',
    barcode: '3661234567898',
    lowStockThreshold: 20,
    vatRatePct: 18,
    archived: false,
  },
]
