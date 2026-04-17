import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { OnlineOrder, Sale } from '../db/types'
import { formatFCFA } from '../lib/money'
import { storeStockRowId } from '../lib/storeStockId'
import { flushSyncQueue } from '../lib/sync'

type Props = {
  online: boolean
  reviewer: { id: string; displayName: string }
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function paymentLabel(method: OnlineOrder['paymentMethod']): string {
  switch (method) {
    case 'cash':
      return 'Espèces à la livraison'
    case 'card':
      return 'Carte bancaire'
    case 'mobile':
      return 'Mobile money'
    default:
      return 'Paiement mixte'
  }
}

export function OnlineOrdersValidationView({ online, reviewer }: Props) {
  const orders = useLiveQuery(
    () => db.onlineOrders.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  )
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)

  const pending = useMemo(
    () => (orders ?? []).filter((o) => o.status === 'pending'),
    [orders],
  )
  const reviewed = useMemo(
    () => (orders ?? []).filter((o) => o.status !== 'pending').slice(0, 20),
    [orders],
  )

  const approveOrder = useCallback(
    async (order: OnlineOrder) => {
      if (busyOrderId) return
      setBusyOrderId(order.id)
      try {
        await db.transaction(
          'rw',
          [
            db.onlineOrders,
            db.products,
            db.storeStocks,
            db.sales,
            db.syncQueue,
          ],
          async () => {
            const fresh = await db.onlineOrders.get(order.id)
            if (!fresh || fresh.status !== 'pending') return

            for (const line of fresh.lines) {
              const product = await db.products.get(line.productId)
              if (!product || product.archived) {
                throw new Error(
                  `Produit indisponible: « ${line.name} ». Validation interrompue.`,
                )
              }
              const stockId = storeStockRowId(fresh.storeId, line.productId)
              const row = await db.storeStocks.get(stockId)
              const currentStock = row?.stock ?? 0
              if (currentStock < line.qty) {
                throw new Error(
                  `Stock insuffisant pour « ${line.name} » (disponible: ${currentStock}).`,
                )
              }
            }

            for (const line of fresh.lines) {
              const stockId = storeStockRowId(fresh.storeId, line.productId)
              const row = await db.storeStocks.get(stockId)
              const currentStock = row?.stock ?? 0
              await db.storeStocks.put({
                id: stockId,
                storeId: fresh.storeId,
                productId: line.productId,
                stock: currentStock - line.qty,
              })
            }

            const saleId = crypto.randomUUID()
            const note = [fresh.customerPhone, fresh.customerAddress]
              .filter((v) => Boolean(v && v.length > 0))
              .join(' · ')

            const saleRecord: Sale = {
              id: saleId,
              createdAt: fresh.createdAt,
              lines: fresh.lines,
              subtotalHT: fresh.subtotalHT,
              tva: fresh.tva,
              totalTTC: fresh.totalTTC,
              discountPct: 0,
              paymentMethod: fresh.paymentMethod,
              synced: false,
              storeId: fresh.storeId,
              storeName: fresh.storeName,
              cashierProfileId: reviewer.id,
              cashierDisplayName: `${reviewer.displayName} · Validation web`,
              mobileMoneyReference: note || undefined,
            }

            await db.sales.add(saleRecord)
            await db.syncQueue.add({
              kind: 'sale',
              payload: JSON.stringify({
                saleId,
                channel: 'web-validated',
                onlineOrderId: fresh.id,
              }),
              createdAt: Date.now(),
            })

            await db.onlineOrders.put({
              ...fresh,
              status: 'approved',
              reviewedAt: Date.now(),
              reviewedByProfileId: reviewer.id,
              reviewedByDisplayName: reviewer.displayName,
            })
          },
        )

        if (online) {
          await flushSyncQueue()
        }
      } finally {
        setBusyOrderId(null)
      }
    },
    [busyOrderId, online, reviewer.displayName, reviewer.id],
  )

  const rejectOrder = useCallback(
    async (order: OnlineOrder) => {
      if (busyOrderId) return
      const reason =
        window.prompt(
          'Motif de rejet (optionnel, visible dans l’historique):',
          '',
        ) ?? ''
      setBusyOrderId(order.id)
      try {
        const fresh = await db.onlineOrders.get(order.id)
        if (!fresh || fresh.status !== 'pending') return
        await db.onlineOrders.put({
          ...fresh,
          status: 'rejected',
          reviewedAt: Date.now(),
          reviewedByProfileId: reviewer.id,
          reviewedByDisplayName: reviewer.displayName,
          reviewNote: reason.trim() || undefined,
        })
      } finally {
        setBusyOrderId(null)
      }
    },
    [busyOrderId, reviewer.displayName, reviewer.id],
  )

  return (
    <div className="premium-scrollbar space-y-6 py-4">
      <section className="premium-glass rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Validation commandes en ligne
        </p>
        <h2 className="premium-title mt-2 text-xl font-semibold">
          {pending.length} commande(s) en attente
        </h2>
        <p className="premium-text mt-1 text-sm">
          Les commandes web doivent être validées par un gérant ou un admin
          avant impact stock et remontée de vente.
        </p>
      </section>

      <section className="space-y-3">
        {pending.length === 0 ? (
          <div className="premium-card rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Aucune commande en attente pour le moment.
          </div>
        ) : null}

        {pending.map((order) => (
          <article
            key={order.id}
            className="premium-card rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Référence {order.id.slice(0, 8).toUpperCase()}
                </p>
                <h3 className="premium-title mt-1 text-lg font-semibold">
                  {order.customerName}
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  {formatDateTime(order.createdAt)} · {order.storeName ?? 'Magasin'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Total commande</p>
                <p className="text-lg font-semibold text-amber-800">
                  {formatFCFA(order.totalTTC)}
                </p>
                <p className="text-xs text-slate-600">
                  {paymentLabel(order.paymentMethod)}
                </p>
              </div>
            </div>

            <div className="premium-glass mt-4 rounded-xl border border-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Détails client
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {order.customerPhone || 'Téléphone non renseigné'}
              </p>
              <p className="text-sm text-slate-600">
                {order.customerAddress || 'Adresse non renseignée'}
              </p>
              <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                <p>
                  Mode: {order.fulfillmentMode === 'delivery' ? 'Livraison' : 'Retrait boutique'}
                </p>
                {order.discountPct ? (
                  <p>Promo: {order.promoCode ?? 'Code'} ({order.discountPct}%)</p>
                ) : null}
                {order.deliveryFeeTTC ? (
                  <p>Frais livraison: {formatFCFA(order.deliveryFeeTTC)}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {order.lines.map((line) => (
                <div
                  key={`${order.id}-${line.productId}`}
                  className="premium-card flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                >
                  <span className="text-slate-700">{line.name}</span>
                  <span className="font-medium text-slate-900">
                    {line.qty} × {formatFCFA(line.unitPriceTTC)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void approveOrder(order)}
                disabled={busyOrderId === order.id}
                className="premium-btn rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Valider la commande
              </button>
              <button
                type="button"
                onClick={() => void rejectOrder(order)}
                disabled={busyOrderId === order.id}
                className="premium-btn-dark rounded-lg border border-red-300 bg-white/10 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Rejeter
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="premium-glass rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">
          Historique récent
        </h3>
        <div className="mt-3 space-y-2">
          {reviewed.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucun historique de validation pour le moment.
            </p>
          ) : (
            reviewed.map((order) => (
              <div
                key={order.id}
                className="premium-card flex flex-wrap items-center justify-between rounded-lg px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">
                  {order.id.slice(0, 8).toUpperCase()} · {order.customerName}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    order.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {order.status === 'approved' ? 'Validée' : 'Rejetée'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
