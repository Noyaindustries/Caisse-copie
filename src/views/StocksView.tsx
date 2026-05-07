import { useLiveQuery } from 'dexie-react-hooks'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { useActiveStore } from '../context/ActiveStoreContext'
import { db } from '../db/db'
import type {
  KitchenStockUnit,
  ProductWithStock,
} from '../db/types'
import { downloadTextFile, toCsvSemicolon } from '../lib/analyticsExport'
import { formatFCFA } from '../lib/money'
import { productIsActive } from '../lib/productFilters'
import { storeStockRowId } from '../lib/storeStockId'
import { locationStockRowId } from '../lib/locationStockId'
import type { AuditActor } from '../lib/auditLog'
import { appendAuditEvent } from '../lib/auditLog'
import { enqueueStockSync } from '../lib/sync'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { cn } from '../ui/cn'
import { EmptyState } from '../ui/EmptyState'
import { Field, Input, Select } from '../ui/Input'
import { Kpi } from '../ui/Kpi'
import { PageHeader } from '../ui/PageHeader'
import { Switch } from '../ui/Switch'
import { Tabs } from '../ui/Tabs'
import { useToast } from '../ui/Toast'
import {
  IconAlert,
  IconCheckCircle,
  IconDownload,
  IconScan,
  IconSearch,
  IconStocks,
} from '../ui/icons'

type Props = { isAdmin: boolean; auditActor: AuditActor }

type StockFilter = 'tous' | 'rupture' | 'alerte' | 'ok'

function urgency(p: ProductWithStock): number {
  if (p.stock <= 0) return 0
  if (p.stock <= p.lowStockThreshold) return 1
  return 2
}

export function StocksView({ isAdmin, auditActor }: Props) {
  const { activeStoreId, activeStore } = useActiveStore()
  const toast = useToast()
  const products = useLiveQuery(() => db.products.toArray(), [], []) ?? []
  const stockRows =
    useLiveQuery(
      () => db.storeStocks.where('storeId').equals(activeStoreId).toArray(),
      [activeStoreId],
      [],
    ) ?? []
  const stockLocations =
    useLiveQuery(
      () =>
        db.stockLocations.where('storeId').equals(activeStoreId).sortBy('sortOrder'),
      [activeStoreId],
      [],
    ) ?? []
  const locationStocks =
    useLiveQuery(
      () => db.locationStocks.where('storeId').equals(activeStoreId).toArray(),
      [activeStoreId],
      [],
    ) ?? []
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all')
  const mergedProducts = useMemo((): ProductWithStock[] => {
    const m =
      selectedLocationId === 'all'
        ? new Map(stockRows.map((r) => [r.productId, r.stock]))
        : new Map(
            locationStocks
              .filter((r) => r.locationId === selectedLocationId)
              .map((r) => [r.productId, r.stock]),
          )
    return products.map((p) => ({ ...p, stock: m.get(p.id) ?? 0 }))
  }, [products, stockRows, locationStocks, selectedLocationId])
  const [showArchived, setShowArchived] = useState(false)
  const [filter, setFilter] = useState<StockFilter>('tous')
  const [q, setQ] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stockInput, setStockInput] = useState('')
  const [thresholdInput, setThresholdInput] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [quickBarcode, setQuickBarcode] = useState('')
  const [quickQty, setQuickQty] = useState('')
  const [quickBusy, setQuickBusy] = useState(false)
  const [bulkQty, setBulkQty] = useState('10')
  const [bulkBusy, setBulkBusy] = useState(false)
  const kitchenIngredients = useLiveQuery(() => db.kitchenIngredients.toArray(), [], []) ?? []
  const kitchenIngredientStocks =
    useLiveQuery(
      () => db.kitchenIngredientStocks.where('storeId').equals(activeStoreId).toArray(),
      [activeStoreId],
      [],
    ) ?? []
  const recipeRows = useLiveQuery(() => db.productRecipeIngredients.toArray(), [], []) ?? []
  const [ingredientName, setIngredientName] = useState('')
  const [ingredientUnit, setIngredientUnit] = useState<KitchenStockUnit>('piece')
  const [ingredientStock, setIngredientStock] = useState('0')
  const [ingredientThreshold, setIngredientThreshold] = useState('0')
  const [recipeProductId, setRecipeProductId] = useState('')
  const [recipeIngredientId, setRecipeIngredientId] = useState('')
  const [recipeQtyPerUnit, setRecipeQtyPerUnit] = useState('')
  const auditRows = useLiveQuery(
    () => db.auditEvents.orderBy('createdAt').reverse().limit(200).toArray(),
    [],
    [],
  )

  useEffect(() => {
    if (selectedLocationId === 'all') return
    if (!stockLocations.some((l) => l.id === selectedLocationId)) {
      setSelectedLocationId('all')
    }
  }, [selectedLocationId, stockLocations])

  const visibleProducts = useMemo(
    () =>
      showArchived
        ? mergedProducts
        : mergedProducts.filter((p) => productIsActive(p)),
    [mergedProducts, showArchived],
  )

  const stats = useMemo(() => {
    const rupture = visibleProducts.filter((p) => p.stock <= 0).length
    const low = visibleProducts.filter(
      (p) => p.stock > 0 && p.stock <= p.lowStockThreshold,
    ).length
    const ok = visibleProducts.length - rupture - low
    return { rupture, low, ok, total: visibleProducts.length }
  }, [visibleProducts])
  const stockValuation = useMemo(() => {
    return visibleProducts.reduce((sum, p) => sum + p.stock * p.priceTTC, 0)
  }, [visibleProducts])
  const ruptureValuation = useMemo(() => {
    return visibleProducts
      .filter((p) => p.stock <= 0)
      .reduce((sum, p) => sum + p.priceTTC, 0)
  }, [visibleProducts])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    let list = [...visibleProducts]
    if (filter === 'rupture') list = list.filter((p) => p.stock <= 0)
    else if (filter === 'alerte')
      list = list.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold)
    else if (filter === 'ok')
      list = list.filter((p) => p.stock > p.lowStockThreshold)
    if (t) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(t) ||
          p.barcode.toLowerCase().includes(t),
      )
    }
    return list.sort((a, b) => {
      const ua = urgency(a)
      const ub = urgency(b)
      if (ua !== ub) return ua - ub
      return a.stock - b.stock
    })
  }, [visibleProducts, filter, q])

  const stockMovements = useMemo(() => {
    const rows = auditRows ?? []
    return rows
      .filter((ev) => ev.kind === 'stock_adjusted')
      .map((ev) => {
        try {
          const payload = JSON.parse(ev.payloadJson) as {
            storeId?: string
            productName?: string
            previousQty?: number
            newQty?: number
            source?: string
          }
          if (payload.storeId !== activeStoreId) return null
          return {
            id: ev.id,
            createdAt: ev.createdAt,
            actorDisplayName: ev.actorDisplayName,
            reason: ev.reason,
            productName: payload.productName ?? 'Article',
            previousQty:
              typeof payload.previousQty === 'number' ? payload.previousQty : null,
            newQty: typeof payload.newQty === 'number' ? payload.newQty : null,
            source: payload.source ?? 'manual',
          }
        } catch {
          return null
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 20)
  }, [auditRows, activeStoreId])

  const kitchenRows = useMemo(() => {
    const stockByIngredient = new Map(
      kitchenIngredientStocks.map((row) => [row.ingredientId, row.stock]),
    )
    return kitchenIngredients
      .filter((x) => !x.archived)
      .map((ing) => ({
        ...ing,
        stock: stockByIngredient.get(ing.id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [kitchenIngredients, kitchenIngredientStocks])
  const productNameById = useMemo(
    () => new Map(products.map((p) => [p.id, p.name])),
    [products],
  )
  const ingredientNameById = useMemo(
    () => new Map(kitchenIngredients.map((i) => [i.id, i.name])),
    [kitchenIngredients],
  )

  const pushStockCloud = useCallback(
    async (p: ProductWithStock) => {
      await enqueueStockSync({
        productId: p.id,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        storeId: activeStoreId,
      })
    },
    [activeStoreId],
  )

  const recomputeAndWriteStoreStock = useCallback(
    async (productId: string) => {
      const rows = await db.locationStocks
        .where('[storeId+productId]')
        .equals([activeStoreId, productId])
        .toArray()
      const total = rows.reduce((sum, r) => sum + r.stock, 0)
      await db.storeStocks.put({
        id: storeStockRowId(activeStoreId, productId),
        storeId: activeStoreId,
        productId,
        stock: total,
      })
      return total
    },
    [activeStoreId],
  )

  const adjust = useCallback(
    async (id: string, delta: number) => {
      if (selectedLocationId === 'all') {
        toast.error('Choisissez un emplacement', 'Sélectionnez Réserve ou Surface pour ajuster.')
        return
      }
      const p = mergedProducts.find((x) => x.id === id)
      if (!p) return
      const previousQty = p.stock
      const next = Math.max(0, p.stock + delta)
      setBusyId(id)
      try {
        await db.locationStocks.put({
          id: locationStockRowId(activeStoreId, selectedLocationId, id),
          storeId: activeStoreId,
          locationId: selectedLocationId,
          productId: id,
          stock: next,
        })
        const totalStock = await recomputeAndWriteStoreStock(id)
        const updated = { ...p, stock: totalStock }
        if (isAdmin) await pushStockCloud(updated)
        void appendAuditEvent({
          kind: 'stock_adjusted',
          actor: auditActor,
          reason: `Stocks : ${p.name} ${previousQty} → ${next} (${delta >= 0 ? '+' : ''}${delta})`,
          payload: {
            source:
              delta >= 0 ? 'stocks_delta_plus' : 'stocks_delta_minus',
            storeId: activeStoreId,
            storeName: activeStore?.name,
            locationId: selectedLocationId,
            locationName:
              stockLocations.find((l) => l.id === selectedLocationId)?.name ??
              selectedLocationId,
            productId: id,
            productName: p.name,
            barcode: p.barcode,
            previousQty,
            newQty: next,
            delta,
          },
        })
      } finally {
        setBusyId(null)
      }
    },
    [
      activeStoreId,
      activeStore?.name,
      selectedLocationId,
      stockLocations,
      auditActor,
      isAdmin,
      mergedProducts,
      pushStockCloud,
      recomputeAndWriteStoreStock,
      toast,
    ],
  )

  const openEdit = (p: ProductWithStock) => {
    setEditingId(p.id)
    setStockInput(String(p.stock))
    setThresholdInput(String(p.lowStockThreshold))
  }

  const applyAbsolute = async (p: ProductWithStock) => {
    if (selectedLocationId === 'all') {
      toast.error('Choisissez un emplacement', 'Sélectionnez Réserve ou Surface pour inventorier.')
      return
    }
    const st = Number.parseInt(stockInput.replace(/\s/g, ''), 10)
    const th = Number.parseInt(thresholdInput.replace(/\s/g, ''), 10)
    if (!Number.isFinite(st) || st < 0) {
      toast.error('Stock invalide')
      return
    }
    if (!Number.isFinite(th) || th < 0) {
      toast.error('Seuil invalide')
      return
    }
    const previousQty = p.stock
    const previousTh = p.lowStockThreshold
    setBusyId(p.id)
    try {
      await db.products.update(p.id, { lowStockThreshold: th })
      await db.locationStocks.put({
        id: locationStockRowId(activeStoreId, selectedLocationId, p.id),
        storeId: activeStoreId,
        locationId: selectedLocationId,
        productId: p.id,
        stock: st,
      })
      const totalStock = await recomputeAndWriteStoreStock(p.id)
      await pushStockCloud({ ...p, stock: totalStock, lowStockThreshold: th })
      void appendAuditEvent({
        kind: 'stock_adjusted',
        actor: auditActor,
        reason: `Stocks : saisie manuelle « ${p.name} »`,
        payload: {
          source: 'stocks_absolute',
          storeId: activeStoreId,
          storeName: activeStore?.name,
          locationId: selectedLocationId,
          productId: p.id,
          productName: p.name,
          barcode: p.barcode,
          previousQty,
          newQty: st,
          previousLowStockThreshold: previousTh,
          newLowStockThreshold: th,
        },
      })
      setEditingId(null)
      toast.success('Stock mis à jour', p.name)
    } finally {
      setBusyId(null)
    }
  }

  const applyQuickInventory = useCallback(async () => {
    if (selectedLocationId === 'all') {
      toast.error('Choisissez un emplacement', 'Inventaire rapide par emplacement uniquement.')
      return
    }
    const code = quickBarcode.trim()
    const qty = Number.parseInt(quickQty.replace(/\s/g, ''), 10)
    if (!code) {
      toast.error('Code-barres requis')
      return
    }
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error('Quantité invalide')
      return
    }
    setQuickBusy(true)
    try {
      const p = await db.products.where('barcode').equals(code).first()
      if (!p) {
        toast.error('Aucun article avec ce code-barres')
        return
      }
      const row = mergedProducts.find((x) => x.id === p.id)
      const previousQty = row?.stock ?? 0
      await db.locationStocks.put({
        id: locationStockRowId(activeStoreId, selectedLocationId, p.id),
        storeId: activeStoreId,
        locationId: selectedLocationId,
        productId: p.id,
        stock: qty,
      })
      const totalStock = await recomputeAndWriteStoreStock(p.id)
      const updated: ProductWithStock = {
        ...(row ?? { ...p, stock: 0 }),
        stock: totalStock,
      }
      if (isAdmin) await pushStockCloud(updated)
      void appendAuditEvent({
        kind: 'stock_adjusted',
        actor: auditActor,
        reason: `Inventaire rapide : « ${p.name} » ${previousQty} → ${qty}`,
        payload: {
          source: 'stocks_quick_inventory',
          storeId: activeStoreId,
          storeName: activeStore?.name,
          locationId: selectedLocationId,
          productId: p.id,
          productName: p.name,
          barcode: p.barcode,
          previousQty,
          newQty: qty,
        },
      })
      setQuickBarcode('')
      setQuickQty('')
      toast.success('Inventaire enregistré', `${p.name} → ${qty} unité(s)`)
    } finally {
      setQuickBusy(false)
    }
  }, [
    quickBarcode,
    quickQty,
    auditActor,
    isAdmin,
    pushStockCloud,
    activeStoreId,
    activeStore?.name,
    selectedLocationId,
    mergedProducts,
    recomputeAndWriteStoreStock,
    toast,
  ])

  const applyBulkRestockLow = useCallback(async () => {
    if (selectedLocationId === 'all') {
      toast.error('Choisissez un emplacement', 'Le réappro bulk est appliqué par emplacement.')
      return
    }
    const qty = Number.parseInt(bulkQty.replace(/\s/g, ''), 10)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Quantité de réappro invalide')
      return
    }
    const targets = visibleProducts.filter((p) => p.stock <= p.lowStockThreshold)
    if (targets.length === 0) {
      toast.info('Aucun article sous seuil')
      return
    }
    setBulkBusy(true)
    try {
      await db.transaction('rw', [db.locationStocks, db.storeStocks, db.auditEvents], async () => {
        for (const p of targets) {
          const previousQty = p.stock
          const newQty = previousQty + qty
          await db.locationStocks.put({
            id: locationStockRowId(activeStoreId, selectedLocationId, p.id),
            storeId: activeStoreId,
            locationId: selectedLocationId,
            productId: p.id,
            stock: newQty,
          })
          await recomputeAndWriteStoreStock(p.id)
          await appendAuditEvent({
            kind: 'stock_adjusted',
            actor: auditActor,
            reason: `Réappro bulk: ${p.name} ${previousQty} → ${newQty} (+${qty})`,
            payload: {
              source: 'stocks_bulk_restock',
              storeId: activeStoreId,
              storeName: activeStore?.name,
              locationId: selectedLocationId,
              productId: p.id,
              productName: p.name,
              previousQty,
              newQty,
              delta: qty,
            },
          })
        }
      })
      toast.success(
        'Réapprovisionnement terminé',
        `${targets.length} article(s) +${qty}`,
      )
    } finally {
      setBulkBusy(false)
    }
  }, [
    bulkQty,
    visibleProducts,
    activeStoreId,
    selectedLocationId,
    auditActor,
    activeStore?.name,
    recomputeAndWriteStoreStock,
    toast,
  ])

  const addKitchenIngredient = useCallback(async () => {
    const name = ingredientName.trim()
    const stock = Number.parseFloat(ingredientStock.replace(',', '.'))
    const threshold = Number.parseFloat(ingredientThreshold.replace(',', '.'))
    if (!name) {
      toast.error('Nom ingrédient requis')
      return
    }
    if (!Number.isFinite(stock) || stock < 0) {
      toast.error('Stock ingrédient invalide')
      return
    }
    if (!Number.isFinite(threshold) || threshold < 0) {
      toast.error('Seuil ingrédient invalide')
      return
    }
    const id = crypto.randomUUID()
    await db.kitchenIngredients.put({
      id,
      name,
      unit: ingredientUnit,
      lowStockThreshold: threshold,
      archived: false,
    })
    await db.kitchenIngredientStocks.put({
      id: `${activeStoreId}:${id}`,
      storeId: activeStoreId,
      ingredientId: id,
      stock,
    })
    setIngredientName('')
    setIngredientStock('0')
    setIngredientThreshold('0')
    toast.success('Ingrédient ajouté', name)
  }, [activeStoreId, ingredientName, ingredientStock, ingredientThreshold, ingredientUnit, toast])

  const adjustKitchenIngredient = useCallback(
    async (ingredientId: string, delta: number) => {
      const row = kitchenRows.find((x) => x.id === ingredientId)
      if (!row) return
      const next = Math.max(0, Math.round((row.stock + delta) * 1000) / 1000)
      await db.kitchenIngredientStocks.put({
        id: `${activeStoreId}:${ingredientId}`,
        storeId: activeStoreId,
        ingredientId,
        stock: next,
      })
    },
    [activeStoreId, kitchenRows],
  )

  const addRecipeRow = useCallback(async () => {
    const qty = Number.parseFloat(recipeQtyPerUnit.replace(',', '.'))
    if (!recipeProductId || !recipeIngredientId) {
      toast.error('Produit et ingrédient requis')
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Quantité recette invalide')
      return
    }
    const existing = recipeRows.find(
      (row) =>
        row.productId === recipeProductId &&
        row.ingredientId === recipeIngredientId,
    )
    if (existing) {
      await db.productRecipeIngredients.update(existing.id, { qtyPerUnit: qty })
      toast.success('Recette mise à jour')
    } else {
      await db.productRecipeIngredients.add({
        id: crypto.randomUUID(),
        productId: recipeProductId,
        ingredientId: recipeIngredientId,
        qtyPerUnit: qty,
      })
      toast.success('Recette ajoutée')
    }
    setRecipeQtyPerUnit('')
  }, [recipeIngredientId, recipeProductId, recipeQtyPerUnit, recipeRows, toast])

  const removeRecipeRow = useCallback(
    async (id: string) => {
      await db.productRecipeIngredients.delete(id)
      toast.info('Recette supprimée')
    },
    [toast],
  )

  const startEditRecipeRow = useCallback(
    (id: string) => {
      const row = recipeRows.find((x) => x.id === id)
      if (!row) return
      setRecipeProductId(row.productId)
      setRecipeIngredientId(row.ingredientId)
      setRecipeQtyPerUnit(String(row.qtyPerUnit))
    },
    [recipeRows],
  )

  const exportStockCsv = useCallback(() => {
    const rows: string[][] = [
      ['Article', 'Code-barres', 'Catégorie', 'Stock', 'Seuil', 'Prix TTC'],
      ...visibleProducts.map((p) => [
        p.name,
        p.barcode,
        p.category,
        String(p.stock),
        String(p.lowStockThreshold),
        String(p.priceTTC),
      ]),
    ]
    downloadTextFile(
      `stocks-${activeStore?.shortCode ?? activeStoreId}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsvSemicolon(rows),
    )
    toast.success('Export stock prêt', `${visibleProducts.length} ligne(s)`)
  }, [visibleProducts, activeStore?.shortCode, activeStoreId, toast])
  const exportMovementsCsv = useCallback(() => {
    const rows: string[][] = [
      ['Date', 'Article', 'Avant', 'Après', 'Source', 'Acteur', 'Motif'],
      ...stockMovements.map((m) => [
        new Date(m.createdAt).toLocaleString('fr-FR'),
        m.productName,
        m.previousQty != null ? String(m.previousQty) : '',
        m.newQty != null ? String(m.newQty) : '',
        m.source,
        m.actorDisplayName,
        m.reason,
      ]),
    ]
    downloadTextFile(
      `mouvements-stock-${activeStore?.shortCode ?? activeStoreId}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsvSemicolon(rows),
    )
    toast.success('Export mouvements prêt', `${stockMovements.length} ligne(s)`)
  }, [stockMovements, activeStore?.shortCode, activeStoreId, toast])

  const filterTabs = useMemo(
    () => [
      { id: 'tous' as const, label: 'Tous' },
      { id: 'rupture' as const, label: 'Rupture', count: stats.rupture },
      { id: 'alerte' as const, label: 'Alerte', count: stats.low },
      { id: 'ok' as const, label: 'OK', count: stats.ok },
    ],
    [stats.rupture, stats.low, stats.ok],
  )

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow={`Magasin · ${activeStore?.name ?? '—'}`}
        title="Stocks"
        subtitle="Niveaux par magasin et par emplacement, seuils d’alerte et inventaire rapide"
      />

      <Card>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Field label="Emplacement de stock actif">
            <Select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
            >
              <option value="all">Tous les emplacements (total magasin)</option>
              {stockLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </Select>
          </Field>
          <div className="rounded-lg border border-border bg-surface-sunken/70 px-3 py-2 text-[12px] text-ink-muted">
            Ajustements, inventaires rapides et réappro bulk s’appliquent à
            l’emplacement sélectionné, puis le total magasin est recalculé.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Rupture"
          value={String(stats.rupture)}
          hint="Stock = 0"
          tone="rose"
          icon={<IconAlert />}
        />
        <Kpi
          label="Sous le seuil"
          value={String(stats.low)}
          hint={`Sur ${stats.total} références`}
          tone="amber"
          icon={<IconStocks />}
        />
        <Kpi
          label="Confortable"
          value={String(stats.ok)}
          hint="Au-dessus du seuil"
          tone="accent"
          icon={<IconCheckCircle />}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Kpi
          label="Valeur du stock"
          value={formatFCFA(stockValuation)}
          hint="Stock courant du magasin actif"
          tone="accent"
          icon={<IconStocks />}
        />
        <Kpi
          label="Valeur exposée (rupture)"
          value={formatFCFA(ruptureValuation)}
          hint="Valeur des références en rupture"
          tone="rose"
          icon={<IconAlert />}
        />
      </div>

      {isAdmin ? (
        <Card>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <IconScan className="h-4 w-4 text-ink-subtle" />
              <h2 className="text-[14px] font-semibold text-ink">
                Inventaire rapide
              </h2>
            </div>
            <p className="mb-3 text-[12px] text-ink-subtle">
              Scannez ou saisissez le code-barres puis la quantité comptée.
              Le stock sera fixé à cette valeur.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Code-barres" className="min-w-0 flex-1">
                <Input
                  value={quickBarcode}
                  onChange={(e) => setQuickBarcode(e.target.value)}
                  placeholder="EAN / code interne"
                  className="font-mono-nums"
                />
              </Field>
              <Field label="Quantité" className="sm:w-32">
                <Input
                  inputMode="numeric"
                  value={quickQty}
                  onChange={(e) => setQuickQty(e.target.value)}
                  placeholder="0"
                  className="font-mono-nums"
                />
              </Field>
              <Button
                variant="accent"
                loading={quickBusy}
                onClick={() => void applyQuickInventory()}
              >
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-[14px] font-semibold text-ink">
              Stock cuisine (ingrédients)
            </h2>
            <div className="grid gap-2 md:grid-cols-5">
              <Input
                value={ingredientName}
                onChange={(e) => setIngredientName(e.target.value)}
                placeholder="Nom ingrédient"
              />
              <Select
                value={ingredientUnit}
                onChange={(e) => setIngredientUnit(e.target.value as KitchenStockUnit)}
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="l">L</option>
                <option value="ml">ml</option>
                <option value="piece">pièce</option>
              </Select>
              <Input
                inputMode="decimal"
                value={ingredientStock}
                onChange={(e) => setIngredientStock(e.target.value)}
                placeholder="Stock initial"
              />
              <Input
                inputMode="decimal"
                value={ingredientThreshold}
                onChange={(e) => setIngredientThreshold(e.target.value)}
                placeholder="Seuil alerte"
              />
              <Button variant="accent" onClick={() => void addKitchenIngredient()}>
                Ajouter
              </Button>
            </div>
            {kitchenRows.length === 0 ? (
              <p className="text-[12px] text-ink-subtle">
                Aucun ingrédient cuisine configuré.
              </p>
            ) : (
              <div className="space-y-2">
                {kitchenRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-[12px]"
                  >
                    <span className="font-medium text-zinc-800">
                      {row.name} · {row.stock} {row.unit}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void adjustKitchenIngredient(row.id, -0.1)}
                      >
                        -0.1
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void adjustKitchenIngredient(row.id, 0.1)}
                      >
                        +0.1
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void adjustKitchenIngredient(row.id, -1)}
                      >
                        -1
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void adjustKitchenIngredient(row.id, 1)}
                      >
                        +1
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-[14px] font-semibold text-ink">
              Recettes (plat {'->'} ingrédients)
            </h2>
            <div className="grid gap-2 md:grid-cols-[1.5fr_1.5fr_1fr_auto]">
              <Select
                value={recipeProductId}
                onChange={(e) => setRecipeProductId(e.target.value)}
              >
                <option value="">Choisir un produit</option>
                {products
                  .filter((p) => !p.archived)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
              <Select
                value={recipeIngredientId}
                onChange={(e) => setRecipeIngredientId(e.target.value)}
              >
                <option value="">Choisir un ingrédient</option>
                {kitchenRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </Select>
              <Input
                inputMode="decimal"
                value={recipeQtyPerUnit}
                onChange={(e) => setRecipeQtyPerUnit(e.target.value)}
                placeholder="Qté / plat"
              />
              <Button variant="accent" onClick={() => void addRecipeRow()}>
                Enregistrer
              </Button>
            </div>
            {recipeRows.length === 0 ? (
              <p className="text-[12px] text-ink-subtle">
                Aucune recette enregistrée.
              </p>
            ) : (
              <div className="space-y-1">
                {recipeRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-zinc-700"
                  >
                    <p>
                      {(productNameById.get(row.productId) ?? 'Produit')} {'->'}{' '}
                      {(ingredientNameById.get(row.ingredientId) ?? 'Ingrédient')} : {row.qtyPerUnit}
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEditRecipeRow(row.id)}>
                        Modifier
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void removeRecipeRow(row.id)}>
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-ink">
              Actions stock
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<IconDownload />}
                onClick={exportStockCsv}
              >
                Export stock
              </Button>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<IconDownload />}
                onClick={exportMovementsCsv}
                disabled={stockMovements.length === 0}
              >
                Export mouvements
              </Button>
            </div>
          </div>
          {isAdmin ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Réappro bas stocks (+)">
                <Input
                  inputMode="numeric"
                  value={bulkQty}
                  onChange={(e) => setBulkQty(e.target.value)}
                  className="font-mono-nums sm:w-28"
                />
              </Field>
              <Button
                variant="accent"
                loading={bulkBusy}
                onClick={() => void applyBulkRestockLow()}
              >
                Réapprovisionner les articles sous seuil
              </Button>
            </div>
          ) : (
            <p className="text-[12px] text-ink-subtle">
              Réapprovisionnement en masse réservé aux administrateurs.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          variant="segmented"
          items={filterTabs}
          active={filter}
          onChange={setFilter}
        />
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <Switch
              label="Archivés"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
          ) : null}
          <div className="w-full sm:w-64">
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher…"
              iconLeft={<IconSearch />}
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconStocks />}
          title="Aucun article"
          description="Aucune référence pour ce filtre."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const maxBar = Math.max(p.lowStockThreshold * 3, p.stock, 1)
            const pct = Math.min(100, (p.stock / maxBar) * 100)
            const state =
              p.stock <= 0
                ? 'rupture'
                : p.stock <= p.lowStockThreshold
                  ? 'low'
                  : 'ok'
            const isEditing = editingId === p.id
            const busy = busyId === p.id
            const tone =
              state === 'rupture'
                ? 'danger'
                : state === 'low'
                  ? 'warning'
                  : 'success'
            const barColor =
              state === 'rupture'
                ? 'bg-rose-500'
                : state === 'low'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'

            return (
              <Card key={p.id} className={p.archived ? 'opacity-70' : ''}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[14px] font-semibold text-ink">
                        {p.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-ink-subtle">
                        {p.category} ·{' '}
                        <span className="font-mono-nums">{p.barcode}</span>
                      </p>
                    </div>
                    <Badge tone={tone}>
                      {state === 'rupture'
                        ? 'Rupture'
                        : state === 'low'
                          ? 'Faible'
                          : 'OK'}
                    </Badge>
                  </div>

                  <div>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="font-mono-nums text-2xl font-bold text-ink">
                        {p.stock}
                      </span>
                      <span className="text-[11px] text-ink-subtle">
                        Seuil{' '}
                        <span className="font-mono-nums font-medium text-ink-muted">
                          {p.lowStockThreshold}
                        </span>
                        {' '}
                        ·{' '}
                        <span className="font-mono-nums">
                          {formatFCFA(p.priceTTC)}
                        </span>
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                      style={
                        {
                          ['--stock-bar-pct' as string]: `${pct}%`,
                        } as CSSProperties
                      }
                    >
                      <div
                        className={cn(
                          'h-full max-w-full rounded-full transition-[width] duration-300 ease-out w-(--stock-bar-pct)',
                          barColor,
                        )}
                      />
                    </div>
                  </div>

                  {isAdmin ? (
                    isEditing ? (
                      <div className="space-y-2 border-t border-border/60 pt-3">
                        <Field label="Stock (absolu)">
                          <Input
                            inputMode="numeric"
                            value={stockInput}
                            onChange={(e) => setStockInput(e.target.value)}
                            className="font-mono-nums"
                          />
                        </Field>
                        <Field label="Seuil d’alerte">
                          <Input
                            inputMode="numeric"
                            value={thresholdInput}
                            onChange={(e) => setThresholdInput(e.target.value)}
                            className="font-mono-nums"
                          />
                        </Field>
                        <div className="flex gap-2">
                          <Button
                            variant="accent"
                            fullWidth
                            loading={busy}
                            onClick={() => void applyAbsolute(p)}
                          >
                            Enregistrer
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 border-t border-border/60 pt-3">
                        <div className="grid grid-cols-5 gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy || p.stock <= 0}
                            onClick={() => void adjust(p.id, -1)}
                          >
                            −1
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void adjust(p.id, 1)}
                          >
                            +1
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={busy}
                            onClick={() => void adjust(p.id, 10)}
                          >
                            +10
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void adjust(p.id, 25)}
                          >
                            +25
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void adjust(p.id, 50)}
                          >
                            +50
                          </Button>
                        </div>
                        <Button
                          fullWidth
                          variant="ghost"
                          onClick={() => openEdit(p)}
                        >
                          Inventaire absolu & seuil
                        </Button>
                      </div>
                    )
                  ) : (
                    <p className="border-t border-border/60 pt-3 text-[11px] text-ink-subtle">
                      Ajustement réservé aux administrateurs.
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardContent>
          <h2 className="mb-3 text-[14px] font-semibold text-ink">
            Derniers mouvements de stock
          </h2>
          {stockMovements.length === 0 ? (
            <p className="text-[12px] text-ink-subtle">
              Aucun mouvement récent pour ce magasin.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {stockMovements.map((m) => (
                <li key={m.id} className="py-2 text-[12px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink-muted">
                      {m.productName}{' '}
                      {m.previousQty != null && m.newQty != null ? (
                        <span className="font-mono-nums text-ink-subtle">
                          {m.previousQty} → {m.newQty}
                        </span>
                      ) : null}
                    </p>
                    <span className="font-mono-nums text-[11px] text-ink-subtle">
                      {new Date(m.createdAt).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-subtle">
                    {m.actorDisplayName} · {m.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
