import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo, useState } from 'react'
import { useActiveStore } from '../context/ActiveStoreContext'
import { db } from '../db/db'
import type { ProductWithStock } from '../db/types'
import { formatFCFA } from '../lib/money'
import { productIsActive } from '../lib/productFilters'
import { storeStockRowId } from '../lib/storeStockId'
import type { AuditActor } from '../lib/auditLog'
import { appendAuditEvent } from '../lib/auditLog'
import { enqueueStockSync } from '../lib/sync'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { cn } from '../ui/cn'
import { EmptyState } from '../ui/EmptyState'
import { Field, Input } from '../ui/Input'
import { Kpi } from '../ui/Kpi'
import { PageHeader } from '../ui/PageHeader'
import { Switch } from '../ui/Switch'
import { Tabs } from '../ui/Tabs'
import { useToast } from '../ui/Toast'
import {
  IconAlert,
  IconCheckCircle,
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
  const mergedProducts = useMemo((): ProductWithStock[] => {
    const m = new Map(stockRows.map((r) => [r.productId, r.stock]))
    return products.map((p) => ({ ...p, stock: m.get(p.id) ?? 0 }))
  }, [products, stockRows])
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

  const adjust = useCallback(
    async (id: string, delta: number) => {
      const p = mergedProducts.find((x) => x.id === id)
      if (!p) return
      const previousQty = p.stock
      const next = Math.max(0, p.stock + delta)
      setBusyId(id)
      try {
        await db.storeStocks.put({
          id: storeStockRowId(activeStoreId, id),
          storeId: activeStoreId,
          productId: id,
          stock: next,
        })
        const updated = { ...p, stock: next }
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
      auditActor,
      isAdmin,
      mergedProducts,
      pushStockCloud,
    ],
  )

  const openEdit = (p: ProductWithStock) => {
    setEditingId(p.id)
    setStockInput(String(p.stock))
    setThresholdInput(String(p.lowStockThreshold))
  }

  const applyAbsolute = async (p: ProductWithStock) => {
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
      await db.storeStocks.put({
        id: storeStockRowId(activeStoreId, p.id),
        storeId: activeStoreId,
        productId: p.id,
        stock: st,
      })
      await pushStockCloud({ ...p, stock: st, lowStockThreshold: th })
      void appendAuditEvent({
        kind: 'stock_adjusted',
        actor: auditActor,
        reason: `Stocks : saisie manuelle « ${p.name} »`,
        payload: {
          source: 'stocks_absolute',
          storeId: activeStoreId,
          storeName: activeStore?.name,
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
      await db.storeStocks.put({
        id: storeStockRowId(activeStoreId, p.id),
        storeId: activeStoreId,
        productId: p.id,
        stock: qty,
      })
      const updated: ProductWithStock = {
        ...(row ?? { ...p, stock: 0 }),
        stock: qty,
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
    mergedProducts,
    toast,
  ])

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
        subtitle="Niveaux par magasin, seuils d’alerte et inventaire rapide"
      />

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

      {isAdmin ? (
        <Card>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <IconScan className="h-4 w-4 text-zinc-500" />
              <h2 className="text-[14px] font-semibold text-zinc-900">
                Inventaire rapide
              </h2>
            </div>
            <p className="mb-3 text-[12px] text-zinc-500">
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
                      <h3 className="truncate text-[14px] font-semibold text-zinc-900">
                        {p.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
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
                      <span className="font-mono-nums text-2xl font-bold text-zinc-900">
                        {p.stock}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        Seuil{' '}
                        <span className="font-mono-nums font-medium text-zinc-700">
                          {p.lowStockThreshold}
                        </span>{' '}
                        ·{' '}
                        <span className="font-mono-nums">
                          {formatFCFA(p.priceTTC)}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={cn('h-full rounded-full transition-all', barColor)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {isAdmin ? (
                    isEditing ? (
                      <div className="space-y-2 border-t border-zinc-100 pt-3">
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
                      <div className="space-y-2 border-t border-zinc-100 pt-3">
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
                    <p className="border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">
                      Ajustement réservé aux administrateurs.
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
