import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefundSaleModal } from '../components/RefundSaleModal'
import { db } from '../db/db'
import type { AuditEvent, AuditEventKind, Sale } from '../db/types'
import { formatFCFA } from '../lib/money'
import { paymentMethodShortLabel } from '../lib/paymentDisplay'
import { saleFullyRefunded, saleNetTTC } from '../lib/refundMath'
import {
  filterSalesToday,
  paymentBreakdown,
  paymentStatsByMethod,
  saleLocalYmd,
  sumTotalTTC,
} from '../lib/salesStats'
import { SESSION_ID } from '../lib/session'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Field, Input } from '../ui/Input'
import { Kpi } from '../ui/Kpi'
import { PageHeader, SectionHeader } from '../ui/PageHeader'
import { Table, TBody, Td, Th, THead, Tr } from '../ui/Table'
import { useToast } from '../ui/Toast'
import {
  IconCheckCircle,
  IconEye,
  IconPrinter,
  IconRefund,
} from '../ui/icons'

function auditKindLabel(k: AuditEventKind): string {
  switch (k) {
    case 'cart_cancelled':
      return 'Annulation panier'
    case 'sale_refund':
      return 'Remboursement'
    case 'promo_applied':
      return 'Code promo'
    case 'stock_adjusted':
      return 'Modification stock'
    case 'stock_transfer':
      return 'Transfert'
    case 'time_punch':
      return 'Pointage'
    default:
      return k
  }
}

function auditPayloadSummary(ev: AuditEvent): string | null {
  try {
    const o = JSON.parse(ev.payloadJson) as Record<string, unknown>
    if (ev.kind === 'promo_applied') {
      const code = o.code
      const applied = o.appliedPct
      const prev = o.previousPct
      return typeof code === 'string'
        ? `${code} → ${String(applied)} % (avant ${String(prev)} %)`
        : null
    }
    if (ev.kind === 'stock_adjusted') {
      const pq = o.previousQty
      const nq = o.newQty
      if (typeof pq === 'number' && typeof nq === 'number') {
        return `${pq} → ${nq} unité(s)`
      }
      return null
    }
    if (ev.kind === 'stock_transfer') {
      const q = o.qty
      const fn = o.fromStoreName
      const tn = o.toStoreName
      return typeof q === 'number'
        ? `${q} u. · ${String(fn ?? '?')} → ${String(tn ?? '?')}`
        : null
    }
    if (ev.kind === 'cart_cancelled') {
      const lines = o.lines as unknown[] | undefined
      return Array.isArray(lines) ? `${lines.length} ligne(s)` : null
    }
    if (ev.kind === 'time_punch') {
      const kind = o.kind === 'in' ? 'Arrivée' : o.kind === 'out' ? 'Départ' : null
      const store = o.storeName ?? o.storeId
      const note = o.note
      const bits = [kind, typeof store === 'string' ? store : null]
        .filter(Boolean)
        .join(' · ')
      if (typeof note === 'string' && note.trim()) {
        return `${bits} — ${note.trim()}`
      }
      return bits || null
    }
    return null
  } catch {
    return null
  }
}

type Props = {
  canDailyClosure: boolean
  canProcessRefunds: boolean
  currentProfile: { id: string; displayName: string }
  onViewReceipt: (sale: Sale) => void
}

export function JournalReportView({
  canDailyClosure,
  canProcessRefunds,
  currentProfile,
  onViewReceipt,
}: Props) {
  const toast = useToast()
  const sales = useLiveQuery(() => db.sales.toArray(), [], []) ?? []
  const auditEvents =
    useLiveQuery(
      () => db.auditEvents.orderBy('createdAt').reverse().limit(120).toArray(),
      [],
      [],
    ) ?? []
  const todayYmd = saleLocalYmd(Date.now())
  const dayRow = useLiveQuery(() => db.dayClosures.get(todayYmd), [todayYmd])

  const today = useMemo(() => filterSalesToday(sales), [sales])
  const total = useMemo(() => sumTotalTTC(today), [today])
  const breakdown = useMemo(() => paymentBreakdown(today), [today])
  const payStats = useMemo(() => paymentStatsByMethod(today), [today])
  const isClosed = dayRow?.closedAt != null
  const displayBreakdown = isClosed
    ? {
        cash: dayRow?.snapshotCash ?? 0,
        card: dayRow?.snapshotCard ?? 0,
        mobile: dayRow?.snapshotMobile ?? 0,
      }
    : breakdown
  const displayPayCounts = isClosed
    ? {
        cash: dayRow?.snapshotCashCount ?? 0,
        card: dayRow?.snapshotCardCount ?? 0,
        mobile: dayRow?.snapshotMobileCount ?? 0,
      }
    : {
        cash: payStats.cash.count,
        card: payStats.card.count,
        mobile: payStats.mobile.count,
      }
  const totalPay =
    displayBreakdown.cash +
      displayBreakdown.card +
      displayBreakdown.mobile || 1

  const openingFloat = dayRow?.openingFloat ?? 0
  const cashSalesToday = breakdown.cash
  const theoreticalCash = openingFloat + cashSalesToday

  const [openingEdit, setOpeningEdit] = useState('0')
  const [countedEdit, setCountedEdit] = useState('')
  const [closureNote, setClosureNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [refundSale, setRefundSale] = useState<Sale | null>(null)

  useEffect(() => {
    if (dayRow) setOpeningEdit(String(dayRow.openingFloat))
    else setOpeningEdit('0')
  }, [dayRow?.dateYmd, dayRow?.openingFloat, todayYmd])

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const ticketCount = isClosed
    ? (dayRow?.snapshotTransactionCount ?? today.length)
    : today.length
  const totalNet = isClosed ? (dayRow?.snapshotTotalTTC ?? total) : total
  const avgTicket =
    ticketCount > 0 ? Math.round(totalNet / ticketCount) : 0

  const saveOpeningFloat = useCallback(async () => {
    if (!canDailyClosure || isClosed) return
    const n = Number.parseInt(openingEdit.replace(/\s/g, ''), 10)
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Fond invalide')
      return
    }
    setBusy(true)
    try {
      const prev = (await db.dayClosures.get(todayYmd)) ?? {
        dateYmd: todayYmd,
        openingFloat: 0,
      }
      await db.dayClosures.put({ ...prev, dateYmd: todayYmd, openingFloat: n })
      toast.success('Fond enregistré', `${formatFCFA(n)}`)
    } finally {
      setBusy(false)
    }
  }, [canDailyClosure, isClosed, openingEdit, todayYmd, toast])

  const performClosure = useCallback(async () => {
    if (!canDailyClosure || isClosed) return
    if (
      !window.confirm(
        'Clôturer la journée ? Les totaux affichés seront figés pour cette date.',
      )
    ) {
      return
    }
    const stats = paymentStatsByMethod(today)
    const cashTot = stats.cash.totalTTC
    const opening = dayRow?.openingFloat ?? 0
    const expected = opening + cashTot
    const countedRaw = countedEdit.trim()
    const counted =
      countedRaw === ''
        ? undefined
        : Number.parseInt(countedRaw.replace(/\s/g, ''), 10)
    if (countedRaw !== '' && (!Number.isFinite(counted) || counted! < 0)) {
      toast.error('Montant compté invalide')
      return
    }
    setBusy(true)
    try {
      const prev = (await db.dayClosures.get(todayYmd)) ?? {
        dateYmd: todayYmd,
        openingFloat: opening,
      }
      await db.dayClosures.put({
        ...prev,
        dateYmd: todayYmd,
        openingFloat: opening,
        closedAt: Date.now(),
        snapshotTotalTTC: sumTotalTTC(today),
        snapshotTransactionCount: today.length,
        snapshotCash: cashTot,
        snapshotCard: stats.card.totalTTC,
        snapshotMobile: stats.mobile.totalTTC,
        snapshotCashCount: stats.cash.count,
        snapshotCardCount: stats.card.count,
        snapshotMobileCount: stats.mobile.count,
        expectedCashAtClose: expected,
        countedCash: counted,
        cashDifference:
          counted !== undefined ? counted - expected : undefined,
        note: closureNote.trim() || undefined,
        closedByProfileId: currentProfile.id,
        closedByDisplayName: currentProfile.displayName,
      })
      setCountedEdit('')
      setClosureNote('')
      toast.success('Journée clôturée')
    } finally {
      setBusy(false)
    }
  }, [
    canDailyClosure,
    isClosed,
    today,
    todayYmd,
    dayRow?.openingFloat,
    countedEdit,
    closureNote,
    currentProfile.id,
    currentProfile.displayName,
    toast,
  ])

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow="Rapport quotidien"
        title="Journal de caisse"
        subtitle={`${dateStr.charAt(0).toUpperCase()}${dateStr.slice(1)} · Session #${SESSION_ID}`}
        actions={
          <Button
            variant="secondary"
            iconLeft={<IconPrinter />}
            onClick={() => window.print()}
          >
            Imprimer
          </Button>
        }
      />

      {isClosed && dayRow?.closedAt ? (
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <IconCheckCircle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-zinc-900">
                Journée clôturée
              </p>
              <p className="text-[11px] text-zinc-500">
                {new Date(dayRow.closedAt).toLocaleString('fr-FR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {dayRow.closedByDisplayName
                  ? ` · ${dayRow.closedByDisplayName}`
                  : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div id="print-journal" className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Total ventes (TTC)" value={formatFCFA(totalNet)} tone="accent" />
          <Kpi label="Tickets" value={String(ticketCount)} tone="neutral" />
          <Kpi label="Panier moyen" value={formatFCFA(avgTicket)} tone="violet" />
          <Kpi
            label="Solde caisse théorique"
            value={formatFCFA(
              isClosed && dayRow?.expectedCashAtClose != null
                ? dayRow.expectedCashAtClose
                : theoreticalCash,
            )}
            hint="Fond + espèces"
            tone="amber"
          />
        </div>

        <Card>
          <CardContent>
            <h3 className="text-[14px] font-semibold text-zinc-900">
              Détail solde espèces
            </h3>
            <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                <dt className="text-zinc-600">Fond de caisse</dt>
                <dd className="font-mono-nums font-semibold">
                  {formatFCFA(openingFloat)}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                <dt className="text-zinc-600">+ Encaissements espèces</dt>
                <dd className="font-mono-nums font-semibold">
                  {formatFCFA(
                    isClosed ? (dayRow?.snapshotCash ?? 0) : cashSalesToday,
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 sm:col-span-2">
                <dt className="font-semibold text-emerald-900">= Théorique</dt>
                <dd className="font-mono-nums font-bold text-emerald-900">
                  {formatFCFA(
                    isClosed && dayRow?.expectedCashAtClose != null
                      ? dayRow.expectedCashAtClose
                      : theoreticalCash,
                  )}
                </dd>
              </div>
            </dl>

            {!isClosed && canDailyClosure ? (
              <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:items-end">
                <Field label="Modifier le fond (FCFA)" className="flex-1">
                  <Input
                    inputMode="numeric"
                    value={openingEdit}
                    onChange={(e) => setOpeningEdit(e.target.value)}
                    disabled={busy}
                    className="font-mono-nums"
                  />
                </Field>
                <Button
                  variant="primary"
                  loading={busy}
                  onClick={() => void saveOpeningFloat()}
                >
                  Enregistrer
                </Button>
              </div>
            ) : null}

            {isClosed &&
            dayRow?.countedCash != null &&
            dayRow.expectedCashAtClose != null ? (
              <div className="mt-4 space-y-1 rounded-lg border border-zinc-200 p-3 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Compté en caisse</span>
                  <span className="font-mono-nums font-semibold">
                    {formatFCFA(dayRow.countedCash)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Écart</span>
                  <span
                    className={
                      (dayRow.cashDifference ?? 0) === 0
                        ? 'font-mono-nums font-bold text-emerald-700'
                        : 'font-mono-nums font-bold text-amber-700'
                    }
                  >
                    {formatFCFA(dayRow.cashDifference ?? 0)}
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h3 className="text-[14px] font-semibold text-zinc-900">
              Modes de paiement
            </h3>
            <ul className="mt-3 space-y-3">
              {(
                [
                  ['cash', displayBreakdown.cash, displayPayCounts.cash] as const,
                  ['card', displayBreakdown.card, displayPayCounts.card] as const,
                  ['mobile', displayBreakdown.mobile, displayPayCounts.mobile] as const,
                ] as const
              ).map(([key, amount, count]) => {
                const pct = Math.round((amount / totalPay) * 100)
                return (
                  <li key={key}>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-medium text-zinc-700">
                        {paymentMethodShortLabel(key)}
                      </span>
                      <span className="font-mono-nums font-semibold text-zinc-900">
                        {formatFCFA(amount)}{' '}
                        <span className="text-[11px] font-normal text-zinc-500">
                          · {count} ticket{count > 1 ? 's' : ''}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-zinc-900"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        {!isClosed && canDailyClosure ? (
          <Card>
            <CardContent>
              <h3 className="text-[14px] font-semibold text-zinc-900">
                Clôture journalière
              </h3>
              <p className="mt-1 text-[12px] text-zinc-500">
                Figez les totaux du jour. Saisissez le montant compté pour calculer l’écart.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Field label="Compté en caisse (optionnel)">
                  <Input
                    inputMode="numeric"
                    value={countedEdit}
                    onChange={(e) => setCountedEdit(e.target.value)}
                    placeholder="—"
                    disabled={busy}
                    className="font-mono-nums"
                  />
                </Field>
                <Field label="Commentaire" className="sm:col-span-2">
                  <Input
                    value={closureNote}
                    onChange={(e) => setClosureNote(e.target.value)}
                    disabled={busy}
                  />
                </Field>
              </div>
              <Button
                variant="primary"
                className="mt-4"
                loading={busy}
                onClick={() => void performClosure()}
              >
                Clôturer la journée
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <SectionHeader
          title="Ventes du jour"
          subtitle="Montants nets après remboursements"
        />
        {today.length === 0 ? (
          <EmptyState title="Aucune vente aujourd’hui" variant="flat" />
        ) : (
          <Table minWidth={640}>
            <THead>
              <Tr hover={false}>
                <Th>Heure</Th>
                <Th hideBelow="md">Magasin</Th>
                <Th hideBelow="md">Caissier</Th>
                <Th>Paiement</Th>
                <Th align="right">Net</Th>
                <Th align="right">Reçu</Th>
                {canProcessRefunds ? <Th align="right" hideBelow="sm">Remb.</Th> : null}
              </Tr>
            </THead>
            <TBody>
              {[...today]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((s) => (
                  <Tr key={s.id}>
                    <Td mono>
                      {new Date(s.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Td>
                    <Td hideBelow="md" className="max-w-[140px] truncate">
                      {s.storeName ?? '—'}
                    </Td>
                    <Td hideBelow="md" className="max-w-[140px] truncate">
                      {s.cashierDisplayName ?? '—'}
                    </Td>
                    <Td>
                      <span className="block">
                        {paymentMethodShortLabel(s.paymentMethod)}
                      </span>
                      {saleFullyRefunded(s) ? (
                        <Badge tone="warning" className="mt-0.5">
                          Remb.
                        </Badge>
                      ) : null}
                    </Td>
                    <Td align="right" mono className="font-semibold">
                      {formatFCFA(saleNetTTC(s))}
                      {(s.refundsTotalTTC ?? 0) > 0 ? (
                        <span className="block text-[10px] text-amber-700">
                          −{formatFCFA(s.refundsTotalTTC ?? 0)}
                        </span>
                      ) : null}
                    </Td>
                    <Td align="right">
                      <Button
                        size="sm"
                        variant="ghost"
                        iconLeft={<IconEye />}
                        onClick={() => onViewReceipt(s)}
                        aria-label="Voir reçu"
                      >
                        <span className="hidden sm:inline">Voir</span>
                      </Button>
                    </Td>
                    {canProcessRefunds ? (
                      <Td align="right" hideBelow="sm">
                        {saleFullyRefunded(s) ? (
                          <span className="text-[11px] text-zinc-400">—</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<IconRefund />}
                            onClick={() => setRefundSale(s)}
                            aria-label="Rembourser"
                          >
                            <span className="hidden md:inline">Rembourser</span>
                          </Button>
                        )}
                      </Td>
                    ) : null}
                  </Tr>
                ))}
            </TBody>
          </Table>
        )}

        <SectionHeader
          title="Journal d’audit"
          subtitle="Append-only · données locales IndexedDB"
        />
        {auditEvents.length === 0 ? (
          <EmptyState title="Aucun événement" variant="flat" />
        ) : (
          <Card>
            <CardContent className="!p-0">
              <ul className="divide-y divide-zinc-100">
                {auditEvents.map((ev) => {
                  const detail = auditPayloadSummary(ev)
                  return (
                    <li key={ev.id} className="px-4 py-2.5 text-[12px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-zinc-800">
                          {auditKindLabel(ev.kind)}
                        </span>
                        <time
                          className="font-mono-nums text-[11px] text-zinc-500"
                          dateTime={new Date(ev.createdAt).toISOString()}
                        >
                          {new Date(ev.createdAt).toLocaleString('fr-FR', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </time>
                      </div>
                      <p className="mt-0.5 text-zinc-600">
                        <span className="font-medium text-zinc-700">
                          {ev.actorDisplayName}
                        </span>{' '}
                        — <span className="italic">« {ev.reason} »</span>
                      </p>
                      {detail ? (
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {detail}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {refundSale ? (
        <RefundSaleModal
          sale={refundSale}
          actor={{
            profileId: currentProfile.id,
            displayName: currentProfile.displayName,
          }}
          onClose={() => setRefundSale(null)}
          onDone={() => {}}
        />
      ) : null}
    </div>
  )
}
