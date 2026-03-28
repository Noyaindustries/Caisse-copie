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

type Props = { isAdmin: boolean; auditActor: AuditActor }

type StockFilter = 'tous' | 'rupture' | 'alerte' | 'ok'

function urgency(p: ProductWithStock): number {
  if (p.stock <= 0) return 0
  if (p.stock <= p.lowStockThreshold) return 1
  return 2
}

export function StocksView({ isAdmin, auditActor }: Props) {
  const { activeStoreId, activeStore } = useActiveStore()
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
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null)

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

  const ruptureList = useMemo(
    () => visibleProducts.filter((p) => p.stock <= 0),
    [visibleProducts],
  )

  const lowStockList = useMemo(
    () =>
      visibleProducts.filter(
        (p) => p.stock > 0 && p.stock <= p.lowStockThreshold,
      ),
    [visibleProducts],
  )

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
          p.name.toLowerCase().includes(t) || p.barcode.toLowerCase().includes(t),
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
      window.alert('Stock invalide.')
      return
    }
    if (!Number.isFinite(th) || th < 0) {
      window.alert('Seuil d’alerte invalide.')
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
    } finally {
      setBusyId(null)
    }
  }

  const applyQuickInventory = useCallback(async () => {
    setQuickFeedback(null)
    const code = quickBarcode.trim()
    const qty = Number.parseInt(quickQty.replace(/\s/g, ''), 10)
    if (!code) {
      window.alert('Saisissez un code-barres.')
      return
    }
    if (!Number.isFinite(qty) || qty < 0) {
      window.alert('Quantité invalide (entier ≥ 0).')
      return
    }
    setQuickBusy(true)
    try {
      const p = await db.products.where('barcode').equals(code).first()
      if (!p) {
        window.alert('Aucun article avec ce code-barres.')
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
      setQuickFeedback(
        `Inventaire : « ${p.name} » → ${qty} unité(s) enregistrée(s).`,
      )
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
  ])

  const filterBtn = (id: StockFilter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        filter === id
          ? 'bg-slate-900 text-white'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <p className="text-sm font-semibold text-slate-900">
          Gestion des stocks
        </p>
        <p className="mt-2 text-xs font-medium text-slate-600">
          Point de vente actif :{' '}
          <strong className="text-slate-900">{activeStore?.name ?? '—'}</strong>{' '}
          (les quantités ci-dessous sont celles de ce magasin).
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600">
          <li>
            <strong className="font-medium text-slate-800">
              Décrémentation automatique
            </strong>{' '}
            : à chaque vente validée, les quantités vendues sont retirées du
            stock du <strong>magasin sélectionné dans la barre latérale</strong>{' '}
            (transaction atomique avec l’enregistrement de la vente).
          </li>
          <li>
            <strong className="font-medium text-slate-800">
              Seuil d’alerte configurable
            </strong>{' '}
            : par article, définissez un minimum sous lequel l’étiquette
            « alerte » s’affiche (caisse, catalogue, vue Stocks). Modifiable
            dans le catalogue ou via « Saisie stock &amp; seuil » ci-dessous.
          </li>
          <li>
            <strong className="font-medium text-slate-800">
              Inventaire manuel
            </strong>{' '}
            : ajustements +1 / −1 / lots, saisie du stock absolu et du seuil, ou
            comptage rapide par code-barres (admin).
          </li>
        </ul>
      </div>

      {stats.rupture > 0 ? (
        <div className="rounded-2xl border border-red-300/60 bg-red-50/90 p-4 ring-1 ring-red-200">
          <p className="text-sm font-semibold text-red-900">
            Alerte rupture · {stats.rupture} référence
            {stats.rupture > 1 ? 's' : ''}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {ruptureList.slice(0, 12).map((p) => (
              <li
                key={p.id}
                className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-red-800 ring-1 ring-red-200"
              >
                {p.name}
              </li>
            ))}
            {ruptureList.length > 12 ? (
              <li className="text-xs text-red-700">
                +{ruptureList.length - 12} autres…
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {stats.low > 0 ? (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/90 p-4 ring-1 ring-amber-200">
          <p className="text-sm font-semibold text-amber-950">
            Sous le seuil d’alerte · {stats.low} référence
            {stats.low > 1 ? 's' : ''}{' '}
            <span className="font-normal text-amber-900/90">
              (stock &gt; 0 mais ≤ seuil configuré)
            </span>
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {lowStockList.slice(0, 12).map((p) => (
              <li
                key={p.id}
                className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200"
              >
                {p.name}{' '}
                <span className="font-mono-nums text-amber-800">
                  ({p.stock}/{p.lowStockThreshold})
                </span>
              </li>
            ))}
            {lowStockList.length > 12 ? (
              <li className="text-xs text-amber-900">
                +{lowStockList.length - 12} autres…
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white p-5 ring-1 ring-emerald-100">
          <p className="text-sm font-semibold text-emerald-950">
            Inventaire rapide (comptage physique)
          </p>
          <p className="mt-1 text-xs text-emerald-900/80">
            Scannez ou saisissez le code-barres, entrez la quantité comptée,
            puis validez pour fixer le stock à cette valeur (comme une saisie
            d’inventaire).
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="text-xs font-medium text-emerald-900/90">
                Code-barres
              </span>
              <input
                value={quickBarcode}
                onChange={(e) => setQuickBarcode(e.target.value)}
                placeholder="EAN / code interne"
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 font-mono-nums text-sm outline-none ring-emerald-500/20 focus:ring-2"
              />
            </label>
            <label className="w-full sm:w-36">
              <span className="text-xs font-medium text-emerald-900/90">
                Quantité comptée
              </span>
              <input
                inputMode="numeric"
                value={quickQty}
                onChange={(e) => setQuickQty(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 font-mono-nums text-sm outline-none ring-emerald-500/20 focus:ring-2"
              />
            </label>
            <button
              type="button"
              disabled={quickBusy}
              onClick={() => void applyQuickInventory()}
              className="shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {quickBusy ? 'Enregistrement…' : 'Enregistrer le comptage'}
            </button>
          </div>
          {quickFeedback ? (
            <p className="mt-3 text-sm text-emerald-900" role="status">
              {quickFeedback}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-red-200/60 bg-gradient-to-br from-red-50 to-white p-5 ring-1 ring-red-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700/80">
            Rupture
          </p>
          <p className="mt-2 font-mono-nums text-3xl font-bold text-red-800">
            {stats.rupture}
          </p>
          <p className="text-xs text-red-600/80">Stock = 0</p>
        </div>
        <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-white p-5 ring-1 ring-amber-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800/80">
            Sous le seuil
          </p>
          <p className="mt-2 font-mono-nums text-3xl font-bold text-amber-900">
            {stats.low}
          </p>
          <p className="text-xs text-amber-800/70">Sur {stats.total} références</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-white p-5 ring-1 ring-emerald-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800/80">
            Confortable
          </p>
          <p className="mt-2 font-mono-nums text-3xl font-bold text-emerald-900">
            {stats.ok}
          </p>
          <p className="text-xs text-emerald-800/70">Au-dessus du seuil</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {filterBtn('tous', 'Tous')}
          {filterBtn('rupture', 'Rupture')}
          {filterBtn('alerte', 'Alerte')}
          {filterBtn('ok', 'OK')}
          {isAdmin ? (
            <label className="ml-1 flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-slate-300"
              />
              Inclure archivés
            </label>
          ) : null}
        </div>
        <div className="relative max-w-xs flex-1">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher nom ou code-barres…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-3 text-sm outline-none ring-emerald-500/30 focus:ring-2"
          />
        </div>
      </div>

      {isAdmin ? (
        <p className="text-xs text-slate-500">
          Les ajustements manuels et l’inventaire rapide sont mis en file pour
          synchronisation cloud (barre latérale). Hors ligne, l’envoi reprend au
          retour du réseau. La vente en caisse décrémente le stock sans action
          supplémentaire.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

          return (
            <article
              key={p.id}
              className={`group relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${
                state === 'rupture'
                  ? 'border-red-200/80 bg-white ring-1 ring-red-100'
                  : state === 'low'
                    ? 'border-amber-200/80 bg-white ring-1 ring-amber-100'
                    : 'border-slate-200/80 bg-white ring-1 ring-slate-100'
              }`}
            >
              <div
                className={`absolute inset-x-0 top-0 h-1 ${
                  state === 'rupture'
                    ? 'bg-red-500'
                    : state === 'low'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
              />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900">
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {p.category} · {p.barcode}
                    {p.archived ? (
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                        Archivé
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 font-mono-nums text-xs font-semibold text-slate-700">
                  {formatFCFA(p.priceTTC)}
                </span>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Niveau de stock</span>
                  <span>
                    Seuil :{' '}
                    <span className="font-mono-nums font-medium text-slate-700">
                      {p.lowStockThreshold}
                    </span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      state === 'rupture'
                        ? 'bg-red-500'
                        : state === 'low'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-2 font-mono-nums text-2xl font-bold text-slate-900">
                  {p.stock}{' '}
                  <span className="text-sm font-normal text-slate-500">unités</span>
                </p>
              </div>

              {isAdmin ? (
                <>
                  {isEditing ? (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <label className="block text-xs font-medium text-slate-600">
                        Stock (absolu)
                        <input
                          type="text"
                          inputMode="numeric"
                          value={stockInput}
                          onChange={(e) => setStockInput(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono-nums text-sm"
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-600">
                        Seuil d’alerte
                        <input
                          type="text"
                          inputMode="numeric"
                          value={thresholdInput}
                          onChange={(e) => setThresholdInput(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono-nums text-sm"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void applyAbsolute(p)}
                          className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || p.stock <= 0}
                          onClick={() => void adjust(p.id, -1)}
                          className="min-w-[3rem] flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          −1
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void adjust(p.id, 1)}
                          className="min-w-[3rem] flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void adjust(p.id, 10)}
                          className="min-w-[3rem] flex-1 rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          +10
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void adjust(p.id, 25)}
                          className="min-w-[3rem] flex-1 rounded-xl border border-slate-800 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          +25
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void adjust(p.id, 50)}
                          className="min-w-[3rem] flex-1 rounded-xl border border-slate-800 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          +50
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="w-full rounded-xl border border-emerald-200 bg-emerald-50/80 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                      >
                        Inventaire : stock absolu &amp; seuil d’alerte…
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                  Ajustement réservé aux administrateurs.
                </p>
              )}
            </article>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          Aucun article pour ce filtre.
        </p>
      ) : null}
    </div>
  )
}
