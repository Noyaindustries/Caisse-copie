import type { ProductWithStock } from '../db/types'
import { formatFCFA } from '../lib/money'
import { Badge } from '../ui/Badge'
import { ProductImage } from './ProductImage'
import { cn } from '../ui/cn'
import { EmptyState } from '../ui/EmptyState'
import { IconSearch } from '../ui/icons'
import type { CategoryTab } from './Sidebar'

export type ProductGridDensity = 'compact' | 'confort'

type Props = {
  products: ProductWithStock[]
  categoryTabs: CategoryTab[]
  category: CategoryTab
  onCategoryChange: (tab: CategoryTab) => void
  search: string
  onAdd: (p: ProductWithStock, originEl?: HTMLElement | null) => void
  density?: ProductGridDensity
}

function stockState(p: ProductWithStock): 'rupture' | 'faible' | 'ok' {
  if (p.stock <= 0) return 'rupture'
  if (p.stock <= p.lowStockThreshold) return 'faible'
  return 'ok'
}

export function ProductGrid({
  products,
  categoryTabs,
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
    return p.name.toLowerCase().includes(q) || p.barcode.includes(q)
  })

  const isCompact = density === 'compact'

  return (
    <>
      <div className="mb-4 ui-scroll flex gap-1.5 overflow-x-auto pb-1">
        {categoryTabs.map((tab) => {
          const on = tab === category
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onCategoryChange(tab)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition',
                on
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900',
              )}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch />}
          title="Aucun article"
          description="Affinez la recherche ou changez de catégorie."
        />
      ) : (
        <div
          className={cn(
            'grid gap-2',
            isCompact
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-7'
              : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5',
          )}
        >
          {filtered.map((p) => {
            const state = stockState(p)
            const disabled = state === 'rupture'
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={(e) => onAdd(p, e.currentTarget)}
                className={cn(
                  'ui-card-hover group flex min-h-30 flex-col rounded-xl border border-zinc-200 bg-white text-left transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-28',
                  isCompact ? 'p-2.5' : 'p-3',
                )}
              >
                <div className="relative mb-2 flex items-start justify-between gap-1.5">
                  <ProductImage
                    product={p}
                    className={cn(
                      'shrink-0 rounded-lg border border-zinc-200 object-cover',
                      isCompact ? 'h-12 w-12' : 'h-14 w-14',
                    )}
                  />
                  {state === 'rupture' ? (
                    <Badge tone="neutral">Rupture</Badge>
                  ) : state === 'faible' ? (
                    <Badge tone="warning">Faible</Badge>
                  ) : null}
                </div>
                <p
                  className={cn(
                    'line-clamp-2 font-medium leading-tight text-zinc-900',
                    isCompact ? 'text-[12px]' : 'text-[13px]',
                    disabled && 'text-zinc-400',
                  )}
                >
                  {p.name}
                </p>
                <p
                  className={cn(
                    'mt-1 font-mono-nums font-semibold text-emerald-600',
                    isCompact ? 'text-[13px]' : 'text-[14px]',
                  )}
                >
                  {formatFCFA(p.priceTTC)}
                </p>
                <p
                  className={cn(
                    'mt-0.5 font-mono-nums text-[11px]',
                    state === 'rupture'
                      ? 'text-rose-600'
                      : state === 'faible'
                        ? 'text-amber-700'
                        : 'text-zinc-500',
                  )}
                >
                  Stock : {p.stock}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
