import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useActiveStore } from '../context/ActiveStoreContext'
import { db } from '../db/db'
import type { Product, ProductCategory, ProductWithStock } from '../db/types'
import { EditProductModal } from '../components/EditProductModal'
import { formatFCFA } from '../lib/money'
import { productImageSrc } from '../lib/productImage'
import { CATEGORY_TABS } from '../components/Sidebar'
import {
  applyProductsCsvImport,
  downloadCsvTemplate,
  parseProductsCsv,
} from '../lib/csvProducts'
import { productIsActive } from '../lib/productFilters'
import type { AuditActor } from '../lib/auditLog'
import { appendAuditEvent } from '../lib/auditLog'
import { storeStockRowId } from '../lib/storeStockId'

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
  density,
  auditActor,
  onAddClick,
}: Props) {
  const { activeStoreId, activeStore } = useActiveStore()
  const products = useLiveQuery(() => db.products.toArray(), [], []) ?? []
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
  const [cat, setCat] = useState<ProductCategory | 'Tous'>('Tous')
  const [editing, setEditing] = useState<Product | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
  }

  const handleArchive = async (p: ProductWithStock) => {
    if (
      !window.confirm(
        `Archiver « ${p.name} » ? L’article disparaîtra de la caisse mais restera dans le catalogue.`,
      )
    ) {
      return
    }
    await db.products.update(p.id, { archived: true })
  }

  const handleRestore = async (p: ProductWithStock) => {
    await db.products.update(p.id, { archived: false })
  }

  const onPickCsv = useCallback(() => {
    setImportMsg(null)
    fileRef.current?.click()
  }, [])

  const onCsvSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      e.target.value = ''
      if (!f) return
      setImportMsg(null)
      const text = await f.text()
      const { errors, rows: parsed } = parseProductsCsv(text)
      if (parsed.length === 0 && errors.length === 0) {
        setImportMsg('Aucune ligne valide dans le fichier.')
        return
      }
      const merge =
        window.confirm(
          'Mettre à jour les articles dont le code-barres existe déjà ?\n\nOK = fusion par code-barres\nAnnuler = ignorer les doublons (seules les nouvelles lignes seront importées)',
        )
      const r = await applyProductsCsvImport(parsed, {
        updateExistingByBarcode: merge,
      })
      const allErr = [...errors, ...r.errors]
      const parts = [
        `${r.created} créé(s), ${r.updated} mis à jour.`,
        allErr.length ? `${allErr.length} erreur(s).` : '',
      ]
      setImportMsg(parts.filter(Boolean).join(' '))
      if (allErr.length) {
        window.alert(
          allErr
            .slice(0, 12)
            .map((x) => `Ligne ${x.line}: ${x.message}`)
            .join('\n') + (allErr.length > 12 ? '\n…' : ''),
        )
      }
    },
    [],
  )

  return (
    <div className="space-y-6">
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            ⌕
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher nom ou code-barres…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none ring-emerald-500/30 transition focus:ring-2"
          />
        </div>
        {canManageCatalog ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-slate-300"
              />
              Afficher archivés
            </label>
            <button
              type="button"
              onClick={() => downloadCsvTemplate()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Modèle CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="Sélectionner un fichier CSV produits"
              className="hidden"
              onChange={(ev) => void onCsvSelected(ev)}
            />
            <button
              type="button"
              onClick={onPickCsv}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
            >
              Importer CSV
            </button>
            <button
              type="button"
              onClick={onAddClick}
              className="rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500"
            >
              + Nouvel article
            </button>
          </div>
        ) : null}
      </div>

      {importMsg ? (
        <p
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          role="status"
        >
          {importMsg}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(['Tous', ...CATEGORY_TABS.filter((c) => c !== 'Tous')] as const).map(
          (tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setCat(tab)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                cat === tab
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ),
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className={`w-14 px-4 ${density === 'compact' ? 'py-2.5' : 'py-3'}`}>
                  Visuel
                </th>
                <th className={`px-4 ${density === 'compact' ? 'py-2.5' : 'py-3'}`}>
                  Produit
                </th>
                <th className={`px-4 ${density === 'compact' ? 'py-2.5' : 'py-3'}`}>
                  Catégorie
                </th>
                <th
                  className={`px-4 font-mono-nums ${density === 'compact' ? 'py-2.5' : 'py-3'}`}
                >
                  Code-barres
                </th>
                <th
                  className={`px-4 text-right font-mono-nums ${density === 'compact' ? 'py-2.5' : 'py-3'}`}
                >
                  TVA
                </th>
                <th
                  className={`px-4 text-right font-mono-nums ${density === 'compact' ? 'py-2.5' : 'py-3'}`}
                >
                  Prix TTC
                </th>
                <th className={`px-4 text-right ${density === 'compact' ? 'py-2.5' : 'py-3'}`}>
                  Stock
                </th>
                <th className={`px-4 ${density === 'compact' ? 'py-2.5' : 'py-3'}`}>
                  État
                </th>
                {canManageCatalog ? (
                  <th className={`px-4 text-right ${density === 'compact' ? 'py-2.5' : 'py-3'}`}>
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`transition hover:bg-emerald-50/40 ${
                    p.archived ? 'opacity-70' : ''
                  }`}
                >
                  <td className={`px-4 ${density === 'compact' ? 'py-1.5' : 'py-2.5'}`}>
                    <img
                      src={productImageSrc(p)}
                      alt={p.name}
                      className={`rounded-lg border border-slate-200 object-cover ${
                        density === 'compact' ? 'h-9 w-9' : 'h-10 w-10'
                      }`}
                    />
                  </td>
                  <td
                    className={`px-4 font-medium text-slate-900 ${
                      density === 'compact' ? 'py-2 text-sm' : 'py-3'
                    }`}
                  >
                    {p.name}
                  </td>
                  <td className={`px-4 text-slate-600 ${density === 'compact' ? 'py-2' : 'py-3'}`}>
                    {p.category}
                  </td>
                  <td
                    className={`px-4 font-mono-nums text-slate-600 ${
                      density === 'compact' ? 'py-2' : 'py-3'
                    }`}
                  >
                    {p.barcode}
                  </td>
                  <td
                    className={`px-4 text-right font-mono-nums text-slate-600 ${
                      density === 'compact' ? 'py-2' : 'py-3'
                    }`}
                  >
                    {p.vatRatePct ?? 18} %
                  </td>
                  <td
                    className={`px-4 text-right font-mono-nums font-medium text-emerald-700 ${
                      density === 'compact' ? 'py-2' : 'py-3'
                    }`}
                  >
                    {formatFCFA(p.priceTTC)}
                  </td>
                  <td className={`px-4 text-right ${density === 'compact' ? 'py-2' : 'py-3'}`}>
                    <span
                      className={`inline-flex min-w-10 justify-end rounded-lg px-2 py-0.5 font-mono-nums text-xs font-semibold ${
                        p.stock <= 0
                          ? 'bg-slate-200 text-slate-700'
                          : p.stock <= p.lowStockThreshold
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {p.stock}
                    </span>
                  </td>
                  <td className={`px-4 ${density === 'compact' ? 'py-2' : 'py-3'}`}>
                    {p.archived ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                        Archivé
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-900">
                        Actif
                      </span>
                    )}
                  </td>
                  {canManageCatalog ? (
                    <td className={`px-4 text-right ${density === 'compact' ? 'py-2' : 'py-3'}`}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(p)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Modifier
                        </button>
                        {p.archived ? (
                          <button
                            type="button"
                            onClick={() => void handleRestore(p)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                          >
                            Réactiver
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleArchive(p)}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                          >
                            Archiver
                          </button>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucun article ne correspond aux filtres.
          </p>
        ) : null}
      </div>

      {canManageCatalog ? (
        <p className="text-xs text-slate-500">
          Import CSV : séparateur virgule ou point-virgule, en-têtes{' '}
          <code className="rounded bg-slate-100 px-1">nom</code>,{' '}
          <code className="rounded bg-slate-100 px-1">prix_ttc</code>,{' '}
          <code className="rounded bg-slate-100 px-1">code_barres</code>,{' '}
          <code className="rounded bg-slate-100 px-1">categorie</code>,{' '}
          <code className="rounded bg-slate-100 px-1">stock</code>,{' '}
          <code className="rounded bg-slate-100 px-1">seuil</code>,{' '}
          <code className="rounded bg-slate-100 px-1">tva_pct</code> (optionnel
          : <code className="rounded bg-slate-100 px-1">archive</code>,{' '}
          <code className="rounded bg-slate-100 px-1">image_url</code>). La
          colonne <code className="rounded bg-slate-100 px-1">stock</code> est
          appliquée au <strong>magasin principal</strong> (réseau multi-magasins).
        </p>
      ) : null}

      {!canManageCatalog ? (
        <p className="text-center text-xs text-slate-400">
          Lecture seule — contactez un gérant ou un administrateur pour modifier le
          catalogue.
        </p>
      ) : null}
    </div>
  )
}
