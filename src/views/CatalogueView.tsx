import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useActiveStore } from '../context/ActiveStoreContext'
import { addProductCategoryLabel, db } from '../db/db'
import type { CategoryTab } from '../components/Sidebar'
import type { Product, ProductWithStock } from '../db/types'
import { EditProductModal } from '../components/EditProductModal'
import { formatFCFA } from '../lib/money'
import { ProductImage } from '../components/ProductImage'
import { ProductDetailModal } from '../components/ProductDetailModal'
import {
  applyProductsCsvImport,
  downloadCsvTemplate,
  parseProductsCsv,
} from '../lib/csvProducts'
import { productIsActive } from '../lib/productFilters'
import type { AuditActor } from '../lib/auditLog'
import { appendAuditEvent } from '../lib/auditLog'
import { storeStockRowId } from '../lib/storeStockId'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { cn } from '../ui/cn'
import { EmptyState } from '../ui/EmptyState'
import { Field, Input } from '../ui/Input'
import { PageHeader } from '../ui/PageHeader'
import { Switch } from '../ui/Switch'
import { Table, TBody, Td, Th, THead, Tr } from '../ui/Table'
import { useToast } from '../ui/Toast'
import {
  IconArchive,
  IconDownload,
  IconEdit,
  IconEye,
  IconPlus,
  IconRefund,
  IconSearch,
  IconUpload,
} from '../ui/icons'

type Props = {
  canManageCatalog: boolean
  canEditPrices: boolean
  density: 'compact' | 'confort'
  auditActor: AuditActor
  onAddClick: () => void
}

export function CatalogueView({
  canManageCatalog,
  canEditPrices,
  density: _density,
  auditActor,
  onAddClick,
}: Props) {
  void _density
  const { activeStoreId, activeStore } = useActiveStore()
  const toast = useToast()
  const products = useLiveQuery(() => db.products.toArray(), [], []) ?? []
  const productCategoryRows =
    useLiveQuery(
      () => db.productCategories.orderBy('sortOrder').toArray(),
      [],
      [],
    ) ?? []
  const categoryTabs = useMemo<CategoryTab[]>(
    () => ['Tous', ...productCategoryRows.map((r) => r.name)],
    [productCategoryRows],
  )
  const stockRows =
    useLiveQuery(
      () => db.storeStocks.where('storeId').equals(activeStoreId).toArray(),
      [activeStoreId],
      [],
    ) ?? []
  const rowsWithStock = useMemo((): ProductWithStock[] => {
    const m = new Map(stockRows.map((r) => [r.productId, r.stock]))
    return products.map((p) => ({ ...p, stock: m.get(p.id) ?? 0 }))
  }, [products, stockRows])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CategoryTab>('Tous')
  const [editing, setEditing] = useState<Product | null>(null)
  const [detailProduct, setDetailProduct] =
    useState<ProductWithStock | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryAddBusy, setCategoryAddBusy] = useState(false)
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null)
  const [pendingArchiveUntil, setPendingArchiveUntil] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (categoryTabs.length === 0) return
    if (!categoryTabs.includes(cat)) setCat('Tous')
  }, [categoryTabs, cat])

  const handleAddCategory = useCallback(async () => {
    setCategoryAddBusy(true)
    try {
      const name = await addProductCategoryLabel(newCategoryName)
      setNewCategoryName('')
      setCat(name)
      toast.success('Catégorie ajoutée', name)
    } catch (e) {
      toast.error(
        'Catégorie invalide',
        e instanceof Error ? e.message : String(e),
      )
    } finally {
      setCategoryAddBusy(false)
    }
  }, [newCategoryName, toast])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return rowsWithStock
      .filter((p) => (showArchived ? true : productIsActive(p)))
      .filter((p) => (cat === 'Tous' ? true : p.category === cat))
      .filter(
        (p) =>
          !t ||
          p.name.toLowerCase().includes(t) ||
          p.barcode.includes(t),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [rowsWithStock, q, cat, showArchived])

  const handleSaveEdit = async (p: Product, stockAtStore: number) => {
    const dup = await db.products
      .where('barcode')
      .equals(p.barcode)
      .first()
    if (dup && dup.id !== p.id) {
      throw new Error('Ce code-barres est déjà utilisé.')
    }
    const prevRow = rowsWithStock.find((r) => r.id === p.id)
    const previousQty = prevRow?.stock ?? 0
    const previousThreshold = prevRow?.lowStockThreshold ?? p.lowStockThreshold
    await db.products.put(p)
    await db.storeStocks.put({
      id: storeStockRowId(activeStoreId, p.id),
      storeId: activeStoreId,
      productId: p.id,
      stock: stockAtStore,
    })
    const stockChanged = previousQty !== stockAtStore
    const thresholdChanged = previousThreshold !== p.lowStockThreshold
    if (stockChanged || thresholdChanged) {
      void appendAuditEvent({
        kind: 'stock_adjusted',
        actor: auditActor,
        reason: stockChanged
          ? `Catalogue : stock « ${p.name} » ${previousQty} → ${stockAtStore}`
          : `Catalogue : seuil d’alerte « ${p.name} » ${previousThreshold} → ${p.lowStockThreshold}`,
        payload: {
          source: 'catalogue_edit',
          storeId: activeStoreId,
          storeName: activeStore?.name,
          productId: p.id,
          productName: p.name,
          barcode: p.barcode,
          previousQty,
          newQty: stockAtStore,
          previousLowStockThreshold: previousThreshold,
          newLowStockThreshold: p.lowStockThreshold,
        },
      })
    }
    toast.success('Article enregistré', p.name)
  }

  const handleArchive = async (p: ProductWithStock) => {
    const now = new Date().getTime()
    if (pendingArchiveId !== p.id || now > pendingArchiveUntil) {
      setPendingArchiveId(p.id)
      setPendingArchiveUntil(now + 7000)
      toast.warning(
        'Confirmer archivage',
        `Cliquez encore sur "Archiver" pour ${p.name} (7s).`,
      )
      return
    }
    await db.products.update(p.id, { archived: true })
    setPendingArchiveId(null)
    setPendingArchiveUntil(0)
    toast.info('Article archivé', p.name)
  }

  const handleRestore = async (p: ProductWithStock) => {
    await db.products.update(p.id, { archived: false })
    toast.success('Article réactivé', p.name)
  }

  const onPickCsv = useCallback(() => {
    fileRef.current?.click()
  }, [])

  const onCsvSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      e.target.value = ''
      if (!f) return
      const text = await f.text()
      const { errors, rows: parsed } = parseProductsCsv(text)
      if (parsed.length === 0 && errors.length === 0) {
        toast.warning('Import CSV', 'Aucune ligne valide dans le fichier.')
        return
      }
      const merge = true
      const r = await applyProductsCsvImport(parsed, {
        updateExistingByBarcode: merge,
      })
      const allErr = [...errors, ...r.errors]
      const summary = `${r.created} créé(s), ${r.updated} mis à jour${
        allErr.length ? ` · ${allErr.length} erreur(s)` : ''
      }.`
      if (allErr.length) {
        const details = allErr
          .slice(0, 4)
          .map((x) => `L${x.line}: ${x.message}`)
          .join(' | ')
        toast.warning('Import partiel', `${summary} ${details}`)
      } else {
        toast.success('Import CSV', summary)
      }
    },
    [toast],
  )

  return (
    <div className="space-y-5 pb-6">
      {editing ? (
        <EditProductModal
          product={editing}
          canEditPrices={canEditPrices}
          stockAtActiveStore={
            rowsWithStock.find((r) => r.id === editing.id)?.stock ?? 0
          }
          activeStoreLabel={activeStore?.name ?? 'Magasin'}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      ) : null}

      <PageHeader
        eyebrow="Catalogue"
        title="Articles & catégories"
        subtitle="Prix, codes-barres, TVA, image et stocks par magasin"
        actions={
          canManageCatalog ? (
            <>
              <Switch
                label="Archivés"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              <Button
                size="sm"
                variant="secondary"
                iconLeft={<IconDownload />}
                onClick={() => downloadCsvTemplate()}
              >
                Modèle
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="Sélectionner un fichier CSV produits"
                className="hidden"
                onChange={(ev) => void onCsvSelected(ev)}
              />
              <Button
                size="sm"
                variant="secondary"
                iconLeft={<IconUpload />}
                onClick={onPickCsv}
              >
                Importer CSV
              </Button>
              <Button
                size="sm"
                variant="accent"
                iconLeft={<IconPlus />}
                onClick={onAddClick}
              >
                Nouvel article
              </Button>
            </>
          ) : null
        }
      />

      <Card>
        <CardContent className="space-y-3">
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un article ou un code-barres…"
            iconLeft={<IconSearch />}
          />
          <div className="ui-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {categoryTabs.map((tab) => {
              const on = cat === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCat(tab)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition',
                    on
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                  )}
                >
                  {tab}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {canManageCatalog ? (
        <Card>
          <CardContent>
            <Field label="Nouvelle catégorie">
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ex. Épicerie fine, Cosmétiques…"
                />
                <Button
                  variant="primary"
                  loading={categoryAddBusy}
                  disabled={!newCategoryName.trim()}
                  onClick={() => void handleAddCategory()}
                >
                  Ajouter
                </Button>
              </div>
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch />}
          title="Aucun article"
          description="Affinez la recherche, changez de catégorie ou affichez les archivés."
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table minWidth={760}>
              <THead>
                <Tr hover={false}>
                  <Th className="w-[60px]">Visuel</Th>
                  <Th>Produit</Th>
                  <Th hideBelow="lg">Catégorie</Th>
                  <Th hideBelow="lg">Code-barres</Th>
                  <Th align="right" hideBelow="xl">
                    TVA
                  </Th>
                  <Th align="right">Prix TTC</Th>
                  <Th align="right">Stock</Th>
                  <Th hideBelow="lg">État</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {filtered.map((p) => {
                  const stockTone =
                    p.stock <= 0
                      ? 'neutral'
                      : p.stock <= p.lowStockThreshold
                        ? 'warning'
                        : 'neutral'
                  return (
                    <Tr key={p.id} className={p.archived ? 'opacity-70' : ''}>
                      <Td>
                        <ProductImage
                          product={p}
                          className="h-9 w-9 rounded-md border border-zinc-200 object-cover"
                        />
                      </Td>
                      <Td className="font-medium text-zinc-900">
                        {p.name}
                        <span className="mt-0.5 block text-[11px] font-normal text-zinc-500 lg:hidden">
                          <span className="font-mono-nums font-semibold text-emerald-600">
                            {formatFCFA(p.priceTTC)}
                          </span>
                          <span>
                            {' '}
                            · <span className="font-mono-nums">{p.barcode}</span>
                          </span>
                        </span>
                      </Td>
                      <Td hideBelow="lg">{p.category}</Td>
                      <Td hideBelow="lg" mono className="text-zinc-500">
                        {p.barcode}
                      </Td>
                      <Td align="right" hideBelow="xl" mono>
                        {p.vatRatePct ?? 18} %
                      </Td>
                      <Td
                        align="right"
                        mono
                        className="font-semibold text-zinc-900"
                      >
                        {formatFCFA(p.priceTTC)}
                      </Td>
                      <Td align="right">
                        <Badge tone={stockTone}>
                          <span className="font-mono-nums">{p.stock}</span>
                        </Badge>
                      </Td>
                      <Td hideBelow="lg">
                        {p.archived ? (
                          <Badge tone="neutral">Archivé</Badge>
                        ) : (
                          <Badge tone="success">Actif</Badge>
                        )}
                      </Td>
                      <Td align="right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<IconEye />}
                            onClick={() => setDetailProduct(p)}
                            aria-label="Voir les détails"
                          >
                            <span className="hidden xl:inline">Détails</span>
                          </Button>
                          {canManageCatalog ? (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                iconLeft={<IconEdit />}
                                onClick={() => setEditing(p)}
                              >
                                Modifier
                              </Button>
                              {p.archived ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  iconLeft={<IconRefund />}
                                  onClick={() => void handleRestore(p)}
                                >
                                  Réactiver
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  iconLeft={<IconArchive />}
                                  onClick={() => void handleArchive(p)}
                                >
                                  Archiver
                                </Button>
                              )}
                            </>
                          ) : null}
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
              </TBody>
            </Table>
          </div>

          <ul className="grid gap-2 md:hidden">
            {filtered.map((p) => {
              const stockTone =
                p.stock <= 0
                  ? 'neutral'
                  : p.stock <= p.lowStockThreshold
                    ? 'warning'
                    : 'neutral'
              return (
                <li
                  key={p.id}
                  className={cn(
                    'ui-card flex items-start gap-3 p-3',
                    p.archived && 'opacity-70',
                  )}
                >
                  <ProductImage
                    product={p}
                    className="h-12 w-12 shrink-0 rounded-md border border-zinc-200 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-900">
                        {p.name}
                      </p>
                      <span className="shrink-0 font-mono-nums text-[13px] font-bold text-zinc-900">
                        {formatFCFA(p.priceTTC)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {p.category} · <span className="font-mono-nums">{p.barcode}</span> · TVA{' '}
                      {p.vatRatePct ?? 18} %
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={stockTone}>
                        <span className="font-mono-nums">{p.stock}</span> stock
                      </Badge>
                      {p.archived ? (
                        <Badge tone="neutral">Archivé</Badge>
                      ) : (
                        <Badge tone="success">Actif</Badge>
                      )}
                      <div className="ml-auto flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          iconLeft={<IconEye />}
                          onClick={() => setDetailProduct(p)}
                          aria-label="Voir le détail"
                        />
                        {canManageCatalog ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              iconLeft={<IconEdit />}
                              onClick={() => setEditing(p)}
                              aria-label="Modifier"
                            />
                            {p.archived ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                iconLeft={<IconRefund />}
                                onClick={() => void handleRestore(p)}
                                aria-label="Réactiver"
                              />
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                iconLeft={<IconArchive />}
                                onClick={() => void handleArchive(p)}
                                aria-label="Archiver"
                              />
                            )}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {canManageCatalog ? (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Import CSV : séparateur virgule ou point-virgule, en-têtes{' '}
          <code className="ui-kbd">nom</code>,{' '}
          <code className="ui-kbd">prix_ttc</code>,{' '}
          <code className="ui-kbd">code_barres</code>,{' '}
          <code className="ui-kbd">categorie</code>,{' '}
          <code className="ui-kbd">stock</code>,{' '}
          <code className="ui-kbd">seuil</code>,{' '}
          <code className="ui-kbd">tva_pct</code> (optionnel{' '}
          <code className="ui-kbd">archive</code>,{' '}
          <code className="ui-kbd">image_url</code>). Le stock est appliqué au{' '}
          <strong>magasin principal</strong>.
        </p>
      ) : (
        <p className="text-center text-[11px] text-zinc-400">
          Lecture seule — contactez un gérant ou un administrateur pour modifier.
        </p>
      )}

      <ProductDetailModal
        product={detailProduct}
        allProducts={rowsWithStock.filter((p) => !p.archived)}
        variant="backoffice"
        onClose={() => setDetailProduct(null)}
        onSelect={(p) => setDetailProduct(p)}
      />
    </div>
  )
}
