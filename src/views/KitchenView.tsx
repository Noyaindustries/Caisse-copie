import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../db/db'
import type { KitchenPriority, KitchenStatus, OnlineOrder } from '../db/types'
import {
  getDeviceConnectivityDemo,
  getKitchenStationDemo,
  isKitchenModuleDemoOn,
} from '../lib/integrationsConfig'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Kpi } from '../ui/Kpi'
import { PageHeader } from '../ui/PageHeader'
import { useToast } from '../ui/Toast'
import { IconBell, IconCheck, IconClose, IconCollapse, IconExpand, IconFile } from '../ui/icons'

type Props = {
  activeStoreId: string
}

type KitchenCol = {
  status: KitchenStatus
  label: string
}

const COLUMNS: KitchenCol[] = [
  { status: 'queued', label: 'En file' },
  { status: 'preparing', label: 'Préparation' },
  { status: 'ready', label: 'Prêt' },
  { status: 'served', label: 'Servi' },
]
const URGENT_MINUTES = 20

function priorityWeight(priority?: KitchenPriority): number {
  if (priority === 'high') return 3
  if (priority === 'normal') return 2
  return 1
}

function priorityLabel(priority?: KitchenPriority): string {
  if (priority === 'high') return 'Haute'
  if (priority === 'low') return 'Basse'
  return 'Normale'
}

function priorityTone(
  priority?: KitchenPriority,
): 'danger' | 'warning' | 'neutral' {
  if (priority === 'high') return 'danger'
  if (priority === 'low') return 'neutral'
  return 'warning'
}

function nextStatus(status: KitchenStatus): KitchenStatus {
  if (status === 'queued') return 'preparing'
  if (status === 'preparing') return 'ready'
  if (status === 'ready') return 'served'
  return 'served'
}

function prevStatus(status: KitchenStatus): KitchenStatus {
  if (status === 'served') return 'ready'
  if (status === 'ready') return 'preparing'
  if (status === 'preparing') return 'queued'
  return 'queued'
}

export function KitchenView({ activeStoreId }: Props) {
  const toast = useToast()
  const [kdsMode, setKdsMode] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [slaAutoOn, setSlaAutoOn] = useState(true)
  const [slaThresholdMin, setSlaThresholdMin] = useState(15)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const knownQueuedRef = useRef<Set<string>>(new Set())
  const knownEscalatedRef = useRef<Set<string>>(new Set())
  const [kdsHardwareOn, setKdsHardwareOn] = useState(
    () => getDeviceConnectivityDemo().kitchenScreens,
  )
  const kitchenOn = isKitchenModuleDemoOn()
  const stationDefault = getKitchenStationDemo()
  const orders =
    useLiveQuery(
      () =>
        db.onlineOrders
          .where('storeId')
          .equals(activeStoreId)
          .reverse()
          .sortBy('createdAt'),
      [activeStoreId],
      [],
    ) ?? []

  const activeKitchenOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === 'approved' && o.kitchenStatus !== 'cancelled')
      .sort((a, b) => {
        const byPriority = priorityWeight(b.kitchenPriority) - priorityWeight(a.kitchenPriority)
        if (byPriority !== 0) return byPriority
        return b.createdAt - a.createdAt
      })
  }, [orders])

  // Transmission automatique persistée vers la cuisine:
  // si une commande validée n'a pas encore ses champs KDS, on les initialise.
  useEffect(() => {
    if (!kitchenOn || !kdsHardwareOn) return
    const missing = activeKitchenOrders.filter(
      (o) => !o.kitchenStatus || !o.kitchenTicketCode || !o.kitchenUpdatedAt,
    )
    if (missing.length === 0) return
    void db.transaction('rw', db.onlineOrders, async () => {
      for (const order of missing) {
        await db.onlineOrders.update(order.id, {
          kitchenStatus: order.kitchenStatus ?? 'queued',
          kitchenPriority:
            order.kitchenPriority ??
            (order.fulfillmentMode === 'delivery' ? 'high' : 'normal'),
          kitchenStation: order.kitchenStation ?? stationDefault,
          kitchenTicketCode: order.kitchenTicketCode ?? `K-${order.id.slice(0, 6).toUpperCase()}`,
          kitchenUpdatedAt: Date.now(),
        })
      }
    })
  }, [activeKitchenOrders, kdsHardwareOn, kitchenOn, stationDefault])

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    setKdsHardwareOn(getDeviceConnectivityDemo().kitchenScreens)
  }, [nowTick])

  useEffect(() => {
    if (!soundOn || !kdsHardwareOn) return
    const queuedOrders = activeKitchenOrders.filter(
      (o) => (o.kitchenStatus ?? 'queued') === 'queued',
    )
    const queuedIds = new Set(queuedOrders.map((o) => o.id))
    if (knownQueuedRef.current.size === 0) {
      knownQueuedRef.current = queuedIds
      return
    }
    const prevKnown = knownQueuedRef.current
    const hasNew = [...queuedIds].some((id) => !prevKnown.has(id))
    knownQueuedRef.current = queuedIds
    if (!hasNew) return
    const hasUrgentNew = queuedOrders.some((o) => {
      if (prevKnown.has(o.id)) return false
      return Math.floor((Date.now() - o.createdAt) / 60_000) >= URGENT_MINUTES
    })
    const ctx = new window.AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = hasUrgentNew ? 1174 : 880
    g.gain.value = 0.04
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    window.setTimeout(() => {
      o.stop()
      void ctx.close()
    }, hasUrgentNew ? 260 : 180)
  }, [activeKitchenOrders, kdsHardwareOn, soundOn])

  useEffect(() => {
    if (!slaAutoOn || !kdsHardwareOn) return
    const escalatedIds = new Set(knownEscalatedRef.current)
    const toEscalate = activeKitchenOrders.filter((o) => {
      const status = o.kitchenStatus ?? 'queued'
      if (status === 'served' || status === 'cancelled') return false
      const waitMin = Math.max(0, Math.floor((Date.now() - o.createdAt) / 60_000))
      const alreadyHigh = o.kitchenPriority === 'high'
      if (waitMin < slaThresholdMin || alreadyHigh) return false
      if (escalatedIds.has(o.id)) return false
      return true
    })
    if (toEscalate.length === 0) return
    for (const order of toEscalate) escalatedIds.add(order.id)
    knownEscalatedRef.current = escalatedIds
    void db.transaction('rw', db.onlineOrders, async () => {
      for (const order of toEscalate) {
        await db.onlineOrders.update(order.id, {
          kitchenPriority: 'high',
          kitchenUpdatedAt: Date.now(),
        })
      }
    }).then(() => {
      toast.warning(
        `SLA dépassé (${slaThresholdMin} min)`,
        `${toEscalate.length} ticket(s) passés en priorité haute`,
      )
      if (!soundOn) return
      const ctx = new window.AudioContext()
      const o1 = ctx.createOscillator()
      const o2 = ctx.createOscillator()
      const g = ctx.createGain()
      o1.type = 'square'
      o2.type = 'square'
      o1.frequency.value = 1174
      o2.frequency.value = 880
      g.gain.value = 0.04
      o1.connect(g)
      o2.connect(g)
      g.connect(ctx.destination)
      o1.start()
      window.setTimeout(() => o2.start(), 120)
      window.setTimeout(() => {
        o1.stop()
        o2.stop()
        void ctx.close()
      }, 380)
    })
  }, [activeKitchenOrders, kdsHardwareOn, slaAutoOn, slaThresholdMin, soundOn, toast])

  const byStatus = useMemo(() => {
    const m = new Map<KitchenStatus, OnlineOrder[]>()
    for (const col of COLUMNS) m.set(col.status, [])
    for (const order of activeKitchenOrders) {
      const status = order.kitchenStatus ?? 'queued'
      if (!m.has(status)) m.set(status, [])
      m.get(status)!.push(order)
    }
    for (const [status, rows] of m.entries()) {
      if (status === 'served') {
        rows.sort((a, b) => b.createdAt - a.createdAt)
      } else {
        rows.sort((a, b) => {
          const byPriority =
            priorityWeight(b.kitchenPriority) - priorityWeight(a.kitchenPriority)
          if (byPriority !== 0) return byPriority
          return a.createdAt - b.createdAt
        })
      }
    }
    return m
  }, [activeKitchenOrders])

  const oldestSlaExceededId = useMemo(() => {
    if (!slaAutoOn) return null
    let oldest: OnlineOrder | null = null
    for (const order of activeKitchenOrders) {
      const status = order.kitchenStatus ?? 'queued'
      if (status === 'served' || status === 'cancelled') continue
      const waitingMin = Math.max(0, Math.floor((nowTick - order.createdAt) / 60_000))
      if (waitingMin < slaThresholdMin) continue
      if (!oldest || order.createdAt < oldest.createdAt) oldest = order
    }
    return oldest?.id ?? null
  }, [activeKitchenOrders, nowTick, slaAutoOn, slaThresholdMin])

  const kpis = useMemo(() => {
    return {
      queued: byStatus.get('queued')?.length ?? 0,
      preparing: byStatus.get('preparing')?.length ?? 0,
      ready: byStatus.get('ready')?.length ?? 0,
      served: byStatus.get('served')?.length ?? 0,
    }
  }, [byStatus])

  const patchKitchen = useCallback(
    async (order: OnlineOrder, status: KitchenStatus) => {
      await db.onlineOrders.update(order.id, {
        kitchenStatus: status,
        kitchenPriority: order.kitchenPriority ?? (status === 'queued' ? 'high' : 'normal'),
        kitchenStation: order.kitchenStation ?? stationDefault,
        kitchenTicketCode: order.kitchenTicketCode ?? `K-${order.id.slice(0, 6).toUpperCase()}`,
        kitchenUpdatedAt: Date.now(),
      })
    },
    [stationDefault],
  )

  const moveNext = useCallback(
    async (order: OnlineOrder) => {
      const curr = order.kitchenStatus ?? 'queued'
      const next = nextStatus(curr)
      await patchKitchen(order, next)
      toast.success(`Ticket ${order.id.slice(0, 8).toUpperCase()} -> ${next}`)
    },
    [patchKitchen, toast],
  )

  const movePrev = useCallback(
    async (order: OnlineOrder) => {
      const curr = order.kitchenStatus ?? 'queued'
      const prev = prevStatus(curr)
      await patchKitchen(order, prev)
      toast.info(`Ticket ${order.id.slice(0, 8).toUpperCase()} -> ${prev}`)
    },
    [patchKitchen, toast],
  )

  const cancelTicket = useCallback(
    async (order: OnlineOrder) => {
      await db.onlineOrders.update(order.id, {
        kitchenStatus: 'cancelled',
        kitchenUpdatedAt: Date.now(),
      })
      toast.warning(`Ticket ${order.id.slice(0, 8).toUpperCase()} annulé`)
    },
    [toast],
  )

  const setPriority = useCallback(
    async (order: OnlineOrder, priority: KitchenPriority) => {
      await db.onlineOrders.update(order.id, {
        kitchenPriority: priority,
        kitchenUpdatedAt: Date.now(),
      })
      toast.info(`Priorité ${priorityLabel(priority)} · ${order.id.slice(0, 8).toUpperCase()}`)
    },
    [toast],
  )

  return (
    <div className={kdsMode ? 'fixed inset-0 z-50 overflow-auto bg-zinc-950 p-4' : 'space-y-5 pb-6'}>
      <PageHeader
        eyebrow="Module cuisine"
        title="Cuisine"
        subtitle="Pilotage des tickets de préparation par statut et station"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<IconBell />}
              onClick={() => setSoundOn((v) => !v)}
              disabled={!kdsHardwareOn}
            >
              {!kdsHardwareOn ? 'Son indisponible' : soundOn ? 'Son ON' : 'Son OFF'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSlaAutoOn((v) => !v)}
              disabled={!kdsHardwareOn}
            >
              {!kdsHardwareOn
                ? 'SLA auto indisponible'
                : slaAutoOn
                  ? 'SLA auto ON'
                  : 'SLA auto OFF'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              iconLeft={kdsMode ? <IconCollapse /> : <IconExpand />}
              onClick={() => setKdsMode((v) => !v)}
            >
              {kdsMode ? 'Quitter KDS' : 'Mode KDS'}
            </Button>
          </div>
        }
      />

      {!kitchenOn ? (
        <Card>
          <CardContent className="flex items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <IconFile className="h-4 w-4" />
            </span>
            <p className="text-[12px] text-zinc-700">
              Le module cuisine est désactivé dans les intégrations. Active-le pour
              alimenter automatiquement les tickets.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {kitchenOn && !kdsHardwareOn ? (
        <Card>
          <CardContent className="flex items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-700">
              <IconBell className="h-4 w-4" />
            </span>
            <p className="text-[12px] text-zinc-700">
              Matériel KDS indisponible (écran cuisine OFF). Les alertes sonores
              et la priorité SLA automatique sont suspendues tant que
              l’équipement n’est pas réactivé.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="En file" value={String(kpis.queued)} tone="amber" />
        <Kpi label="Préparation" value={String(kpis.preparing)} tone="neutral" />
        <Kpi label="Prêt" value={String(kpis.ready)} tone="accent" />
        <Kpi label="Servi" value={String(kpis.served)} tone="violet" />
      </div>
      <Card>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-zinc-600">
            Priorité automatique SLA: tickets non servis depuis plus de{' '}
            <strong>{slaThresholdMin} min</strong> passent en priorité haute.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSlaThresholdMin((v) => Math.max(5, v - 5))}
            >
              -5 min
            </Button>
            <span className="min-w-14 text-center font-mono-nums text-[12px] text-zinc-700">
              {slaThresholdMin} min
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSlaThresholdMin((v) => Math.min(60, v + 5))}
            >
              +5 min
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-2 sm:grid-cols-3">
        <Kpi
          label="Priorité haute"
          value={String(activeKitchenOrders.filter((o) => o.kitchenPriority === 'high').length)}
          tone="rose"
        />
        <Kpi
          label="Priorité normale"
          value={String(activeKitchenOrders.filter((o) => (o.kitchenPriority ?? 'normal') === 'normal').length)}
          tone="amber"
        />
        <Kpi
          label="Priorité basse"
          value={String(activeKitchenOrders.filter((o) => o.kitchenPriority === 'low').length)}
          tone="neutral"
        />
      </div>

      {activeKitchenOrders.length === 0 ? (
        <EmptyState
          title="Aucun ticket cuisine"
          description="Les commandes validées apparaissent automatiquement ici."
          variant="flat"
        />
      ) : (
        <div className={kdsMode ? 'grid gap-3 lg:grid-cols-2 2xl:grid-cols-4' : 'grid gap-3 xl:grid-cols-4'}>
          {COLUMNS.map((col) => {
            const rows = byStatus.get(col.status) ?? []
            return (
              <Card key={col.status}>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold text-zinc-900">{col.label}</h3>
                    <Badge tone="neutral">{rows.length}</Badge>
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-[11px] text-zinc-500">Aucun ticket</p>
                  ) : (
                    <div className="space-y-2">
                      {rows.map((order) => {
                        const waitingMin = Math.max(
                          0,
                          Math.floor((nowTick - order.createdAt) / 60_000),
                        )
                        const isPriority = waitingMin >= URGENT_MINUTES
                        const slaExceeded =
                          slaAutoOn &&
                          (order.kitchenStatus ?? 'queued') !== 'served' &&
                          (order.kitchenStatus ?? 'queued') !== 'cancelled' &&
                          waitingMin >= slaThresholdMin
                        const isSlaPulse = slaExceeded && order.id === oldestSlaExceededId
                        return (
                          <div
                            key={order.id}
                            className={
                              isSlaPulse
                                ? 'animate-pulse rounded-lg border-2 border-rose-500 bg-rose-100 p-2 shadow-sm shadow-rose-200'
                                : slaExceeded
                                  ? 'rounded-lg border-2 border-rose-500 bg-rose-100 p-2 shadow-sm shadow-rose-200'
                                : isPriority
                                  ? 'rounded-lg border border-rose-300 bg-rose-50 p-2'
                                  : 'rounded-lg border border-zinc-200 p-2'
                            }
                          >
                            <p className="text-[12px] font-semibold text-zinc-900">
                              {order.customerName}
                            </p>
                            <p className="font-mono-nums text-[11px] text-zinc-500">
                              {order.kitchenTicketCode ?? `K-${order.id.slice(0, 6).toUpperCase()}`}
                            </p>
                            <p className="mt-1 text-[11px] text-zinc-600">
                              {order.lines.length} ligne(s) ·{' '}
                              {order.kitchenStation ?? stationDefault}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <Badge tone={priorityTone(order.kitchenPriority)}>
                                Priorité {priorityLabel(order.kitchenPriority)}
                              </Badge>
                              {slaExceeded ? <Badge tone="danger">SLA dépassé</Badge> : null}
                              {order.fulfillmentMode === 'delivery' ? (
                                <Badge tone="info">Livraison</Badge>
                              ) : null}
                            </div>
                            <p
                              className={
                                isPriority
                                  ? 'mt-1 text-[11px] font-semibold text-rose-700'
                                  : 'mt-1 text-[11px] text-zinc-500'
                              }
                            >
                              Attente: {waitingMin} min
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void movePrev(order)}
                                disabled={(order.kitchenStatus ?? 'queued') === 'queued'}
                              >
                                Reculer
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                iconLeft={<IconCheck />}
                                onClick={() => void moveNext(order)}
                                disabled={(order.kitchenStatus ?? 'queued') === 'served'}
                              >
                                Avancer
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                iconLeft={<IconClose />}
                                onClick={() => void cancelTicket(order)}
                              >
                                Annuler
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void setPriority(order, 'high')}
                              >
                                Priorité haute
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void setPriority(order, 'normal')}
                              >
                                Priorité normale
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void setPriority(order, 'low')}
                              >
                                Priorité basse
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
