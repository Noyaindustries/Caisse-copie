import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useActiveStore } from '../context/ActiveStoreContext'
import { db } from '../db/db'
import { Button } from '../ui/Button'
import { formatFCFA } from '../lib/money'
import { describeSalePayment } from '../lib/paymentDisplay'
import {
  avgTicket,
  bucketSalesByLocalDay,
  filterSalesForStore,
  filterSalesOnLocalDay,
  filterSalesSince,
  filterSalesToday,
  paymentStatsByMethod,
  peakHourBuckets,
  sumTotalTTC,
  topProductsByQty,
} from '../lib/salesStats'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Kpi } from '../ui/Kpi'
import { PageHeader } from '../ui/PageHeader'
import {
  IconCalendar,
  IconClock,
  IconOnlineOrders,
  IconReceipt,
  IconShield,
  IconSparkles,
  IconStocks,
  IconSync,
  IconTag,
} from '../ui/icons'

const COLORS = {
  ink: '#09090b',
  inkMuted: '#52525b',
  border: '#e4e4e7',
  accent: '#059669',
  accentSoft: '#d1fae5',
  violet: '#7c3aed',
  amber: '#d97706',
  sky: '#0284c7',
  rose: '#e11d48',
}

const PAYMENT_COLORS: Record<string, string> = {
  Espèces: COLORS.accent,
  Carte: COLORS.violet,
  'Mobile money': COLORS.sky,
  Mixte: COLORS.amber,
}

function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ChartTooltip({
  label,
  rows,
}: {
  label?: string
  rows: { label: string; value: string; color?: string }[]
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
      {label ? (
        <p className="mb-1 font-semibold text-zinc-700">{label}</p>
      ) : null}
      <ul className="space-y-0.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            {r.color ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: r.color }}
              />
            ) : null}
            <span className="text-zinc-500">{r.label}</span>
            <span className="ml-auto font-mono-nums font-semibold text-zinc-900">
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type RechartsTooltip = {
  active?: boolean
  payload?: ReadonlyArray<{ value?: unknown; payload?: Record<string, unknown> }>
  label?: unknown
}

type DashboardProps = {
  /** Raccourci vers la file des commandes web (menu Ventes). */
  onOpenOnlineOrders?: () => void
  /** Raccourci vers l'historique des reçus/factures. */
  onOpenTicketsFactures?: () => void
}

export function DashboardView({
  onOpenOnlineOrders,
  onOpenTicketsFactures,
}: DashboardProps) {
  const { displayProducts, activeStoreId, activeStore } = useActiveStore()
  const salesRaw =
    useLiveQuery(() => db.sales.orderBy('createdAt').reverse().toArray(), [], []) ?? []
  const pendingSync = useLiveQuery(() => db.syncQueue.count(), [], 0) ?? 0
  const onlineOrdersRaw =
    useLiveQuery(() => db.onlineOrders.toArray(), [], []) ?? []
  const [now] = useState(Date.now)

  const sales = useMemo(
    () => filterSalesForStore(salesRaw, activeStoreId),
    [salesRaw, activeStoreId],
  )

  const sales7d = useMemo(() => filterSalesSince(sales, now - 7 * 86400000), [sales, now])
  const sales30d = useMemo(() => filterSalesSince(sales, now - 30 * 86400000), [sales, now])

  const today = useMemo(() => filterSalesToday(sales, now), [sales, now])
  const yesterdayYmd = useMemo(() => {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return localYmd(d)
  }, [now])
  const yesterday = useMemo(
    () => filterSalesOnLocalDay(sales, yesterdayYmd),
    [sales, yesterdayYmd],
  )

  const caToday = sumTotalTTC(today)
  const caYesterday = sumTotalTTC(yesterday)
  const caDelta = caToday - caYesterday
  const caDeltaPct =
    caYesterday > 0 ? Math.round((caDelta / caYesterday) * 100) : caToday > 0 ? 100 : 0

  const buckets14 = useMemo(() => bucketSalesByLocalDay(sales, 14, now), [sales, now])
  const buckets7 = useMemo(() => bucketSalesByLocalDay(sales, 7, now), [sales, now])
  const sparkData = useMemo(() => buckets7.map((b) => b.total), [buckets7])

  const areaData = useMemo(
    () =>
      buckets14.map((b) => ({
        label: b.label,
        ymd: b.ymd,
        total: b.total,
        tickets: b.count,
      })),
    [buckets14],
  )

  const peakData = useMemo(() => {
    const buckets = peakHourBuckets(sales7d)
    return buckets.map((h) => ({
      h: `${String(h.hour).padStart(2, '0')}h`,
      hour: h.hour,
      tickets: h.tickets,
      total: h.totalTTC,
    }))
  }, [sales7d])

  const maxPeak = useMemo(
    () => Math.max(1, ...peakData.map((p) => p.total)),
    [peakData],
  )

  const paymentPie = useMemo(() => {
    const stats = paymentStatsByMethod(sales7d)
    const rows: { name: string; value: number }[] = []
    if (stats.cash.totalTTC > 0)
      rows.push({ name: 'Espèces', value: stats.cash.totalTTC })
    if (stats.card.totalTTC > 0)
      rows.push({ name: 'Carte', value: stats.card.totalTTC })
    if (stats.mobile.totalTTC > 0)
      rows.push({ name: 'Mobile money', value: stats.mobile.totalTTC })
    if (stats.mixed.totalTTC > 0)
      rows.push({ name: 'Mixte', value: stats.mixed.totalTTC })
    return rows
  }, [sales7d])

  const topProducts = useMemo(() => topProductsByQty(sales30d, 8), [sales30d])
  const barTopData = useMemo(
    () =>
      [...topProducts]
        .reverse()
        .map((r) => ({
          name: r.name.length > 22 ? `${r.name.slice(0, 20)}…` : r.name,
          fullName: r.name,
          revenue: r.revenueTTC,
          qty: r.qty,
        })),
    [topProducts],
  )

  const lowStock = useMemo(
    () =>
      displayProducts.filter(
        (p) => p.stock > 0 && p.stock <= p.lowStockThreshold,
      ).length,
    [displayProducts],
  )

  const recent = useMemo(() => sales.slice(0, 8), [sales])

  const webPending = useMemo(
    () =>
      onlineOrdersRaw.filter(
        (o) => o.status === 'pending' && o.storeId === activeStoreId,
      ),
    [onlineOrdersRaw, activeStoreId],
  )
  const webPendingTotalTTC = useMemo(
    () => webPending.reduce((sum, o) => sum + o.totalTTC, 0),
    [webPending],
  )

  return (
    <div className="space-y-6 pb-6">
      <PageHeader
        eyebrow="Activité temps réel"
        title="Tableau de bord"
        subtitle={`${activeStore?.name ?? 'Magasin'} · données locales, synchronisation continue`}
        actions={
          onOpenTicketsFactures ? (
            <Button
              type="button"
              variant="secondary"
              iconLeft={<IconReceipt className="h-4 w-4" />}
              onClick={onOpenTicketsFactures}
            >
              Voir reçus
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="CA aujourd’hui"
          value={formatFCFA(caToday)}
          hint={`${today.length} ticket${today.length > 1 ? 's' : ''}`}
          delta={
            caYesterday > 0 || caToday > 0
              ? `${caDelta >= 0 ? '+' : ''}${formatFCFA(Math.abs(caDelta))}${
                  caYesterday > 0 ? ` · ${caDelta >= 0 ? '+' : '−'}${Math.abs(caDeltaPct)} %` : ''
                }`
              : undefined
          }
          deltaPositive={caDelta >= 0}
          spark={sparkData}
          tone="accent"
          icon={<IconSparkles />}
        />
        <Kpi
          label="Panier moyen"
          value={formatFCFA(Math.round(avgTicket(today)))}
          hint="Tickets du jour"
          tone="violet"
          icon={<IconReceipt />}
        />
        <Kpi
          label="Sous seuil stock"
          value={String(lowStock)}
          hint="Articles à surveiller"
          tone="amber"
          icon={<IconStocks />}
        />
        <Kpi
          label="File de synchronisation"
          value={String(pendingSync)}
          hint={pendingSync ? 'Événements en attente' : 'À jour'}
          tone="neutral"
          icon={<IconSync />}
        />
      </div>

      {webPending.length > 0 && onOpenOnlineOrders ? (
        <Card className="border-emerald-200/90 bg-emerald-50/50">
          <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <IconOnlineOrders className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">
                  Commandes web
                </p>
                <p className="mt-1 text-[15px] font-semibold text-zinc-900">
                  {webPending.length} commande{webPending.length > 1 ? 's' : ''} en
                  attente
                </p>
                <p className="mt-0.5 font-mono-nums text-[13px] text-zinc-600">
                  Montant cumulé {formatFCFA(webPendingTotalTTC)} TTC (panier non
                  encaissé)
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="accent"
              className="shrink-0"
              iconLeft={<IconOnlineOrders className="h-4 w-4" />}
              onClick={onOpenOnlineOrders}
            >
              Traiter la file
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            eyebrow={
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                  <IconCalendar className="h-3 w-3" />
                </span>
                14 derniers jours
              </span>
            }
            title="Chiffre d’affaires"
            subtitle="CA TTC net après remboursements, par jour calendaire"
          />
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="caFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke={COLORS.border} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: COLORS.inkMuted }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
                    angle={-30}
                    textAnchor="end"
                    height={50}
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
                    cursor={{ stroke: COLORS.border }}
                    content={(props: RechartsTooltip) => {
                      if (!props.active || !props.payload?.[0]) return null
                      const d = props.payload[0].payload as
                        | { tickets: number }
                        | undefined
                      return (
                        <ChartTooltip
                          label={String(props.label ?? '')}
                          rows={[
                            {
                              label: 'CA',
                              value: formatFCFA(Number(props.payload[0].value ?? 0)),
                              color: COLORS.accent,
                            },
                            {
                              label: 'Tickets',
                              value: String(d?.tickets ?? 0),
                            },
                          ]}
                        />
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={COLORS.accent}
                    strokeWidth={2}
                    fill="url(#caFill)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: COLORS.accent }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            eyebrow={
              <span className="inline-flex items-center gap-1.5 text-violet-700">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 text-violet-700">
                  <IconShield className="h-3 w-3" />
                </span>
                7 derniers jours
              </span>
            }
            title="Mix paiements"
            subtitle="Répartition TTC par mode"
          />
          <CardContent>
            {paymentPie.length === 0 ? (
              <EmptyState
                title="Pas encore de ventes"
                description="Les paiements apparaîtront ici dès la première transaction."
                variant="flat"
              />
            ) : (
              <>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentPie}
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {paymentPie.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={PAYMENT_COLORS[entry.name] ?? COLORS.violet}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={(props: RechartsTooltip) => {
                          if (!props.active || !props.payload?.[0]) return null
                          const p = props.payload[0]
                          const data = p.payload as { name: string }
                          return (
                            <ChartTooltip
                              rows={[
                                {
                                  label: data.name,
                                  value: formatFCFA(Number(p.value ?? 0)),
                                  color: PAYMENT_COLORS[data.name],
                                },
                              ]}
                            />
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 flex flex-wrap justify-center gap-3 text-[11px] text-zinc-600">
                  {paymentPie.map((p) => (
                    <li key={p.name} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: PAYMENT_COLORS[p.name] ?? COLORS.violet }}
                      />
                      {p.name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader
            eyebrow={
              <span className="inline-flex items-center gap-1.5 text-sky-700">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-100 text-sky-700">
                  <IconClock className="h-3 w-3" />
                </span>
                7 derniers jours
              </span>
            }
            title="Rythme horaire"
            subtitle="CA TTC agrégé par tranche horaire"
          />
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke={COLORS.border} vertical={false} />
                  <XAxis
                    dataKey="h"
                    tick={{ fontSize: 9, fill: COLORS.inkMuted }}
                    interval={2}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: '#fafafa' }}
                    content={(props: RechartsTooltip) => {
                      if (!props.active || !props.payload?.[0]) return null
                      const data = props.payload[0].payload as
                        | { h: string; tickets: number; total: number }
                        | undefined
                      if (!data) return null
                      return (
                        <ChartTooltip
                          label={data.h}
                          rows={[
                            { label: 'CA', value: formatFCFA(data.total) },
                            {
                              label: 'Tickets',
                              value: String(data.tickets),
                            },
                          ]}
                        />
                      )
                    }}
                  />
                  <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={16}>
                    {peakData.map((entry) => (
                      <Cell
                        key={entry.hour}
                        fill={
                          entry.total >= maxPeak * 0.8
                            ? COLORS.ink
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
          </CardContent>
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader
            eyebrow={
              <span className="inline-flex items-center gap-1.5 text-rose-700">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-rose-100 text-rose-700">
                  <IconTag className="h-3 w-3" />
                </span>
                30 derniers jours
              </span>
            }
            title="Top articles"
            subtitle="Quantités vendues × CA TTC"
          />
          <CardContent>
            {barTopData.length === 0 ? (
              <EmptyState
                title="Aucune donnée"
                description="Aucun article vendu sur la période."
                variant="flat"
              />
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={barTopData}
                    margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="2 6" stroke={COLORS.border} horizontal={false} />
                    <XAxis
                      type="number"
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
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={108}
                      tick={{ fontSize: 11, fill: COLORS.inkMuted }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#fafafa' }}
                      content={(props: RechartsTooltip) => {
                        if (!props.active || !props.payload?.[0]) return null
                        const row = props.payload[0].payload as
                          | { fullName: string; revenue: number; qty: number }
                          | undefined
                        if (!row) return null
                        return (
                          <ChartTooltip
                            label={row.fullName}
                            rows={[
                              { label: 'CA', value: formatFCFA(row.revenue) },
                              { label: 'Quantité', value: String(row.qty) },
                            ]}
                          />
                        )
                      }}
                    />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={14} fill={COLORS.ink} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Dernières opérations"
          subtitle="Tickets les plus récents sur ce magasin"
        />
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState
              icon={<IconReceipt />}
              title="Aucune vente enregistrée"
              description="Encaissez votre première vente depuis l’écran Caisse."
              variant="flat"
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {recent.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2 transition hover:border-zinc-200 hover:bg-zinc-50"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-zinc-900">
                      {new Date(s.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {s.lines.length} ligne{s.lines.length > 1 ? 's' : ''} ·{' '}
                      {describeSalePayment(s)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono-nums text-[14px] font-bold text-zinc-900">
                    {formatFCFA(s.totalTTC)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
