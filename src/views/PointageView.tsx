import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listStaffProfiles,
  subscribeStaffProfiles,
} from '../auth/profiles'
import type { StaffProfile } from '../auth/types'
import { db } from '../db/db'
import type { TimePunch, TimePunchKind } from '../db/types'
import { appendAuditEvent } from '../lib/auditLog'
import { saleLocalYmd } from '../lib/salesStats'
import {
  formatDateLong,
  formatDurationMs,
  formatTimeHm,
  isCurrentlyIn,
  sortPunchesAsc,
  totalWorkedMs,
} from '../lib/timePunchHelpers'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { Field, Input, Select } from '../ui/Input'
import { Kpi } from '../ui/Kpi'
import { PageHeader, SectionHeader } from '../ui/PageHeader'
import { Table, TBody, Td, Th, THead, Tr } from '../ui/Table'
import { useToast } from '../ui/Toast'
import { IconDownload, IconLogin, IconLogout } from '../ui/icons'

type Props = {
  staff: StaffProfile
  activeStoreId: string
  activeStoreLabel: string
  canViewTeamPointage: boolean
}

function punchKindLabel(k: TimePunchKind): string {
  return k === 'in' ? 'Arrivée' : 'Départ'
}

function punchKindBadgeTone(
  k: TimePunchKind,
): 'success' | 'neutral' {
  return k === 'in' ? 'success' : 'neutral'
}

function downloadCsv(filename: string, rows: string[][]): void {
  const bom = '\uFEFF'
  const esc = (c: string) => `"${c.replace(/"/g, '""')}"`
  const lines = rows.map((r) => r.map((c) => esc(String(c))).join(','))
  const blob = new Blob([bom + lines.join('\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function PointageView({
  staff,
  activeStoreId,
  activeStoreLabel,
  canViewTeamPointage,
}: Props) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [profiles, setProfiles] = useState(() => listStaffProfiles())
  const [filterProfileId, setFilterProfileId] = useState<string>('all')
  const [clock, setClock] = useState(() => Date.now())

  useEffect(() => {
    return subscribeStaffProfiles(() => {
      setProfiles(listStaffProfiles())
    })
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const punchesRaw =
    useLiveQuery(
      () => db.timePunches.orderBy('createdAt').reverse().limit(900).toArray(),
      [],
      [],
    ) ?? []

  const todayYmd = saleLocalYmd(clock)

  const allMineAsc = useMemo(() => {
    const mine = punchesRaw.filter((p) => p.profileId === staff.id)
    return sortPunchesAsc(mine)
  }, [punchesRaw, staff.id])

  const myTodayAsc = useMemo(() => {
    const mine = punchesRaw.filter(
      (p) =>
        p.profileId === staff.id && saleLocalYmd(p.createdAt) === todayYmd,
    )
    return sortPunchesAsc(mine)
  }, [punchesRaw, staff.id, todayYmd])

  const onSite = useMemo(() => isCurrentlyIn(allMineAsc), [allMineAsc])

  const workedTodayMs = useMemo(() => totalWorkedMs(myTodayAsc), [myTodayAsc])

  const firstInToday = useMemo(
    () => myTodayAsc.find((p) => p.kind === 'in'),
    [myTodayAsc],
  )

  const currentOpenInAt = useMemo(() => {
    if (!onSite || allMineAsc.length === 0) return undefined
    return allMineAsc[allMineAsc.length - 1].createdAt
  }, [allMineAsc, onSite])

  const lastOutToday = useMemo(() => {
    for (let i = myTodayAsc.length - 1; i >= 0; i--) {
      if (myTodayAsc[i].kind === 'out') return myTodayAsc[i]
    }
    return undefined
  }, [myTodayAsc])

  const lastPunchMine = useMemo(() => {
    if (allMineAsc.length === 0) return undefined
    return allMineAsc[allMineAsc.length - 1]
  }, [allMineAsc])

  const tableRows = useMemo(() => {
    let rows = punchesRaw
    if (!canViewTeamPointage) {
      rows = rows.filter((p) => p.profileId === staff.id)
    } else if (filterProfileId !== 'all') {
      rows = rows.filter((p) => p.profileId === filterProfileId)
    }
    const since = Date.now() - 14 * 24 * 60 * 60 * 1000
    return rows.filter((p) => p.createdAt >= since)
  }, [punchesRaw, canViewTeamPointage, filterProfileId, staff.id])

  const sortedTableDesc = useMemo(
    () => [...tableRows].sort((a, b) => b.createdAt - a.createdAt),
    [tableRows],
  )

  const handlePunch = useCallback(
    async (kind: TimePunchKind) => {
      if (busy) return
      if (lastPunchMine?.kind === kind) {
        toast.warning(
          'Pointage refusé',
          `Le dernier enregistrement est déjà une « ${punchKindLabel(kind).toLowerCase()} ». Enchaînez avec l’autre type ou contactez un responsable.`,
        )
        return
      }
      setBusy(true)
      try {
        const row: TimePunch = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          profileId: staff.id,
          profileDisplayName: staff.displayName,
          storeId: activeStoreId,
          storeName: activeStoreLabel,
          kind,
          note: note.trim() || undefined,
        }
        await db.timePunches.add(row)
        setNote('')
        void appendAuditEvent({
          kind: 'time_punch',
          actor: {
            profileId: staff.id,
            displayName: staff.displayName,
          },
          reason:
            kind === 'in'
              ? `Pointage arrivée · ${activeStoreLabel}`
              : `Pointage départ · ${activeStoreLabel}`,
          payload: {
            punchId: row.id,
            kind,
            storeId: activeStoreId,
            storeName: activeStoreLabel,
            note: row.note,
          },
        })
        toast.success(
          kind === 'in' ? 'Arrivée enregistrée' : 'Départ enregistré',
          `${formatTimeHm(row.createdAt)} · ${activeStoreLabel}`,
        )
      } catch (e) {
        toast.error(
          'Enregistrement impossible',
          e instanceof Error ? e.message : String(e),
        )
      } finally {
        setBusy(false)
      }
    },
    [
      activeStoreId,
      activeStoreLabel,
      busy,
      lastPunchMine?.kind,
      note,
      staff.displayName,
      staff.id,
      toast,
    ],
  )

  const exportCsv = useCallback(() => {
    const header = [
      'Date',
      'Heure',
      'Type',
      'Collaborateur',
      'Magasin',
      'Note',
    ]
    const lines: string[][] = [header]
    const sorted = [...tableRows].sort((a, b) => a.createdAt - b.createdAt)
    for (const p of sorted) {
      const d = new Date(p.createdAt)
      lines.push([
        saleLocalYmd(p.createdAt),
        d.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        punchKindLabel(p.kind),
        p.profileDisplayName,
        p.storeName ?? p.storeId,
        p.note ?? '',
      ])
    }
    downloadCsv(
      `pointage-${saleLocalYmd(Date.now())}-${activeStoreId.slice(0, 8)}.csv`,
      lines,
    )
    toast.success('Export CSV', `${lines.length - 1} ligne(s)`)
  }, [activeStoreId, tableRows, toast])

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow="Équipe"
        title="Pointage"
        subtitle="Arrivées et départs par magasin — données stockées localement (IndexedDB)"
        actions={
          canViewTeamPointage && sortedTableDesc.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<IconDownload />}
              onClick={exportCsv}
            >
              Exporter CSV
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Aujourd’hui · {activeStoreLabel}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
                  {staff.displayName}
                </p>
                <p className="mt-0.5 text-[13px] text-zinc-600">
                  {onSite ? (
                    <span className="text-emerald-700">
                      Sur site depuis{' '}
                      {currentOpenInAt
                        ? formatTimeHm(currentOpenInAt)
                        : '—'}
                    </span>
                  ) : (
                    <span>Hors site</span>
                  )}
                </p>
              </div>
              <Badge tone={onSite ? 'success' : 'neutral'}>
                {onSite ? 'Présence ouverte' : 'Pas de présence ouverte'}
              </Badge>
            </div>

            <Field label="Note (optionnelle)" hint="Visible dans l’historique et l’export.">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex. Télétravail matin, sortie livraison…"
                maxLength={240}
              />
            </Field>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="lg"
                variant="accent"
                className="h-14 text-[15px]"
                iconLeft={<IconLogin />}
                loading={busy}
                disabled={onSite}
                onClick={() => void handlePunch('in')}
              >
                Arrivée
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-14 border-rose-200 bg-rose-50 text-[15px] text-rose-900 hover:bg-rose-100"
                iconLeft={<IconLogout />}
                loading={busy}
                disabled={!onSite}
                onClick={() => void handlePunch('out')}
              >
                Départ
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Enregistrez d’abord une <strong>arrivée</strong>, puis un{' '}
              <strong>départ</strong> à la fin du créneau. Les types se
              succèdent : impossible d’enregistrer deux arrivées ou deux départs
              d’affilée.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <Kpi
            label="Temps pointé (jour)"
            value={formatDurationMs(workedTodayMs)}
            hint="Somme des segments arrivée → départ"
          />
          <Kpi
            label="Première arrivée"
            value={
              firstInToday ? formatTimeHm(firstInToday.createdAt) : '—'
            }
          />
          <Kpi
            label="Dernier départ"
            value={
              lastOutToday ? formatTimeHm(lastOutToday.createdAt) : '—'
            }
          />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader
              title="Historique récent"
              subtitle="14 derniers jours · fuseau horaire du navigateur"
            />
            {canViewTeamPointage ? (
              <Field label="Collaborateur" className="sm:w-56">
                <Select
                  value={filterProfileId}
                  onChange={(e) => setFilterProfileId(e.target.value)}
                >
                  <option value="all">Toute l’équipe</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>

          {sortedTableDesc.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-zinc-500">
              Aucun pointage sur cette période.
            </p>
          ) : (
            <div className="ui-scroll -mx-1 max-h-[min(52vh,520px)] overflow-auto px-1">
              <Table>
                <THead>
                  <Tr>
                    <Th>Date & heure</Th>
                    <Th>Type</Th>
                    {canViewTeamPointage ? <Th>Collaborateur</Th> : null}
                    <Th>Magasin</Th>
                    <Th>Note</Th>
                  </Tr>
                </THead>
                <TBody>
                  {sortedTableDesc.map((p) => (
                    <Tr key={p.id}>
                      <Td className="whitespace-nowrap">
                        <span className="block text-[12px] font-medium text-zinc-900">
                          {formatDateLong(p.createdAt)}
                        </span>
                        <span className="font-mono-nums text-[11px] text-zinc-500">
                          {formatTimeHm(p.createdAt)}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={punchKindBadgeTone(p.kind)}>
                          {punchKindLabel(p.kind)}
                        </Badge>
                      </Td>
                      {canViewTeamPointage ? (
                        <Td className="max-w-[140px] truncate text-[12px]">
                          {p.profileDisplayName}
                        </Td>
                      ) : null}
                      <Td className="max-w-[120px] truncate text-[12px] text-zinc-600">
                        {p.storeName ?? p.storeId}
                      </Td>
                      <Td className="max-w-[200px] truncate text-[12px] text-zinc-500">
                        {p.note ?? '—'}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
