import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefundSaleModal } from '../components/RefundSaleModal'
import { db } from '../db/db'
import type { AuditEvent, AuditEventKind, Sale } from '../db/types'
import { formatFCFA } from '../lib/money'
import { paymentMethodShortLabel } from '../lib/paymentDisplay'
import {
  saleFullyRefunded,
  saleNetTTC,
} from '../lib/refundMath'
import {
  filterSalesToday,
  paymentBreakdown,
  paymentStatsByMethod,
  saleLocalYmd,
  sumTotalTTC,
} from '../lib/salesStats'
import { SESSION_ID } from '../lib/session'

function auditKindLabel(k: AuditEventKind): string {
  switch (k) {
    case 'cart_cancelled':
      return 'Annulation panier'
    case 'sale_refund':
      return 'Remboursement vente'
    case 'promo_applied':
      return 'Remise / code promo'
    case 'stock_adjusted':
      return 'Modification stock'
    case 'stock_transfer':
      return 'Transfert inter-magasins'
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
      return Array.isArray(lines) ? `${lines.length} ligne(s) dans le panier` : null
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
  const sales = useLiveQuery(() => db.sales.toArray(), [], []) ?? []
  const auditEvents =
    useLiveQuery(
      () => db.auditEvents.orderBy('createdAt').reverse().limit(120).toArray(),
      [],
      [],
    ) ?? []
  const todayYmd = saleLocalYmd(Date.now())
  const dayRow = useLiveQuery(
    () => db.dayClosures.get(todayYmd),
    [todayYmd],
  )

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
    if (dayRow) {
      setOpeningEdit(String(dayRow.openingFloat))
    } else {
      setOpeningEdit('0')
    }
  }, [dayRow?.dateYmd, dayRow?.openingFloat, todayYmd])

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const saveOpeningFloat = useCallback(async () => {
    if (!canDailyClosure || isClosed) return
    const n = Number.parseInt(openingEdit.replace(/\s/g, ''), 10)
    if (!Number.isFinite(n) || n < 0) {
      window.alert('Fond de caisse invalide (entier ≥ 0).')
      return
    }
    setBusy(true)
    try {
      const prev = (await db.dayClosures.get(todayYmd)) ?? {
        dateYmd: todayYmd,
        openingFloat: 0,
      }
      await db.dayClosures.put({
        ...prev,
        dateYmd: todayYmd,
        openingFloat: n,
      })
    } finally {
      setBusy(false)
    }
  }, [canDailyClosure, isClosed, openingEdit, todayYmd])

  const performClosure = useCallback(async () => {
    if (!canDailyClosure) return
    if (isClosed) return
    if (
      !window.confirm(
        'Clôturer la journée ? Les totaux affichés seront figés pour cette date (vous pourrez encore consulter les ventes).',
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
      window.alert('Montant compté invalide.')
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
  ])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Imprimer le rapport
        </button>
      </div>

      <div
        id="print-journal"
        className="space-y-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100 md:p-10"
      >
        <header className="border-b border-slate-200 pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-600">
            CaisseCI
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">
            Rapport de caisse quotidien
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Synthèse des ventes, modes de paiement et solde espèces (jour
            calendaire local).
          </p>
          <p className="mt-2 capitalize text-slate-700">{dateStr}</p>
          <p className="mt-2 font-mono-nums text-sm text-slate-500">
            Session #{SESSION_ID}
          </p>
          {isClosed && dayRow?.closedAt ? (
            <p
              className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900"
              role="status"
            >
              Journée clôturée le{' '}
              {new Date(dayRow.closedAt).toLocaleString('fr-FR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              {dayRow.closedByDisplayName
                ? ` · ${dayRow.closedByDisplayName}`
                : ''}
            </p>
          ) : null}
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-xl">
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              Total des ventes (TTC)
            </p>
            <p className="mt-2 font-mono-nums text-2xl font-bold tracking-tight sm:text-3xl">
              {formatFCFA(isClosed ? (dayRow?.snapshotTotalTTC ?? total) : total)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Nombre de transactions
            </p>
            <p className="mt-2 font-mono-nums text-3xl font-bold text-slate-900">
              {isClosed
                ? (dayRow?.snapshotTransactionCount ?? today.length)
                : today.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 ring-1 ring-slate-100">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Panier moyen
            </p>
            <p className="mt-2 font-mono-nums text-3xl font-bold text-slate-900">
              {formatFCFA(
                (isClosed
                  ? dayRow?.snapshotTransactionCount ?? 0
                  : today.length)
                  ? Math.round(
                      (isClosed
                        ? dayRow?.snapshotTotalTTC ?? 0
                        : total) /
                        (isClosed
                          ? dayRow?.snapshotTransactionCount ?? 1
                          : today.length),
                    )
                  : 0,
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-6 ring-1 ring-amber-100">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-900/80">
              Solde caisse (espèces)
            </p>
            <p className="mt-1 text-[11px] text-amber-800/80">
              Fond + encaissements du jour
            </p>
            <p className="mt-2 font-mono-nums text-2xl font-bold text-amber-950">
              {formatFCFA(
                isClosed && dayRow?.expectedCashAtClose != null
                  ? dayRow.expectedCashAtClose
                  : theoreticalCash,
              )}
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 ring-1 ring-slate-100">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Détail solde espèces
          </h3>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">
              <dt className="text-slate-600">Fond de caisse (ouverture)</dt>
              <dd className="font-mono-nums font-semibold text-slate-900">
                {formatFCFA(openingFloat)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">
              <dt className="text-slate-600">+ Encaissements espèces (jour)</dt>
              <dd className="font-mono-nums font-semibold text-slate-900">
                {formatFCFA(
                  isClosed ? (dayRow?.snapshotCash ?? 0) : cashSalesToday,
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100 sm:col-span-2">
              <dt className="font-medium text-emerald-900">
                = Solde théorique en caisse
              </dt>
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
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-end">
              <label className="flex-1 text-xs font-medium text-slate-600">
                Modifier le fond de caisse (FCFA)
                <input
                  inputMode="numeric"
                  value={openingEdit}
                  onChange={(e) => setOpeningEdit(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-nums text-sm"
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveOpeningFloat()}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
              >
                Enregistrer le fond
              </button>
            </div>
          ) : null}

          {isClosed &&
          dayRow?.countedCash != null &&
          dayRow.expectedCashAtClose != null ? (
            <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Montant compté en caisse</span>
                <span className="font-mono-nums font-semibold">
                  {formatFCFA(dayRow.countedCash)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Écart (compté − théorique)</span>
                <span
                  className={`font-mono-nums font-bold ${
                    (dayRow.cashDifference ?? 0) === 0
                      ? 'text-emerald-700'
                      : 'text-amber-800'
                  }`}
                >
                  {formatFCFA(dayRow.cashDifference ?? 0)}
                </span>
              </div>
            </div>
          ) : null}
          {isClosed && dayRow?.note ? (
            <p className="mt-3 text-sm text-slate-600">
              <strong>Note clôture :</strong> {dayRow.note}
            </p>
          ) : null}
        </section>

        <section>
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Répartition par mode de paiement
          </h3>
          <ul className="mt-4 space-y-4">
            {(
              [
                ['cash', displayBreakdown.cash, displayPayCounts.cash] as const,
                ['card', displayBreakdown.card, displayPayCounts.card] as const,
                [
                  'mobile',
                  displayBreakdown.mobile,
                  displayPayCounts.mobile,
                ] as const,
              ] as const
            ).map(([key, amount, count]) => {
              const pct = Math.round((amount / totalPay) * 100)
              return (
                <li key={key}>
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-700">
                      {paymentMethodShortLabel(key)}
                    </span>
                    <span className="font-mono-nums font-semibold text-slate-900">
                      {formatFCFA(amount)}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        ({count} ticket{count > 1 ? 's' : ''})
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          {payStats.mixed.count > 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              {payStats.mixed.count} vente
              {payStats.mixed.count > 1 ? 's' : ''} en{' '}
              <strong>paiement mixte</strong> — montants ventilés ci-dessus par
              canal.
            </p>
          ) : null}
        </section>

        {!isClosed && canDailyClosure ? (
          <section className="rounded-2xl border border-violet-200/80 bg-violet-50/40 p-5 ring-1 ring-violet-100">
            <h3 className="font-display text-sm font-semibold text-violet-950">
              Clôture journalière
            </h3>
            <p className="mt-1 text-xs text-violet-900/80">
              Figez les totaux du jour. Saisissez le montant physique en caisse
              après comptage (optionnel) pour calculer l’écart.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-violet-900/90">
                Montant compté en caisse (optionnel)
                <input
                  inputMode="numeric"
                  value={countedEdit}
                  onChange={(e) => setCountedEdit(e.target.value)}
                  placeholder="Laisser vide si non compté"
                  disabled={busy}
                  className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 font-mono-nums text-sm"
                />
              </label>
              <label className="text-xs font-medium text-violet-900/90 sm:col-span-2">
                Commentaire (optionnel)
                <input
                  value={closureNote}
                  onChange={(e) => setClosureNote(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void performClosure()}
              className="mt-4 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Enregistrement…' : 'Clôturer la journée'}
            </button>
            {today.length === 0 ? (
              <p className="mt-2 text-xs text-violet-800">
                Aucune vente enregistrée : la clôture figera tout de même la
                journée (totaux à zéro).
              </p>
            ) : null}
          </section>
        ) : null}

        {!isClosed && !canDailyClosure ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            La <strong>clôture journalière</strong> et la modification du fond de
            caisse sont réservées aux profils autorisés. Vous pouvez consulter le
            rapport et imprimer.
          </p>
        ) : null}

        {isClosed && canDailyClosure ? (
          <p className="text-xs text-slate-500">
            Journée déjà clôturée. Pour corriger une erreur, contactez le
            support ou réinitialisez la ligne du jour en base (mode avancé).
          </p>
        ) : null}

        <section>
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Ventes du jour & reçus
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Montant = CA net (après remboursements).             Remboursements : profils autorisés
            uniquement, avec motif et trace en audit.
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Heure</th>
                    <th className="px-3 py-2">Magasin</th>
                    <th className="px-3 py-2">Caissier</th>
                    <th className="px-3 py-2">Paiement</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-right">Reçu</th>
                    {canProcessRefunds ? (
                      <th className="px-3 py-2 text-right">Remb.</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {today.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canProcessRefunds ? 7 : 6}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        Aucune vente aujourd’hui
                      </td>
                    </tr>
                  ) : (
                    [...today]
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2 font-mono-nums text-slate-700">
                            {new Date(s.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="max-w-[120px] truncate px-3 py-2 text-slate-600">
                            {s.storeName ?? '—'}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-slate-600">
                            {s.cashierDisplayName ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {paymentMethodShortLabel(s.paymentMethod)}
                            {saleFullyRefunded(s) ? (
                              <span className="ml-1 text-[10px] font-semibold uppercase text-amber-700">
                                remboursé
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right font-mono-nums font-medium text-emerald-700">
                            {formatFCFA(saleNetTTC(s))}
                            {(s.refundsTotalTTC ?? 0) > 0 ? (
                              <span className="block text-[10px] font-normal text-amber-800">
                                −{formatFCFA(s.refundsTotalTTC ?? 0)} remb.
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => onViewReceipt(s)}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                            >
                              Voir
                            </button>
                          </td>
                          {canProcessRefunds ? (
                            <td className="px-3 py-2 text-right">
                              {saleFullyRefunded(s) ? (
                                <span className="text-[10px] text-slate-400">—</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setRefundSale(s)}
                                  className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                                >
                                  Rembourser
                                </button>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Journal d’audit
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Horodatage des actions sensibles (annulation, remise, stock,
            remboursement, transfert). Écriture{' '}
            <strong className="font-medium text-slate-700">append-only</strong>{' '}
            : aucune modification ni suppression depuis l’application — données
            locales IndexedDB.
          </p>
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto text-xs">
            {auditEvents.length === 0 ? (
              <li className="text-slate-500">Aucun événement enregistré.</li>
            ) : (
              auditEvents.map((ev) => {
                const detail = auditPayloadSummary(ev)
                return (
                  <li
                    key={ev.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                  >
                    <div className="flex flex-wrap justify-between gap-1 font-medium text-slate-800">
                      <span>{auditKindLabel(ev.kind)}</span>
                      <time
                        className="font-mono-nums text-slate-500"
                        dateTime={new Date(ev.createdAt).toISOString()}
                      >
                        {new Date(ev.createdAt).toLocaleString('fr-FR', {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })}
                      </time>
                    </div>
                    <p className="mt-1 text-slate-600">
                      {ev.actorDisplayName} —{' '}
                      <span className="italic">« {ev.reason} »</span>
                    </p>
                    {detail ? (
                      <p className="mt-0.5 text-[11px] text-slate-500">{detail}</p>
                    ) : null}
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                      id {ev.id.slice(0, 8)}…
                    </p>
                    {ev.relatedSaleId ? (
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                        Vente {ev.relatedSaleId.slice(0, 8)}…
                      </p>
                    ) : null}
                  </li>
                )
              })
            )}
          </ul>
        </section>

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

        <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          Rapport de caisse CaisseCI — données locales (IndexedDB).
        </footer>
      </div>
    </div>
  )
}
