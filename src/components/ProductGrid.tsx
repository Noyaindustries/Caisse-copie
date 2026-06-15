import type { ProductWithStock } from '../db/types'
import { formatFCFA } from '../lib/money'
import { Badge } from '../ui/Badge'
import { ProductImage } from './ProductImage'
import { cn } from '../ui/cn'
import { EmptyState } from '../ui/EmptyState'
import { IconSearch, IconSparkles } from '../ui/icons'
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
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b8922e]">
          Catalogue
        </p>
        <p className="font-mono-nums text-[12px] text-[#5c6678]">
          {filtered.length} article{filtered.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="mb-5 ui-scroll flex gap-2 overflow-x-auto pb-1">
        {categoryTabs.map((tab) => {
          const on = tab === category
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onCategoryChange(tab)}
              className={cn('caisse-cat-pill shrink-0', on && 'caisse-cat-pill-active')}
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
            'grid gap-3',
            isCompact
              ? 'grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-7'
              : 'grid-cols-2 min-[400px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5',
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
                  'caisse-product-card group flex min-h-32 flex-col text-left disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-30',
                  isCompact ? 'p-3' : 'p-3.5',
                )}
              >
                <div className="relative z-[1] mb-2.5 flex items-start justify-between gap-2">
                  <ProductImage
                    product={p}
                    className={cn(
                      'shrink-0 rounded-xl border border-[rgba(184,146,46,0.18)] object-cover shadow-sm',
                      isCompact ? 'h-12 w-12' : 'h-16 w-16',
                    )}
                  />
                  {state === 'rupture' ? (
                    <Badge tone="neutral">Rupture</Badge>
                  ) : state === 'faible' ? (
                    <Badge tone="warning">Faible</Badge>
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(184,146,46,0.15)] bg-white/80 text-[#c9a962] opacity-0 transition group-hover:opacity-100">
                      <IconSparkles className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'relative z-[1] line-clamp-2 font-medium leading-snug text-[#1a2332]',
                    isCompact ? 'text-[12px]' : 'text-[13px]',
                    disabled && 'text-[#8a919e]',
                  )}
                >
                  {p.name}
                </p>
                <p
                  className={cn(
                    'caisse-price relative z-[1] mt-1.5 font-mono-nums',
                    isCompact ? 'text-[14px]' : 'text-[15px]',
                  )}
                >
                  {formatFCFA(p.priceTTC)}
                </p>
                <p
                  className={cn(
                    'relative z-[1] mt-1 font-mono-nums text-[10px] uppercase tracking-wide',
                    state === 'rupture'
                      ? 'text-rose-600'
                      : state === 'faible'
                        ? 'text-amber-700'
                        : 'text-[#8a919e]',
                  )}
                >
                  Stock {p.stock}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
