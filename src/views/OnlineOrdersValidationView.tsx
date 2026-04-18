import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { OnlineOrder, Sale } from '../db/types'
import { downloadTextFile, toCsvSemicolon } from '../lib/analyticsExport'
import { formatFCFA } from '../lib/money'
import { storeStockRowId } from '../lib/storeStockId'
import { flushSyncQueue } from '../lib/sync'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { PageHeader } from '../ui/PageHeader'
import { SectionHeader } from '../ui/PageHeader'
import { Switch } from '../ui/Switch'
import { useToast } from '../ui/Toast'
import {
  IconCheck,
  IconClose,
  IconDownload,
  IconOnlineOrders,
  IconPrinter,
  IconSearch,
  IconTruck,
} from '../ui/icons'

type Props = {
  online: boolean
  activeStoreId: string
  activeStoreLabel: string
  canSwitchStore: boolean
  /** Gérant et admin uniquement : valider / rejeter une commande. */
  canValidateOnlineOrders: boolean
  reviewer: { id: string; displayName: string }
  onPrintOrder: (order: OnlineOrder, autoPrint?: boolean) => void
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

export function OnlineOrdersValidationView({
  online,
  activeStoreId,
  activeStoreLabel,
  canSwitchStore,
  canValidateOnlineOrders,
  reviewer,
  onPrintOrder,
}: Props) {
  const toast = useToast()
  const orders = useLiveQuery(
    () => db.onlineOrders.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  )
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [allStores, setAllStores] = useState(false)
  const [reviewedLimit, setReviewedLimit] = useState(20)

  const scopedOrders = useMemo(() => {
    const list = orders ?? []
    if (!canSwitchStore) {
      return list.filter((o) => o.storeId === activeStoreId)
    }
    if (allStores) return list
    return list.filter((o) => o.storeId === activeStoreId)
  }, [orders, canSwitchStore, allStores, activeStoreId])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scopedOrders
    const qCompact = q.replace(/\s+/g, '')
    const qDigits = q.replace(/\D/g, '')
    return scopedOrders.filter((o) => {
      if (o.customerName.toLowerCase().includes(q)) return true
      if (o.id.slice(0, 8).toLowerCase().includes(qCompact)) return true
      if (qDigits.length >= 2) {
        const phone = (o.customerPhone ?? '').replace(/\D/g, '')
        if (phone.includes(qDigits)) return true
      }
      return false
    })
  }, [scopedOrders, search])

  const pending = useMemo(
    () => filteredOrders.filter((o) => o.status === 'pending'),
    [filteredOrders],
  )

  const reviewedSorted = useMemo(
    () =>
      [...filteredOrders.filter((o) => o.status !== 'pending')].sort(
        (a, b) =>
          (b.reviewedAt ?? b.createdAt) - (a.reviewedAt ?? a.createdAt),
      ),
    [filteredOrders],
  )

  const reviewedVisible = useMemo(
    () => reviewedSorted.slice(0, reviewedLimit),
    [reviewedSorted, reviewedLimit],
  )

  const hasMoreReviewed = reviewedSorted.length > reviewedLimit

  useEffect(() => {
    setReviewedLimit(20)
  }, [search, allStores, activeStoreId])

  const exportOrdersCsv = useCallback(() => {
    const rows: string[][] = [
      [
        'Réf',
        'Date création',
        'Magasin',
        'Client',
        'Téléphone',
        'Statut',
        'Total TTC',
        'Paiement',
        'Mode retrait',
        'Validée / rejetée le',
        'Par',
      ],
      ...filteredOrders.map((o) => [
        o.id.slice(0, 8).toUpperCase(),
        new Date(o.createdAt).toLocaleString('fr-FR'),
        o.storeName ?? o.storeId,
        o.customerName,
        o.customerPhone ?? '',
        o.status === 'pending'
          ? 'En attente'
          : o.status === 'approved'
            ? 'Validée'
            : 'Rejetée',
        String(o.totalTTC),
        paymentLabel(o.paymentMethod),
        o.fulfillmentMode === 'delivery' ? 'Livraison' : 'Retrait',
        o.reviewedAt
          ? new Date(o.reviewedAt).toLocaleString('fr-FR')
          : '',
        o.reviewedByDisplayName ?? '',
      ]),
    ]
    downloadTextFile(
      `commandes-ligne-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsvSemicolon(rows),
    )
    toast.success('Export prêt', `${filteredOrders.length} ligne(s)`)
  }, [filteredOrders, toast])

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
            const noteParts = [
              fresh.customerPhone,
              fresh.customerAddress,
              fresh.promoCode
                ? `Promo ${fresh.promoCode}${fresh.discountPct ? ` (${fresh.discountPct} %)` : ''}`
                : '',
            ].filter((v) => Boolean(v && String(v).length > 0))
            const note = noteParts.join(' · ')

            const saleRecord: Sale = {
              id: saleId,
              createdAt: fresh.createdAt,
              lines: fresh.lines,
              subtotalHT: fresh.subtotalHT,
              tva: fresh.tva,
              totalTTC: fresh.totalTTC,
              discountPct: fresh.discountPct ?? 0,
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
        subtitle={
          canValidateOnlineOrders
            ? 'Reçu et export pour toute l’équipe ; valider ou rejeter pour impacter stock et vente.'
            : 'Consultation, reçu et export : la validation ou le rejet est réservé au gérant ou à l’administrateur.'
        }
      />

      {!canValidateOnlineOrders ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          <span className="font-semibold">Profil caissier :</span> vous pouvez
          rechercher, exporter et imprimer les reçus. Contactez un gérant pour
          valider ou rejeter une commande.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <span className="mb-1 block text-[11px] font-medium text-zinc-600">
            Recherche client, téléphone ou référence
          </span>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex. Kouassi, 07…, A1B2C3D4"
            iconLeft={<IconSearch />}
            aria-label="Filtrer les commandes"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canSwitchStore ? (
            <Switch
              checked={allStores}
              onChange={(e) => {
                setAllStores(e.target.checked)
                setReviewedLimit(20)
              }}
              label="Tous les magasins"
              description={
                allStores
                  ? 'Vue réseau'
                  : `Filtré : ${activeStoreLabel}`
              }
            />
          ) : (
            <p className="text-[12px] text-zinc-500">
              Magasin :{' '}
              <span className="font-medium text-zinc-800">{activeStoreLabel}</span>
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconLeft={<IconDownload />}
            onClick={exportOrdersCsv}
            disabled={filteredOrders.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <SectionHeader title="À valider" />
      {pending.length === 0 ? (
        <EmptyState
          icon={<IconOnlineOrders />}
          title="Aucune commande en attente"
          description={
            search.trim()
              ? 'Aucun résultat pour cette recherche dans la sélection actuelle.'
              : 'Les nouvelles commandes web apparaîtront ici.'
          }
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
                      variant="secondary"
                      iconLeft={<IconPrinter />}
                      disabled={busy}
                      onClick={() => onPrintOrder(order, false)}
                    >
                      Reçu
                    </Button>
                    {canValidateOnlineOrders ? (
                      <>
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
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <SectionHeader title="Historique récent" />
      {reviewedSorted.length === 0 ? (
        <EmptyState
          title="Aucun historique"
          description={
            search.trim()
              ? 'Aucune commande traitée ne correspond à la recherche.'
              : 'Les commandes traitées apparaîtront ici.'
          }
          variant="flat"
        />
      ) : (
        <Card>
          <CardContent className="!p-0">
            <ul className="divide-y divide-zinc-100">
              {reviewedVisible.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]"
                >
                  <span className="min-w-0 truncate font-medium text-zinc-800">
                    <span className="font-mono-nums text-zinc-500">
                      {order.id.slice(0, 8).toUpperCase()}
                    </span>{' '}
                    · {order.customerName}
                    <span className="ml-2 font-mono-nums text-zinc-500">
                      {formatFCFA(order.totalTTC)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<IconPrinter />}
                      onClick={() => onPrintOrder(order, false)}
                      aria-label="Imprimer le reçu"
                    >
                      Reçu
                    </Button>
                    <Badge tone={order.status === 'approved' ? 'success' : 'danger'}>
                      {order.status === 'approved' ? 'Validée' : 'Rejetée'}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
            {hasMoreReviewed ? (
              <div className="border-t border-zinc-100 p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={() => setReviewedLimit((n) => n + 20)}
                >
                  Afficher 20 de plus (
                  {reviewedSorted.length - reviewedLimit}{' '}
                  masquée
                  {reviewedSorted.length - reviewedLimit > 1 ? 's' : ''})
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
