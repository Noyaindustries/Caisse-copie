import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { OnlineOrder, Sale } from '../db/types'
import { formatFCFA } from '../lib/money'
import { storeStockRowId } from '../lib/storeStockId'
import { flushSyncQueue } from '../lib/sync'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { PageHeader } from '../ui/PageHeader'
import { SectionHeader } from '../ui/PageHeader'
import { useToast } from '../ui/Toast'
import {
  IconCheck,
  IconClose,
  IconOnlineOrders,
  IconTruck,
} from '../ui/icons'

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
  const toast = useToast()
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
          [db.onlineOrders, db.products, db.storeStocks, db.sales, db.syncQueue],
          async () => {
            const fresh = await db.onlineOrders.get(order.id)
            if (!fresh || fresh.status !== 'pending') return

            for (const line of fresh.lines) {
              const product = await db.products.get(line.productId)
              if (!product || product.archived) {
                throw new Error(
                  `Produit indisponible: « ${line.name} ».`,
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
        toast.success('Commande validée', order.customerName)
      } catch (e) {
        toast.error(
          'Validation impossible',
          e instanceof Error ? e.message : String(e),
        )
      } finally {
        setBusyOrderId(null)
      }
    },
    [busyOrderId, online, reviewer.displayName, reviewer.id, toast],
  )

  const rejectOrder = useCallback(
    async (order: OnlineOrder) => {
      if (busyOrderId) return
      const reason =
        window.prompt('Motif de rejet (optionnel) :', '') ?? ''
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
        toast.info('Commande rejetée', order.customerName)
      } finally {
        setBusyOrderId(null)
      }
    },
    [busyOrderId, reviewer.displayName, reviewer.id, toast],
  )

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow="Commandes en ligne"
        title={`${pending.length} commande${pending.length > 1 ? 's' : ''} en attente`}
        subtitle="Validation gérant ou admin avant impact stock et remontée de vente"
      />

      <SectionHeader title="À valider" />
      {pending.length === 0 ? (
        <EmptyState
          icon={<IconOnlineOrders />}
          title="Aucune commande en attente"
          description="Les nouvelles commandes web apparaîtront ici."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {pending.map((order) => {
            const busy = busyOrderId === order.id
            return (
              <Card key={order.id} hover>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="ui-eyebrow">
                        Réf. {order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <h3 className="mt-0.5 truncate text-[14px] font-semibold text-zinc-900">
                        {order.customerName}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {formatDateTime(order.createdAt)} ·{' '}
                        {order.storeName ?? 'Magasin'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-nums text-[15px] font-bold text-zinc-900">
                        {formatFCFA(order.totalTTC)}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {paymentLabel(order.paymentMethod)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-zinc-50 px-3 py-2 text-[12px] text-zinc-700">
                    <p>
                      <span className="text-zinc-500">Tél :</span>{' '}
                      {order.customerPhone || 'non renseigné'}
                    </p>
                    <p>
                      <span className="text-zinc-500">Adresse :</span>{' '}
                      {order.customerAddress || 'non renseignée'}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <IconTruck className="h-3 w-3" />
                      {order.fulfillmentMode === 'delivery'
                        ? 'Livraison'
                        : 'Retrait boutique'}
                      {order.discountPct ? (
                        <>
                          {' · '}Promo {order.promoCode ?? ''} ({order.discountPct} %)
                        </>
                      ) : null}
                      {order.deliveryFeeTTC ? (
                        <> · Livraison {formatFCFA(order.deliveryFeeTTC)}</>
                      ) : null}
                    </p>
                  </div>

                  <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                    {order.lines.map((line) => (
                      <li
                        key={`${order.id}-${line.productId}`}
                        className="flex items-center justify-between px-3 py-1.5 text-[12px]"
                      >
                        <span className="truncate text-zinc-700">
                          {line.name}
                        </span>
                        <span className="ml-2 font-mono-nums font-medium text-zinc-900">
                          {line.qty} × {formatFCFA(line.unitPriceTTC)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="accent"
                      iconLeft={<IconCheck />}
                      loading={busy}
                      onClick={() => void approveOrder(order)}
                    >
                      Valider
                    </Button>
                    <Button
                      variant="ghost"
                      iconLeft={<IconClose />}
                      disabled={busy}
                      onClick={() => void rejectOrder(order)}
                    >
                      Rejeter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <SectionHeader title="Historique récent" />
      {reviewed.length === 0 ? (
        <EmptyState
          title="Aucun historique"
          description="Les commandes traitées apparaîtront ici."
          variant="flat"
        />
      ) : (
        <Card>
          <CardContent className="!p-0">
            <ul className="divide-y divide-zinc-100">
              {reviewed.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]"
                >
                  <span className="min-w-0 truncate font-medium text-zinc-800">
                    <span className="font-mono-nums text-zinc-500">
                      {order.id.slice(0, 8).toUpperCase()}
                    </span>{' '}
                    · {order.customerName}
                  </span>
                  <Badge tone={order.status === 'approved' ? 'success' : 'danger'}>
                    {order.status === 'approved' ? 'Validée' : 'Rejetée'}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
