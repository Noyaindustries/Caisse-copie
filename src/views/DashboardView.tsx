import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { useActiveStore } from '../context/ActiveStoreContext'
import { db } from '../db/db'
import { formatFCFA } from '../lib/money'
import { describeSalePayment } from '../lib/paymentDisplay'
import {
  avgTicket,
  bucketSalesByLocalDay,
  filterSalesToday,
  sumTotalTTC,
} from '../lib/salesStats'

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent: 'emerald' | 'amber' | 'violet' | 'slate'
}) {
  const ring =
    accent === 'emerald'
      ? 'from-emerald-500/10 to-teal-500/5 ring-emerald-500/15'
      : accent === 'amber'
        ? 'from-amber-500/10 to-orange-500/5 ring-amber-500/15'
        : accent === 'violet'
          ? 'from-violet-500/10 to-purple-500/5 ring-violet-500/15'
          : 'from-slate-500/10 to-slate-400/5 ring-slate-200'

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 ring-1 ${ring}`}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-mono-nums text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs text-slate-500">{sub}</p>
      ) : null}
    </div>
  )
}

export function DashboardView() {
  const { displayProducts } = useActiveStore()
  const sales = useLiveQuery(() => db.sales.orderBy('createdAt').reverse().toArray(), [], []) ?? []
  const pendingSync = useLiveQuery(() => db.syncQueue.count(), [], 0) ?? 0
  const lowStock = useMemo(
    () =>
      displayProducts.filter(
        (p) => p.stock > 0 && p.stock <= p.lowStockThreshold,
      ).length,
    [displayProducts],
  )

  const today = useMemo(() => filterSalesToday(sales), [sales])
  const weekBuckets = useMemo(
    () => bucketSalesByLocalDay(sales, 7),
    [sales],
  )
  const maxWeek = useMemo(
    () => Math.max(1, ...weekBuckets.map((b) => b.total)),
    [weekBuckets],
  )

  const recent = useMemo(() => sales.slice(0, 6), [sales])

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="CA aujourd’hui"
          value={formatFCFA(sumTotalTTC(today))}
          sub={`${today.length} ticket${today.length > 1 ? 's' : ''}`}
          accent="emerald"
        />
        <StatTile
          label="Panier moyen"
          value={formatFCFA(Math.round(avgTicket(today)))}
          sub="Sur la journée en cours"
          accent="violet"
        />
        <StatTile
          label="Alertes stock"
          value={String(lowStock)}
          sub="Articles sous le seuil"
          accent="amber"
        />
        <StatTile
          label="File sync"
          value={String(pendingSync)}
          sub={pendingSync ? 'À synchroniser' : 'À jour'}
          accent="slate"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/40 ring-1 ring-slate-100 lg:col-span-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Activité sur 7 jours
              </h2>
              <p className="text-sm text-slate-500">
                Chiffre d’affaires TTC par jour
              </p>
            </div>
          </div>
          <div className="mt-8 flex h-48 items-end gap-2">
            {weekBuckets.map((b) => {
              const h = Math.round((b.total / maxWeek) * 100)
              return (
                <div
                  key={b.ymd}
                  className="flex min-w-0 flex-1 flex-col items-center gap-2"
                >
                  <div className="flex h-40 w-full flex-col justify-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-500"
                      style={{
                        height: `${Math.max(h, b.total > 0 ? 8 : 2)}%`,
                        minHeight: b.total > 0 ? 8 : 2,
                      }}
                      title={`${b.label} : ${formatFCFA(b.total)}`}
                    />
                  </div>
                  <span className="w-full truncate text-center text-[10px] font-medium text-slate-500">
                    {b.label}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/40 ring-1 ring-slate-100 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Dernières ventes
          </h2>
          <p className="text-sm text-slate-500">Les opérations les plus récentes</p>
          <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {recent.length === 0 ? (
              <li className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">
                Aucune vente enregistrée
              </li>
            ) : (
              recent.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {new Date(s.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.lines.length} ligne{s.lines.length > 1 ? 's' : ''} ·{' '}
                      {describeSalePayment(s)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono-nums text-sm font-semibold text-emerald-700">
                    {formatFCFA(s.totalTTC)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}
