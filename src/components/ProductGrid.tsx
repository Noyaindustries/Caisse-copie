import { useMemo, useRef } from 'react'
import type { ProductWithStock } from '../db/types'
import { formatFCFA } from '../lib/money'
import { useHorizontalWheelScroll } from '../hooks/useHorizontalWheelScroll'
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
  const categoryScrollRef = useRef<HTMLDivElement>(null)
  useHorizontalWheelScroll(categoryScrollRef)

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      const cat = p.category || 'Sans catégorie'
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    return counts
  }, [products])

  const hasSearch = q.length > 0

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-caisse-gold">
          Catalogue
        </p>
        <div className="flex items-center gap-2">
          {hasSearch ? (
            <span className="rounded-full border border-[rgba(184,146,46,0.25)] bg-white/90 px-2.5 py-0.5 text-[10px] font-medium text-caisse-muted">
              Filtre actif
            </span>
          ) : null}
          <p className="font-mono-nums text-[12px] text-caisse-muted">
            {filtered.length} article{filtered.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div
        ref={categoryScrollRef}
        className="tabs-scroll-x mb-5 flex gap-2 overflow-x-auto pb-1"
      >
        {categoryTabs.map((tab) => {
          const on = tab === category
          const count =
            tab === 'Tous' ? products.length : categoryCounts.get(tab) ?? 0
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onCategoryChange(tab)}
              className={cn('caisse-cat-pill shrink-0', on && 'caisse-cat-pill-active')}
            >
              <span>{tab}</span>
              {count > 0 ? (
                <span
                  className={cn(
                    'ml-1.5 rounded-full px-1.5 py-px font-mono-nums text-[10px]',
                    on ? 'bg-white/70 text-caisse-gold' : 'bg-[#f7f0e3] text-caisse-muted',
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch className="text-violet-600" />}
          title="Aucun article"
          description="Affinez la recherche ou changez de catégorie."
        />
      ) : (
        <div
          className={cn(
            isCompact
              ? 'grid gap-2 grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))]'
              : 'grid gap-2 grid-cols-2 min-[400px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5',
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
                  'caisse-product-card group text-left disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.97]',
                  isCompact
                    ? 'caisse-product-card--compact flex flex-col items-center gap-1.5 p-2 text-center'
                    : 'flex min-h-28 flex-col gap-1.5 p-3',
                )}
              >
                {isCompact ? (
                  <>
                    <div className="relative">
                      <ProductImage
                        product={p}
                        className="h-10 w-10 shrink-0 rounded-lg border border-[rgba(184,146,46,0.18)] object-cover shadow-sm"
                      />
                      {state === 'rupture' ? (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#fffefb]" title="Rupture" />
                      ) : state === 'faible' ? (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-[#fffefb]" title="Stock faible" />
                      ) : null}
                    </div>
                    <p
                      className={cn(
                        'line-clamp-2 w-full font-medium leading-tight text-caisse-ink',
                        'text-[11px]',
                        disabled && 'text-[#8a919e]',
                      )}
                    >
                      {p.name}
                    </p>
                    <p className="caisse-price w-full truncate font-mono-nums text-[12px]">
                      {formatFCFA(p.priceTTC)}
                    </p>
                  </>
                ) : (
                  <>
                <div
                  className={cn(
                    'relative z-[1] flex items-start justify-between gap-1.5',
                    'mb-1',
                  )}
                >
                  <ProductImage
                    product={p}
                    className="h-14 w-14 shrink-0 rounded-lg border border-[rgba(184,146,46,0.18)] object-cover shadow-sm"
                  />
                  {state === 'rupture' ? (
                    <Badge tone="neutral">Rupture</Badge>
                  ) : state === 'faible' ? (
                    <Badge tone="warning">Faible</Badge>
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(184,146,46,0.15)] bg-white/80 text-[#c9a962] opacity-0 transition group-hover:opacity-100">
                      <IconSparkles className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'relative z-[1] line-clamp-2 text-[13px] font-medium leading-tight text-caisse-ink',
                    disabled && 'text-[#8a919e]',
                  )}
                >
                  {p.name}
                </p>
                <div className="relative z-[1] mt-0.5 flex items-baseline justify-between gap-1">
                  <p className="caisse-price min-w-0 truncate font-mono-nums text-[15px]">
                    {formatFCFA(p.priceTTC)}
                  </p>
                  <p
                    className={cn(
                      'shrink-0 font-mono-nums text-[10px] uppercase tracking-wide',
                      state === 'rupture'
                        ? 'text-rose-600'
                        : state === 'faible'
                          ? 'text-amber-700'
                          : 'text-[#8a919e]',
                    )}
                  >
                    {p.stock}
                  </p>
                </div>
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
