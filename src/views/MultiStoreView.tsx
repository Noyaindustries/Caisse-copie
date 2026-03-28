import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, ensureAllStoreStockRows } from '../db/db'
import type { StockTransfer, Store } from '../db/types'
import type { AuditActor } from '../lib/auditLog'
import { appendAuditEvent } from '../lib/auditLog'
import { storeStockRowId } from '../lib/storeStockId'

type Tab = 'consolidated' | 'transfers' | 'stores'

type Props = {
  /** Onglet création / liste magasins. */
  canConfigureStores: boolean
  /** Formulaire de transfert de stock. */
  canCreateTransfers: boolean
  profileId: string
  auditActor: AuditActor
}

export function MultiStoreView({
  canConfigureStores,
  canCreateTransfers,
  profileId,
  auditActor,
}: Props) {
  const [tab, setTab] = useState<Tab>('consolidated')
  const stores =
    useLiveQuery(() => db.stores.orderBy('sortOrder').toArray(), [], []) ?? []
  const products = useLiveQuery(() => db.products.toArray(), [], []) ?? []
  const allStocks = useLiveQuery(() => db.storeStocks.toArray(), [], []) ?? []
  const transfers =
    useLiveQuery(
      () => db.stockTransfers.orderBy('createdAt').reverse().toArray(),
      [],
      [],
    ) ?? []

  const stockMatrix = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    for (const s of allStocks) {
      if (!m.has(s.productId)) m.set(s.productId, new Map())
      m.get(s.productId)!.set(s.storeId, s.stock)
    }
    return m
  }, [allStocks])

  const storeById = useMemo(
    () => new Map(stores.map((s) => [s.id, s])),
    [stores],
  )

  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [tBarcode, setTBarcode] = useState('')
  const [tQty, setTQty] = useState('')
  const [tNote, setTNote] = useState('')
  const [tBusy, setTBusy] = useState(false)
  const [tMsg, setTMsg] = useState<string | null>(null)

  const [newStoreName, setNewStoreName] = useState('')
  const [newStoreCode, setNewStoreCode] = useState('')
  const [storeBusy, setStoreBusy] = useState(false)

  useEffect(() => {
    if (tab === 'stores' && !canConfigureStores) {
      setTab('consolidated')
    }
  }, [tab, canConfigureStores])

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [products],
  )

  const doTransfer = useCallback(async () => {
    setTMsg(null)
    if (!fromId || !toId || fromId === toId) {
      window.alert('Choisissez deux magasins distincts.')
      return
    }
    const code = tBarcode.trim()
    const qty = Number.parseInt(tQty.replace(/\s/g, ''), 10)
    if (!code) {
      window.alert('Code-barres requis.')
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      window.alert('Quantité invalide.')
      return
    }
    const prod = await db.products.where('barcode').equals(code).first()
    if (!prod) {
      window.alert('Article introuvable.')
      return
    }
    const transferId = crypto.randomUUID()
    const noteTrim = tNote.trim() || undefined
    setTBusy(true)
    try {
      await db.transaction('rw', db.storeStocks, db.stockTransfers, async () => {
        const fromRowId = storeStockRowId(fromId, prod.id)
        const toRowId = storeStockRowId(toId, prod.id)
        const fromRow = await db.storeStocks.get(fromRowId)
        const toRow = await db.storeStocks.get(toRowId)
        const fromStock = fromRow?.stock ?? 0
        if (fromStock < qty) {
          throw new Error(
            `Stock insuffisant à l’expéditeur (${fromStock} disponible(s)).`,
          )
        }
        await db.storeStocks.put({
          id: fromRowId,
          storeId: fromId,
          productId: prod.id,
          stock: fromStock - qty,
        })
        await db.storeStocks.put({
          id: toRowId,
          storeId: toId,
          productId: prod.id,
          stock: (toRow?.stock ?? 0) + qty,
        })
        const tr: StockTransfer = {
          id: transferId,
          createdAt: Date.now(),
          fromStoreId: fromId,
          toStoreId: toId,
          productId: prod.id,
          qty,
          note: noteTrim,
          createdByProfileId: profileId,
        }
        await db.stockTransfers.add(tr)
      })
      const fromName = storeById.get(fromId)?.name ?? fromId
      const toName = storeById.get(toId)?.name ?? toId
      void appendAuditEvent({
        kind: 'stock_transfer',
        actor: auditActor,
        reason: `Transfert ${qty} × ${prod.name} : ${fromName} → ${toName}`,
        payload: {
          transferId,
          fromStoreId: fromId,
          fromStoreName: fromName,
          toStoreId: toId,
          toStoreName: toName,
          productId: prod.id,
          productName: prod.name,
          barcode: prod.barcode,
          qty,
          note: noteTrim,
          createdByProfileId: profileId,
        },
      })
      setTMsg(`Transfert enregistré : ${qty} × ${prod.name} vers ${toName}`)
      setTBarcode('')
      setTQty('')
      setTNote('')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    } finally {
      setTBusy(false)
    }
  }, [
    fromId,
    toId,
    tBarcode,
    tQty,
    tNote,
    profileId,
    storeById,
    auditActor,
  ])

  const addStore = useCallback(async () => {
    const name = newStoreName.trim()
    const sc = newStoreCode.trim().toUpperCase().slice(0, 6)
    if (!name || !sc) {
      window.alert('Nom et code court requis.')
      return
    }
    setStoreBusy(true)
    try {
      const maxSort =
        stores.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1
      const s: Store = {
        id: crypto.randomUUID(),
        name,
        shortCode: sc,
        sortOrder: maxSort,
      }
      await db.stores.add(s)
      await ensureAllStoreStockRows()
      setNewStoreName('')
      setNewStoreCode('')
    } finally {
      setStoreBusy(false)
    }
  }, [newStoreName, newStoreCode, stores])

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
        tab === id
          ? 'bg-slate-900 text-white'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {tabBtn('consolidated', 'Vue consolidée')}
        {tabBtn('transfers', 'Transferts')}
        {canConfigureStores ? tabBtn('stores', 'Magasins') : null}
      </div>

      {tab === 'consolidated' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100">
          <p className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Stocks par article et par point de vente, avec total réseau (vue
            gérant).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">
                    Article
                  </th>
                  {stores.map((s) => (
                    <th
                      key={s.id}
                      className="px-3 py-3 text-right font-mono-nums"
                    >
                      {s.shortCode}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-mono-nums">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedProducts.map((p) => {
                  const row = stockMatrix.get(p.id)
                  let total = 0
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-slate-900">
                        {p.name}
                        <span className="block text-[10px] font-normal text-slate-500">
                          {p.barcode}
                        </span>
                      </td>
                      {stores.map((s) => {
                        const q = row?.get(s.id) ?? 0
                        total += q
                        return (
                          <td
                            key={s.id}
                            className="px-3 py-2 text-right font-mono-nums text-slate-700"
                          >
                            {q}
                          </td>
                        )
                      })}
                      <td className="px-4 py-2 text-right font-mono-nums font-semibold text-emerald-800">
                        {total}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {sortedProducts.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Aucun produit.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'transfers' ? (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Transfert interne : le stock est retiré du magasin source et ajouté
            au magasin destination. Réservé aux comptes autorisés.
          </p>
          {!canCreateTransfers ? (
            <p className="text-sm text-amber-800">
              Vous pouvez consulter l’historique ; la création de transferts est
              réservée aux profils autorisés (gérant, administrateur).
            </p>
          ) : null}
          {canCreateTransfers ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-medium text-slate-600">
                Magasin expéditeur
                <select
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Magasin destinataire
                <select
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Code-barres
                <input
                  value={tBarcode}
                  onChange={(e) => setTBarcode(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono-nums text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Quantité
                <input
                  inputMode="numeric"
                  value={tQty}
                  onChange={(e) => setTQty(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono-nums text-sm"
                />
              </label>
              <label className="col-span-full block text-xs font-medium text-slate-600">
                Note (optionnel)
                <input
                  value={tNote}
                  onChange={(e) => setTNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="col-span-full">
                <button
                  type="button"
                  disabled={tBusy}
                  onClick={() => void doTransfer()}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {tBusy ? 'Traitement…' : 'Valider le transfert'}
                </button>
                {tMsg ? (
                  <p className="mt-2 text-sm text-emerald-800" role="status">
                    {tMsg}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Historique récent
            </h3>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs text-slate-600">
              {transfers.length === 0 ? (
                <li>Aucun transfert enregistré.</li>
              ) : (
                transfers.slice(0, 40).map((tr) => {
                  const p = products.find((x) => x.id === tr.productId)
                  const from = storeById.get(tr.fromStoreId)?.name ?? tr.fromStoreId
                  const to = storeById.get(tr.toStoreId)?.name ?? tr.toStoreId
                  return (
                    <li
                      key={tr.id}
                      className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                    >
                      <span className="font-mono-nums text-slate-800">
                        {new Date(tr.createdAt).toLocaleString('fr-FR')}
                      </span>
                      {' · '}
                      {tr.qty} × {p?.name ?? tr.productId}{' '}
                      <span className="text-slate-500">
                        {from} → {to}
                      </span>
                      {tr.note ? (
                        <span className="block text-slate-500">{tr.note}</span>
                      ) : null}
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === 'stores' && canConfigureStores ? (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Points de vente
          </h3>
          <ul className="space-y-2 text-sm">
            {stores.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
              >
                <span>
                  <strong className="text-slate-900">{s.name}</strong>
                  <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
                    {s.shortCode}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-600">
              Ajouter un magasin (stocks initialisés à 0 pour tous les articles)
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-xs text-slate-600">
                Nom
                <input
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="w-full sm:w-28 text-xs text-slate-600">
                Code
                <input
                  value={newStoreCode}
                  onChange={(e) => setNewStoreCode(e.target.value)}
                  maxLength={6}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
                />
              </label>
              <button
                type="button"
                disabled={storeBusy}
                onClick={() => void addStore()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
