import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { Kpi } from '../ui/Kpi'
import { PageHeader } from '../ui/PageHeader'
import { Tabs } from '../ui/Tabs'
import { Table, TBody, Td, Th, THead, Tr } from '../ui/Table'
import {
  IconDownload,
  IconFile,
  IconPrinter,
  IconSpreadsheet,
} from '../ui/icons'

type Period = 7 | 14 | 30 | 90

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}h–${String((h + 1) % 24).padStart(2, '0')}h`
}

const COLORS = {
  ink: '#09090b',
  inkMuted: '#52525b',
  border: '#e4e4e7',
  accent: '#059669',
  accentSoft: '#d1fae5',
  violet: '#7c3aed',
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
      return `${y}-${m}-${d}` >= firstYmd
    })
  }, [sales, period])

  const buckets = useMemo(
    () => bucketSalesByLocalDay(sales, period),
    [sales, period],
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
  const peakTop = useMemo(
    () => [...peaks].sort((a, b) => b.totalTTC - a.totalTTC).slice(0, 5),
    [peaks],
  )
  const maxPeak = useMemo(
    () => Math.max(1, ...peaks.map((p) => p.totalTTC)),
    [peaks],
  )

  const top = useMemo(
    () => topProductsWithMargins(rangeSales, products, 12),
    [rangeSales, products],
  )
  const marginTotals = useMemo(
    () => periodMarginTotals(rangeSales, products),
    [rangeSales, products],
  )

  const periodLabel = `${period} jours`
  const periodTabs = useMemo(
    () => [
      { id: '7' as const, label: '7 j' },
      { id: '14' as const, label: '14 j' },
      { id: '30' as const, label: '30 j' },
      { id: '90' as const, label: '90 j' },
    ],
    [],
  )

  const exportSummaryCsv = useCallback(() => {
    const rows: string[][] = [
      ['Rapport analytique CaisseCI'],
      ['Période', periodLabel],
      ['CA net TTC', String(caPeriod)],
      ['Tickets', String(tickets)],
      ['Panier moyen TTC', String(tickets > 0 ? Math.round(caPeriod / tickets) : 0)],
      [],
      ['Marge'],
      ['CA net (lignes)', String(marginTotals.revenueTTC)],
      ['CA avec revient', String(marginTotals.revenueWithCostTTC)],
      ['Coût TTC', String(marginTotals.costTTC)],
      ['Marge TTC', String(marginTotals.marginOnKnownTTC)],
      ['Marge %', marginTotals.marginPctOnKnown != null ? `${marginTotals.marginPctOnKnown}` : '—'],
      [],
      ['Paiements', 'Montant TTC'],
      ...payKeys.map((k) => [paymentMethodShortLabel(k), String(breakdown[k])]),
    ]
    downloadTextFile(`analytique-resume-${period}j.csv`, toCsvSemicolon(rows))
  }, [period, periodLabel, caPeriod, tickets, marginTotals, payKeys, breakdown])

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
    downloadTextFile(`analytique-heures-${period}j.csv`, toCsvSemicolon(rows))
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

  const dailyData = useMemo(
    () =>
      buckets.map((b) => ({
        label: b.label,
        ymd: b.ymd,
        total: b.total,
        tickets: b.count,
      })),
    [buckets],
  )

  const peakChartData = useMemo(
    () =>
      peaks.map((p) => ({
        h: `${String(p.hour).padStart(2, '0')}h`,
        hour: p.hour,
        tickets: p.tickets,
        total: p.totalTTC,
      })),
    [peaks],
  )

  return (
    <div className="space-y-6 pb-6">
      <PageHeader
        eyebrow="Analytique"
        title="Performance commerciale"
        subtitle={`Période glissante de ${periodLabel} · CA net après remboursements`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Tabs
              variant="segmented"
              items={periodTabs}
              active={String(period) as '7' | '14' | '30' | '90'}
              onChange={(id) => setPeriod(Number(id) as Period)}
            />
            <div className="ui-divider hidden h-6 w-px bg-zinc-200 sm:inline-block" />
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<IconDownload />}
              onClick={exportSummaryCsv}
            >
              Résumé
            </Button>
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<IconFile />}
              onClick={exportDailyCsv}
            >
              Ventes / jour
            </Button>
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<IconFile />}
              onClick={exportPeaksCsv}
            >
              Heures
            </Button>
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<IconFile />}
              onClick={exportTopCsv}
            >
              Top
            </Button>
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<IconSpreadsheet />}
              onClick={exportExcelWorkbook}
            >
              Excel
            </Button>
            <Button
              size="sm"
              variant="primary"
              iconLeft={<IconPrinter />}
              onClick={() => window.print()}
            >
              PDF
            </Button>
          </div>
        }
      />

      <div id="print-analytique" className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="CA net période"
            value={formatFCFA(caPeriod)}
            hint={`${tickets} ticket${tickets > 1 ? 's' : ''}`}
            tone="accent"
          />
          <Kpi
            label="Panier moyen"
            value={formatFCFA(tickets > 0 ? Math.round(caPeriod / tickets) : 0)}
            tone="violet"
          />
          <Kpi
            label="Marge TTC connue"
            value={formatFCFA(marginTotals.marginOnKnownTTC)}
            hint={
              marginTotals.marginPctOnKnown != null
                ? `Taux ${marginTotals.marginPctOnKnown} %`
                : 'Renseignez le revient'
            }
            tone="amber"
          />
          <Kpi
            label="Coût d’achat estimé"
            value={formatFCFA(marginTotals.costTTC)}
            hint="Sur articles avec revient"
            tone="neutral"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Ventes par jour"
              subtitle="Agrégation journalière (calendrier local)"
            />
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 6" stroke={COLORS.border} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fill: COLORS.inkMuted }}
                      axisLine={false}
                      tickLine={false}
                      interval={Math.max(0, Math.floor(dailyData.length / 14))}
                    />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1_000_000
                          ? `${(v / 1_000_000).toFixed(1)}M`
                          : v >= 1000
                            ? `${Math.round(v / 1000)}k`
                            : String(v)
                      }
                      tick={{ fontSize: 10, fill: COLORS.inkMuted }}
                      axisLine={false}
                      tickLine={false}
                      width={42}
                    />
                    <Tooltip
                      cursor={{ fill: '#fafafa' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.[0]) return null
                        const p = payload[0].payload as { tickets: number }
                        return (
                          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
                            <p className="font-semibold text-zinc-700">{label}</p>
                            <p className="font-mono-nums text-zinc-900">
                              {formatFCFA(Number(payload[0].value ?? 0))}
                            </p>
                            <p className="text-[11px] text-zinc-500">
                              {p.tickets} ticket{p.tickets > 1 ? 's' : ''}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="total" radius={[3, 3, 0, 0]} fill={COLORS.ink} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Paiements" subtitle="Répartition TTC" />
            <CardContent>
              <ul className="space-y-3">
                {payKeys.map((k) => {
                  const v = breakdown[k]
                  const pct = Math.round((v / sumPay) * 100)
                  return (
                    <li key={k}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-medium text-zinc-700">
                          {paymentMethodShortLabel(k)}
                        </span>
                        <span className="font-mono-nums font-semibold text-zinc-900">
                          {pct} %
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-zinc-900"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-right font-mono-nums text-[10px] text-zinc-500">
                        {formatFCFA(v)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Heures de pointe"
            subtitle="CA net agrégé par tranche horaire (début de créneau)"
          />
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke={COLORS.border} vertical={false} />
                  <XAxis
                    dataKey="h"
                    tick={{ fontSize: 9, fill: COLORS.inkMuted }}
                    axisLine={false}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: '#fafafa' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null
                      const d = payload[0].payload as
                        | { h: string; tickets: number; total: number }
                        | undefined
                      if (!d) return null
                      return (
                        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
                          <p className="font-semibold text-zinc-700">{d.h}</p>
                          <p className="font-mono-nums text-zinc-900">
                            {formatFCFA(d.total)}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {d.tickets} ticket{d.tickets > 1 ? 's' : ''}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={14}>
                    {peakChartData.map((entry) => (
                      <Cell
                        key={entry.hour}
                        fill={
                          entry.total >= maxPeak * 0.8
                            ? COLORS.violet
                            : entry.total >= maxPeak * 0.4
                              ? COLORS.accent
                              : COLORS.accentSoft
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {peakTop.length > 0 ? (
              <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-[12px]">
                <p className="font-semibold text-zinc-800">Top 5 créneaux</p>
                <ol className="mt-1.5 space-y-0.5 pl-5 text-zinc-700">
                  {peakTop.map((p) => (
                    <li key={p.hour} className="list-decimal">
                      <span className="font-mono-nums">{formatHour(p.hour)}</span>
                      {' · '}
                      <span className="font-mono-nums font-semibold text-zinc-900">
                        {formatFCFA(p.totalTTC)}
                      </span>{' '}
                      ({p.tickets} ticket{p.tickets > 1 ? 's' : ''})
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Top articles & marges"
            subtitle="Quantités et CA nets après remboursements"
          />
          <CardContent>
            <Table minWidth={620}>
              <THead>
                <Tr hover={false}>
                  <Th hideBelow="sm">#</Th>
                  <Th>Article</Th>
                  <Th align="right">Qté</Th>
                  <Th align="right">CA TTC</Th>
                  <Th align="right" hideBelow="md">Coût</Th>
                  <Th align="right">Marge</Th>
                  <Th align="right" hideBelow="md">Marge %</Th>
                </Tr>
              </THead>
              <TBody>
                {top.length === 0 ? (
                  <Tr hover={false}>
                    <Td colSpan={7} align="center" className="py-10 text-zinc-500">
                      Pas encore de données sur cette période
                    </Td>
                  </Tr>
                ) : (
                  top.map((row, i) => (
                    <Tr key={row.name}>
                      <Td hideBelow="sm" mono className="text-zinc-400">
                        {i + 1}
                      </Td>
                      <Td className="font-medium text-zinc-900">{row.name}</Td>
                      <Td align="right" mono>
                        {row.qty}
                      </Td>
                      <Td align="right" mono className="font-semibold">
                        {formatFCFA(row.revenueTTC)}
                      </Td>
                      <Td align="right" hideBelow="md" mono>
                        {row.costTTC != null ? formatFCFA(row.costTTC) : '—'}
                      </Td>
                      <Td align="right" mono>
                        {row.marginTTC != null ? formatFCFA(row.marginTTC) : '—'}
                      </Td>
                      <Td align="right" hideBelow="md" mono>
                        {row.marginPct != null ? `${row.marginPct} %` : '—'}
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
