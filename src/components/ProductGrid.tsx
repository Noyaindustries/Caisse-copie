import type { ProductWithStock } from '../db/types'
import { formatFCFA } from '../lib/money'
import { productImageSrc } from '../lib/productImage'
import { CATEGORY_TABS, type CategoryTab } from './Sidebar'

export type ProductGridDensity = 'compact' | 'confort'

type Props = {
  products: ProductWithStock[]
  category: CategoryTab
  onCategoryChange: (tab: CategoryTab) => void
  search: string
  onAdd: (p: ProductWithStock) => void
  density?: ProductGridDensity
}

function stockBadge(p: ProductWithStock): { label: string; className: string } | null {
  if (p.stock <= 0)
    return { label: 'Rupture', className: 'bg-slate-200 text-slate-600' }
  if (p.stock <= p.lowStockThreshold)
    return { label: 'Faible', className: 'bg-amber-100 text-amber-900' }
  return null
}

export function ProductGrid({
  products,
  category,
  onCategoryChange,
  search,
  onAdd,
  density = 'compact',
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
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {filtered.map((p) => {
          const badge = stockBadge(p)
          const disabled = p.stock <= 0
          const isCompact = density === 'compact'
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onAdd(p)}
              className={`mx-auto w-full max-w-46 sm:max-w-none flex flex-col border border-slate-200 bg-white text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${
                isCompact ? 'rounded-md p-2' : 'rounded-lg p-2.5'
              } ${
                disabled ? '' : ''
              }`}
            >
              <div className="mb-1.5 flex items-start justify-between gap-1.5">
                <img
                  src={productImageSrc(p)}
                  alt={p.name}
                  className={`shrink-0 border border-slate-200 object-cover ${
                    isCompact ? 'h-9 w-9 rounded-md' : 'h-11 w-11 rounded-lg'
                  }`}
                />
                {badge ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                ) : null}
              </div>
              <p
                className={`text-slate-900 ${isCompact ? 'text-[12px] font-semibold leading-tight' : 'text-[13px] font-medium'} ${
                  disabled ? 'text-slate-400' : ''
                }`}
              >
                {p.name}
              </p>
              <p
                className={`mt-0.5 font-semibold text-emerald-600 ${
                  isCompact ? 'text-[13px]' : 'text-sm'
                }`}
              >
                {formatFCFA(p.priceTTC)}
              </p>
              <p className={`mt-0.5 text-slate-500 ${isCompact ? 'text-[10px]' : 'text-[11px]'}`}>
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
