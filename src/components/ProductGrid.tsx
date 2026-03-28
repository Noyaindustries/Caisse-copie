import type { ProductWithStock } from '../db/types'
import { formatFCFA } from '../lib/money'
import { CATEGORY_TABS, type CategoryTab } from './Sidebar'

type Props = {
  products: ProductWithStock[]
  category: CategoryTab
  onCategoryChange: (tab: CategoryTab) => void
  search: string
  onAdd: (p: ProductWithStock) => void
}

function stockBadge(p: ProductWithStock): { label: string; className: string } | null {
  if (p.stock <= 0)
    return { label: 'Rupture', className: 'bg-slate-200 text-slate-600' }
  if (p.stock <= p.lowStockThreshold)
    return { label: 'Faible', className: 'bg-amber-100 text-amber-900' }
  return null
}

function iconFor(category: string): string {
  const m: Record<string, string> = {
    Boissons: '🥤',
    Alimentation: '🍚',
    Hygiène: '🧼',
    Autre: '🛍️',
  }
  return m[category] ?? '📦'
}

export function ProductGrid({
  products,
  category,
  onCategoryChange,
  search,
  onAdd,
}: Props) {
  const q = search.trim().toLowerCase()
  const filtered = products.filter((p) => {
    if (category !== 'Tous' && p.category !== category) return false
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      p.barcode.includes(q)
    )
  })

  return (
    <>
      <p className="mb-3 text-sm leading-relaxed text-slate-600">
        Parcourir le catalogue par <strong>catégorie</strong> ci-dessous. Les
        articles correspondant à la <strong>recherche textuelle</strong> ou au{' '}
        <strong>lecteur code-barres USB</strong> (champ vert en tête de page —
        scan même après un clic ici) s’affichent aussi.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onCategoryChange(tab)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === category
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const badge = stockBadge(p)
          const disabled = p.stock <= 0
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onAdd(p)}
              className={`flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${
                disabled ? '' : ''
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                {p.imageDataUrl ? (
                  <img
                    src={p.imageDataUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="text-3xl" aria-hidden>
                    {iconFor(p.category)}
                  </span>
                )}
                {badge ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                ) : null}
              </div>
              <p
                className={`font-medium text-slate-900 ${disabled ? 'text-slate-400' : ''}`}
              >
                {p.name}
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-600">
                {formatFCFA(p.priceTTC)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {p.stock} en stock
              </p>
            </button>
          )
        })}
      </div>
      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">
          Aucun produit ne correspond à votre recherche.
        </p>
      ) : null}
    </>
  )
}
