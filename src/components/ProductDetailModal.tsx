import { useEffect, useMemo, useState } from 'react'
import type { ProductWithStock } from '../db/types'
import { formatFCFA } from '../lib/money'
import {
  productDescription,
  productHighlights,
} from '../lib/productDescription'
import { Badge } from '../ui/Badge'
import { cn } from '../ui/cn'
import {
  IconCheckCircle,
  IconClose,
  IconMinus,
  IconPlus,
  IconTag,
} from '../ui/icons'
import { ProductImage } from './ProductImage'

type Props = {
  /** Produit affiché ; `null` = fermé */
  product: ProductWithStock | null
  /** Quantité déjà dans le panier pour ce produit (affichage). */
  cartQty?: number
  /** Produits du même univers, pour la section « Vous aimerez aussi ». */
  allProducts?: ProductWithStock[]
  onClose: () => void
  /** Ajoute `qty` unités au panier ; si non fourni, le bouton est masqué. */
  onAdd?: (product: ProductWithStock, qty: number) => void
  /** Clic sur une suggestion : remplace le produit affiché. */
  onSelect?: (product: ProductWithStock) => void
  /** Contexte de surface : définit le thème (vitrine dark / back-office clair). */
  variant?: 'storefront' | 'backoffice'
}

type OpenProps = Omit<Props, 'product'> & { product: ProductWithStock }

export function ProductDetailModal(props: Props) {
  if (!props.product) return null
  return (
    <ProductDetailModalContent
      key={props.product.id}
      {...props}
      product={props.product}
    />
  )
}

function ProductDetailModalContent({
  product,
  cartQty = 0,
  allProducts,
  onClose,
  onAdd,
  onSelect,
  variant = 'backoffice',
}: OpenProps) {
  const [qty, setQty] = useState(1)

  useEffect(() => {
    if (!product) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [product, onClose])

  const related = useMemo(() => {
    if (!product || !allProducts) return []
    return allProducts
      .filter(
        (p) =>
          p.id !== product.id &&
          p.category === product.category &&
          p.stock > 0 &&
          !p.archived,
      )
      .slice(0, 4)
  }, [product, allProducts])

  const description = productDescription(product)
  const highlights = productHighlights(product)
  const soldOut = product.stock <= 0
  const maxQty = product.stock
  const canAddMore = qty + cartQty <= product.stock

  // Storefront uses the warm light commerce theme; backoffice stays light zinc.
  const isDark = false
  const isStorefront = variant === 'storefront'

  const surface = isStorefront
    ? 'bg-[#FFFcf7] border-stone-200 text-stone-900'
    : 'bg-white border-zinc-200 text-zinc-900'
  const sub = isStorefront ? 'text-stone-500' : 'text-zinc-500'
  const strong = isStorefront ? 'text-stone-900' : 'text-zinc-900'
  const eyebrow = isStorefront
    ? 'text-stone-500'
    : 'text-zinc-500'
  const chip = isStorefront
    ? 'border-stone-200 bg-stone-50 text-stone-700'
    : 'border-zinc-200 bg-zinc-50 text-zinc-700'

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 animate-ui-fade-in bg-zinc-950/60 backdrop-blur-[3px]"
      />

      <div
        className={cn(
          'relative z-10 flex max-h-[calc(100svh-1rem)] w-full max-w-3xl animate-ui-scale-in flex-col overflow-hidden rounded-2xl border shadow-[var(--shadow-overlay)] sm:max-h-[calc(100svh-2rem)]',
          surface,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className={cn(
            'absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition',
            isDark
              ? 'bg-black/45 text-slate-100 hover:bg-black/65'
              : 'bg-white/85 text-zinc-700 hover:bg-white',
          )}
        >
          <IconClose className="h-4 w-4" />
        </button>

        <div className="ui-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-0 md:grid-cols-2">
            {/* Image hero */}
            <div
              className={cn(
                'relative aspect-[4/3] w-full overflow-hidden md:aspect-auto md:h-full md:min-h-[360px]',
                isDark ? 'bg-slate-900' : 'bg-zinc-100',
              )}
            >
              <ProductImage
                product={product}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className={cn(
                  'pointer-events-none absolute inset-0',
                  isDark
                    ? 'bg-linear-to-t from-black/50 via-transparent to-transparent'
                    : 'bg-linear-to-t from-black/10 via-transparent to-transparent',
                )}
              />
              {soldOut ? (
                <span className="absolute left-3 top-3 rounded-full bg-zinc-900/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                  Rupture
                </span>
              ) : (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-semibold text-white">
                  <IconCheckCircle className="h-3 w-3" />
                  {product.stock} en stock
                </span>
              )}
            </div>

            {/* Corps */}
            <div className="flex min-w-0 flex-col gap-4 p-5 sm:p-6">
              <div>
                <h2
                  id="product-detail-title"
                  className={cn(
                    'text-xl font-semibold tracking-tight sm:text-2xl',
                    strong,
                  )}
                  style={{ textWrap: 'balance' } as React.CSSProperties}
                >
                  {product.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-baseline gap-3">
                  <span
                    className={cn(
                      'font-mono-nums text-2xl font-bold tracking-tight sm:text-3xl',
                      isStorefront ? 'text-stone-900' : 'text-emerald-600',
                    )}
                  >
                    {formatFCFA(product.priceTTC)}
                  </span>
                </div>
              </div>

              <p
                className={cn(
                  'whitespace-pre-line text-[13px] leading-relaxed sm:text-sm',
                  isDark ? 'text-slate-300' : 'text-zinc-600',
                )}
              >
                {description}
              </p>

              {highlights.length > 0 ? (
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {highlights.map((h) => (
                    <li
                      key={h}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[12px]',
                        chip,
                      )}
                    >
                      <IconCheckCircle
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 shrink-0',
                          isDark ? 'text-emerald-300' : 'text-emerald-600',
                        )}
                      />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* Specs */}
              <dl
                className={cn(
                  'grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border px-3 py-3 text-[12px]',
                  isDark
                    ? 'border-white/10 bg-slate-900/50'
                    : 'border-zinc-200 bg-zinc-50',
                )}
              >
                <div>
                  <dt className={cn('text-[10px] uppercase tracking-wider', sub)}>
                    Stock
                  </dt>
                  <dd className={cn('mt-0.5 font-mono-nums', strong)}>
                    {product.stock} unité{product.stock > 1 ? 's' : ''}
                  </dd>
                </div>
                {product.lowStockThreshold ? (
                  <div>
                    <dt
                      className={cn(
                        'text-[10px] uppercase tracking-wider',
                        sub,
                      )}
                    >
                      Seuil d’alerte
                    </dt>
                    <dd className={cn('mt-0.5 font-mono-nums', strong)}>
                      {product.lowStockThreshold}
                    </dd>
                  </div>
                ) : null}
                {product.archived ? (
                  <div>
                    <dt
                      className={cn(
                        'text-[10px] uppercase tracking-wider',
                        sub,
                      )}
                    >
                      État
                    </dt>
                    <dd className="mt-0.5">
                      <Badge tone="neutral">Archivé</Badge>
                    </dd>
                  </div>
                ) : null}
              </dl>

              {/* Qty + CTA */}
              {onAdd && !soldOut && !product.archived ? (
                <div
                  className={cn(
                    'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
                  )}
                >
                  <div
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg border p-1',
                      isDark
                        ? 'border-white/15 bg-slate-900/70'
                        : 'border-zinc-200 bg-white',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setQty((v) => Math.max(1, v - 1))}
                      disabled={qty <= 1}
                      aria-label="Diminuer"
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40',
                        isDark
                          ? 'text-slate-200 hover:bg-slate-800'
                          : 'text-zinc-700 hover:bg-zinc-100',
                      )}
                    >
                      <IconMinus className="h-4 w-4" />
                    </button>
                    <span
                      className={cn(
                        'min-w-[2.5rem] text-center font-mono-nums text-[14px] font-bold',
                        strong,
                      )}
                    >
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQty((v) =>
                          Math.min(maxQty - cartQty, Math.max(1, v + 1)),
                        )
                      }
                      disabled={qty + cartQty >= maxQty}
                      aria-label="Augmenter"
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40',
                        isDark
                          ? 'text-slate-200 hover:bg-slate-800'
                          : 'text-zinc-700 hover:bg-zinc-100',
                      )}
                    >
                      <IconPlus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={!canAddMore}
                    onClick={() => {
                      onAdd(product, qty)
                      onClose()
                    }}
                    className={cn(
                      'inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
                      isStorefront
                        ? 'storefront-btn-accent'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800',
                    )}
                  >
                    <IconTag className="h-4 w-4" />
                    Ajouter au panier
                    <span className="ml-1 font-mono-nums">
                      {formatFCFA(product.priceTTC * qty)}
                    </span>
                  </button>
                </div>
              ) : soldOut ? (
                <div
                  className={cn(
                    'rounded-xl border px-3 py-2 text-[12px]',
                    isDark
                      ? 'border-white/10 bg-slate-900/50 text-slate-300'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600',
                  )}
                >
                  Article indisponible actuellement. Repassez plus tard ou
                  contactez-nous.
                </div>
              ) : null}

              {cartQty > 0 ? (
                <p
                  className={cn(
                    'text-[11px]',
                    isDark ? 'text-amber-200' : 'text-emerald-700',
                  )}
                >
                  Déjà dans votre panier :{' '}
                  <span className="font-mono-nums font-bold">{cartQty}</span>{' '}
                  unité{cartQty > 1 ? 's' : ''}
                </p>
              ) : null}
            </div>
          </div>

          {related.length > 0 ? (
            <div
              className={cn(
                'border-t px-5 py-5 sm:px-6',
                isDark ? 'border-white/10' : 'border-zinc-100',
              )}
            >
              <p
                className={cn(
                  'text-[10px] font-bold uppercase tracking-[0.22em]',
                  eyebrow,
                )}
              >
                Vous aimerez aussi
              </p>
              <h3 className={cn('mt-1 text-[15px] font-semibold', strong)}>
                Suggestions
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {related.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelect?.(r)}
                    disabled={!onSelect}
                    className={cn(
                      'group overflow-hidden rounded-xl border text-left transition',
                      isDark
                        ? 'border-white/10 bg-slate-900/60 hover:border-amber-200/40'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md',
                      !onSelect && 'cursor-default',
                    )}
                  >
                    <ProductImage
                      product={r}
                      className="h-20 w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                    />
                    <div className="p-2">
                      <p
                        className={cn(
                          'line-clamp-2 text-[11px] font-semibold',
                          strong,
                        )}
                      >
                        {r.name}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 font-mono-nums text-[12px] font-bold',
                          isDark ? 'text-emerald-400' : 'text-emerald-600',
                        )}
                      >
                        {formatFCFA(r.priceTTC)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
