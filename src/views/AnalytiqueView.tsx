import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { PaymentMethod } from '../db/types'
import { downloadTextFile, toCsvSemicolon } from '../lib/analyticsExport'
import { formatFCFA } from '../lib/money'
import {
  periodMarginTotals,
  topProductsWithMargins,
} from '../lib/marginAnalytics'
import { paymentMethodShortLabel } from '../lib/paymentDisplay'
import {
  bucketSalesByLocalDay,
  paymentBreakdown,
  peakHourBuckets,
  sumTotalTTC,
} from '../lib/salesStats'

type Period = 7 | 14 | 30 | 90

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}h–${String((h + 1) % 24).padStart(2, '0')}h`
}

export function AnalytiqueView() {
  const sales = useLiveQuery(() => db.sales.toArray(), [], []) ?? []
  const products = useLiveQuery(() => db.products.toArray(), [], []) ?? []
  const [period, setPeriod] = useState<Period>(7)

  const rangeSales = useMemo(() => {
    const buckets = bucketSalesByLocalDay(sales, period)
    const firstYmd = buckets[0]?.ymd
    if (!firstYmd) return []
    return sales.filter((s) => {
      const ymd = new Date(s.createdAt)
      const y = ymd.getFullYear()
      const m = String(ymd.getMonth() + 1).padStart(2, '0')
      const d = String(ymd.getDate()).padStart(2, '0')
      const sYmd = `${y}-${m}-${d}`
      return sYmd >= firstYmd
    })
  }, [sales, period])

  const buckets = useMemo(
    () => bucketSalesByLocalDay(sales, period),
    [sales, period],
  )
  const maxTotal = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.total)),
    [buckets],
  )
  const caPeriod = useMemo(() => sumTotalTTC(rangeSales), [rangeSales])
  const tickets = rangeSales.length
  const breakdown = useMemo(() => paymentBreakdown(rangeSales), [rangeSales])
  const payKeys = useMemo(() => {
    const keys: PaymentMethod[] = ['cash', 'card', 'mobile']
    if (breakdown.mixed > 0) keys.push('mixed')
    return keys
  }, [breakdown.mixed])
  const sumPay =
    breakdown.cash +
      breakdown.card +
      breakdown.mobile +
      breakdown.mixed || 1

  const peaks = useMemo(() => peakHourBuckets(rangeSales), [rangeSales])
  const maxPeak = useMemo(
    () => Math.max(1, ...peaks.map((p) => p.totalTTC)),
    [peaks],
  )
  const peakTop = useMemo(() => {
    return [...peaks]
      .sort((a, b) => b.totalTTC - a.totalTTC)
      .slice(0, 5)
  }, [peaks])

  const top = useMemo(
    () => topProductsWithMargins(rangeSales, products, 12),
    [rangeSales, products],
  )
  const marginTotals = useMemo(
    () => periodMarginTotals(rangeSales, products),
    [rangeSales, products],
  )

  const periodLabel = `${period} jours`

  const exportSummaryCsv = useCallback(() => {
    const rows: string[][] = [
      ['Rapport analytique CaisseCI'],
      ['Période', periodLabel],
      ['CA net TTC', String(caPeriod)],
      ['Tickets', String(tickets)],
      ['Panier moyen TTC', String(tickets > 0 ? Math.round(caPeriod / tickets) : 0)],
      [],
      ['Marge (sur CA avec revient connu)', ''],
      ['CA total net (lignes)', String(marginTotals.revenueTTC)],
      ['CA avec prix de revient', String(marginTotals.revenueWithCostTTC)],
      ['Coût d’achat TTC', String(marginTotals.costTTC)],
      ['Marge TTC', String(marginTotals.marginOnKnownTTC)],
      ['Marge % sur part connue', marginTotals.marginPctOnKnown != null ? `${marginTotals.marginPctOnKnown}` : '—'],
      [],
      ['Paiements', 'Montant TTC'],
      ...payKeys.map((k) => [paymentMethodShortLabel(k), String(breakdown[k])]),
    ]
    downloadTextFile(
      `analytique-resume-${period}j.csv`,
      toCsvSemicolon(rows),
    )
  }, [
    period,
    periodLabel,
    caPeriod,
    tickets,
    marginTotals,
    payKeys,
    breakdown,
  ])

  const exportTopCsv = useCallback(() => {
    const rows: string[][] = [
      ['Article', 'Quantité', 'CA TTC net', 'Coût TTC', 'Marge TTC', 'Marge %'],
      ...top.map((r) => [
        r.name,
        String(r.qty),
        String(r.revenueTTC),
        r.costTTC != null ? String(r.costTTC) : '',
        r.marginTTC != null ? String(r.marginTTC) : '',
        r.marginPct != null ? String(r.marginPct) : '',
      ]),
    ]
    downloadTextFile(
      `analytique-top-produits-${period}j.csv`,
      toCsvSemicolon(rows),
    )
  }, [top, period])

  const exportPeaksCsv = useCallback(() => {
    const rows: string[][] = [
      ['Heure locale', 'Tickets', 'CA net TTC'],
      ...peaks.map((p) => [
        formatHour(p.hour),
        String(p.tickets),
        String(p.totalTTC),
      ]),
    ]
    downloadTextFile(
      `analytique-heures-${period}j.csv`,
      toCsvSemicolon(rows),
    )
  }, [peaks, period])

  const exportDailyCsv = useCallback(() => {
    const rows: string[][] = [
      ['Date', 'CA net TTC', 'Tickets'],
      ...buckets.map((b) => [b.ymd, String(b.total), String(b.count)]),
    ]
    downloadTextFile(
      `analytique-ventes-jour-${period}j.csv`,
      toCsvSemicolon(rows),
    )
  }, [buckets, period])

  /** Fichier unique « Excel » : CSV séparateur ; + BOM (ouvre dans Excel). */
  const exportExcelWorkbook = useCallback(() => {
    const rows: string[][] = [
      ['=== Résumé ==='],
      ['Période', periodLabel],
      ['CA net TTC', String(caPeriod)],
      ['Tickets', String(tickets)],
      [],
      ['=== Ventes par jour ==='],
      ['Date', 'CA net TTC', 'Tickets'],
      ...buckets.map((b) => [b.ymd, String(b.total), String(b.count)]),
      [],
      ['=== Heures de pointe ==='],
      ['Heure', 'Tickets', 'CA net TTC'],
      ...peaks.map((p) => [
        formatHour(p.hour),
        String(p.tickets),
        String(p.totalTTC),
      ]),
      [],
      ['=== Top produits ==='],
      ['Article', 'Qté', 'CA TTC', 'Coût', 'Marge TTC', 'Marge %'],
      ...top.map((r) => [
        r.name,
        String(r.qty),
        String(r.revenueTTC),
        r.costTTC != null ? String(r.costTTC) : '',
        r.marginTTC != null ? String(r.marginTTC) : '',
        r.marginPct != null ? String(r.marginPct) : '',
      ]),
    ]
    downloadTextFile(
      `analytique-complet-${period}j.csv`,
      toCsvSemicolon(rows),
    )
  }, [buckets, peaks, top, period, periodLabel, caPeriod, tickets])

  return (
    <>
      <div className="mb-6 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
          <span className="text-sm font-medium text-slate-600">Période :</span>
          {([7, 14, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setPeriod(d)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                period === d
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {d} jours
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-slate-400">
            Exports
          </span>
          <button
            type="button"
            onClick={exportSummaryCsv}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            CSV résumé
          </button>
          <button
            type="button"
            onClick={exportDailyCsv}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            CSV ventes / jour
          </button>
          <button
            type="button"
            onClick={exportPeaksCsv}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            CSV heures
          </button>
          <button
            type="button"
            onClick={exportTopCsv}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            CSV top produits
          </button>
          <button
            type="button"
            onClick={exportExcelWorkbook}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            Excel (CSV ;)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            PDF / Imprimer
          </button>
        </div>
      </div>

      <div id="print-analytique" className="space-y-8">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
          CaisseCI
        </p>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Tableau de bord analytique
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Période glissante : <strong>{periodLabel}</strong> · CA net après
          remboursements
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Ventes par jour
          </h2>
          <p className="text-sm text-slate-500">
            Agrégation journalière (calendrier local)
          </p>
          <div className="mt-6 flex h-56 items-end gap-1 sm:gap-2">
            {buckets.map((b) => {
              const h = Math.round((b.total / maxTotal) * 100)
              return (
                <div
                  key={b.ymd}
                  className="flex min-w-0 flex-1 flex-col items-center gap-2"
                >
                  <div className="flex h-48 w-full flex-col justify-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-slate-800 via-slate-600 to-emerald-500 shadow-inner"
                      style={{
                        height: `${Math.max(h, b.total > 0 ? 6 : 2)}%`,
                        minHeight: b.total > 0 ? 6 : 2,
                      }}
                      title={`${formatFCFA(b.total)} · ${b.count} tickets`}
                    />
                  </div>
                  <span className="hidden w-full truncate text-center text-[9px] font-medium text-slate-500 sm:block">
                    {b.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white shadow-lg shadow-emerald-600/20">
            <p className="text-xs font-medium uppercase tracking-wider text-white/80">
              CA période (net)
            </p>
            <p className="mt-2 font-mono-nums text-3xl font-bold">
              {formatFCFA(caPeriod)}
            </p>
            <p className="mt-2 text-sm text-white/85">
              {tickets} ticket{tickets > 1 ? 's' : ''}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Paiements</h3>
            <ul className="mt-3 space-y-3">
              {payKeys.map((k) => {
                const v = breakdown[k]
                return (
                  <li key={k}>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">
                        {paymentMethodShortLabel(k)}
                      </span>
                      <span className="font-mono-nums font-semibold text-slate-900">
                        {Math.round((v / sumPay) * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-800"
                        style={{ width: `${(v / sumPay) * 100}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-right font-mono-nums text-[10px] text-slate-500">
                      {formatFCFA(v)}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Heures de pointe
        </h2>
        <p className="text-sm text-slate-500">
          Répartition par heure locale (début de créneau) — tickets et CA net
        </p>
        <div className="mt-6 flex h-52 items-end gap-0.5 sm:gap-1">
          {peaks.map((p) => {
            const h = Math.round((p.totalTTC / maxPeak) * 100)
            return (
              <div
                key={p.hour}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
              >
                <div className="flex h-44 w-full flex-col justify-end">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-violet-700 to-violet-400"
                    style={{
                      height: `${Math.max(h, p.tickets > 0 ? 4 : 1)}%`,
                      minHeight: p.tickets > 0 ? 4 : 1,
                    }}
                    title={`${formatHour(p.hour)} : ${formatFCFA(p.totalTTC)} · ${p.tickets} tickets`}
                  />
                </div>
                <span className="text-[8px] font-medium text-slate-500 sm:text-[9px]">
                  {p.hour}h
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 rounded-xl bg-violet-50/80 p-4 text-sm">
          <p className="font-semibold text-violet-950">Top 5 créneaux (CA net)</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-violet-900">
            {peakTop.map((p) => (
              <li key={p.hour}>
                {formatHour(p.hour)} — {formatFCFA(p.totalTTC)} (
                {p.tickets} ticket{p.tickets > 1 ? 's' : ''})
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Marges (période)
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Basé sur le <strong>prix de revient TTC</strong> renseigné en fiche
            produit (catalogue). Hors articles sans revient : la marge n’est
            calculée que sur la partie connue.
          </p>
          <dl className="mt-4 space-y-2 font-mono-nums text-sm">
            <div className="flex justify-between border-b border-slate-100 py-2">
              <dt className="text-slate-600">CA net (lignes vendues)</dt>
              <dd className="font-semibold">{formatFCFA(marginTotals.revenueTTC)}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-2">
              <dt className="text-slate-600">CA avec revient connu</dt>
              <dd>{formatFCFA(marginTotals.revenueWithCostTTC)}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-2">
              <dt className="text-slate-600">Coût d’achat TTC (estimé)</dt>
              <dd>{formatFCFA(marginTotals.costTTC)}</dd>
            </div>
            <div className="flex justify-between py-2 text-base">
              <dt className="font-medium text-slate-800">Marge TTC (part connue)</dt>
              <dd className="font-bold text-emerald-700">
                {formatFCFA(marginTotals.marginOnKnownTTC)}
              </dd>
            </div>
            {marginTotals.marginPctOnKnown != null ? (
              <p className="text-xs text-slate-500">
                Taux de marge sur la part avec revient :{' '}
                <strong>{marginTotals.marginPctOnKnown} %</strong>
              </p>
            ) : (
              <p className="text-xs text-amber-800">
                Aucun prix de revient sur les produits vendus : renseignez-le
                dans le catalogue pour activer le calcul.
              </p>
            )}
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 ring-1 ring-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Exports</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-slate-600">
            <li>
              <strong>CSV</strong> : fichiers séparés (résumé, par jour, heures,
              top produits).
            </li>
            <li>
              <strong>Excel</strong> : fichier unique en CSV séparateur point-virgule
              + encodage UTF-8 (ouvre correctement dans Excel).
            </li>
            <li>
              <strong>PDF</strong> : utilisez « PDF / Imprimer » puis «
              Enregistrer au format PDF » dans la boîte d’impression du
              navigateur.
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Top produits & marges
        </h2>
        <p className="text-sm text-slate-500">
          Quantités et CA nets après remboursements
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="pb-3 pr-4">#</th>
                <th className="pb-3 pr-4">Article</th>
                <th className="pb-3 pr-4 text-right">Qté</th>
                <th className="pb-3 pr-4 text-right">CA TTC</th>
                <th className="pb-3 pr-4 text-right">Coût</th>
                <th className="pb-3 pr-4 text-right">Marge</th>
                <th className="pb-3 text-right">Marge %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {top.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-slate-500"
                  >
                    Pas encore de données sur cette période
                  </td>
                </tr>
              ) : (
                top.map((row, i) => (
                  <tr key={row.name} className="hover:bg-slate-50/80">
                    <td className="py-3 pr-4 font-mono-nums text-slate-400">
                      {i + 1}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {row.name}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-nums text-slate-700">
                      {row.qty}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-nums font-semibold text-emerald-700">
                      {formatFCFA(row.revenueTTC)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-nums text-slate-600">
                      {row.costTTC != null ? formatFCFA(row.costTTC) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-nums text-slate-800">
                      {row.marginTTC != null ? formatFCFA(row.marginTTC) : '—'}
                    </td>
                    <td className="py-3 text-right font-mono-nums text-slate-600">
                      {row.marginPct != null ? `${row.marginPct} %` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </>
  )
}
