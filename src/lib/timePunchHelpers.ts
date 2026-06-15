import type { TimePunch, TimePunchKind } from '../db/types'
import { saleLocalYmd } from './salesStats'

export type PointagePeriodDays = 7 | 14 | 30

export function sortPunchesAsc(punches: TimePunch[]): TimePunch[] {
  return [...punches].sort((a, b) => a.createdAt - b.createdAt)
}

/** Dernier pointage « ouvert » : une entrée sans sortie après. */
export function isCurrentlyIn(punchesAsc: TimePunch[]): boolean {
  if (punchesAsc.length === 0) return false
  return punchesAsc[punchesAsc.length - 1].kind === 'in'
}

/**
 * Somme des durées entrée→sortie sur la plage déjà filtrée (ordre chronologique).
 * Une entrée sans sortie correspondante n’est pas comptée jusqu’à la sortie.
 */
export function totalWorkedMs(punchesAsc: TimePunch[]): number {
  let ms = 0
  let openIn: number | null = null
  for (const p of punchesAsc) {
    if (p.kind === 'in') {
      openIn = p.createdAt
    } else if (p.kind === 'out' && openIn !== null) {
      ms += Math.max(0, p.createdAt - openIn)
      openIn = null
    }
  }
  return ms
}

/** Inclut le segment en cours (arrivée sans départ) jusqu’à `now`. */
export function totalWorkedMsIncludingOpen(
  punchesAsc: TimePunch[],
  now: number,
): number {
  let ms = totalWorkedMs(punchesAsc)
  if (punchesAsc.length === 0) return ms
  const last = punchesAsc[punchesAsc.length - 1]
  if (last.kind === 'in') {
    ms += Math.max(0, now - last.createdAt)
  }
  return ms
}

export function parseExpectedStartMinutes(hhmm: string): number {
  const parts = hhmm.trim().split(':')
  const h = Number.parseInt(parts[0] ?? '', 10)
  const m = Number.parseInt(parts[1] ?? '0', 10)
  if (!Number.isFinite(h) || h < 0 || h > 23) return 8 * 60
  if (!Number.isFinite(m) || m < 0 || m > 59) return h * 60
  return h * 60 + m
}

export function minutesFromMidnight(ts: number): number {
  const d = new Date(ts)
  return d.getHours() * 60 + d.getMinutes()
}

export function isLateFirstIn(
  firstInTs: number,
  expectedStartMinutes: number,
): boolean {
  return minutesFromMidnight(firstInTs) > expectedStartMinutes
}

export function formatDurationMs(ms: number): string {
  if (ms <= 0) return '—'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

export function formatDurationHm(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export function formatTimeHm(ts: number, locale = 'fr-FR'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

export function formatDateLong(ts: number, locale = 'fr-FR'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ts))
}

export function formatDateShortYmd(ymd: string): string {
  const [y, mo, d] = ymd.split('-').map(Number)
  if (!y || !mo || !d) return ymd
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(y, mo - 1, d))
}

export type TeamPresenceRow = {
  profileId: string
  displayName: string
  onSite: boolean
  lastPunchAt?: number
  lastPunchKind?: TimePunchKind
  storeName?: string
  workedTodayMs: number
  firstInToday?: number
  late: boolean
  punchedToday: boolean
}

export function computeTeamPresence(params: {
  profiles: { id: string; displayName: string }[]
  punches: TimePunch[]
  todayYmd: string
  storeId?: string
  now: number
  expectedStartMinutes: number
}): TeamPresenceRow[] {
  const { profiles, punches, todayYmd, storeId, now, expectedStartMinutes } =
    params
  const byProfile = new Map<string, TimePunch[]>()
  for (const p of punches) {
    if (storeId && p.storeId !== storeId) continue
    const arr = byProfile.get(p.profileId) ?? []
    arr.push(p)
    byProfile.set(p.profileId, arr)
  }

  return profiles.map((profile) => {
    const allAsc = sortPunchesAsc(byProfile.get(profile.id) ?? [])
    const todayAsc = allAsc.filter(
      (p) => saleLocalYmd(p.createdAt) === todayYmd,
    )
    const last = allAsc.length > 0 ? allAsc[allAsc.length - 1] : undefined
    const firstIn = todayAsc.find((p) => p.kind === 'in')
    const onSite = isCurrentlyIn(allAsc)
    return {
      profileId: profile.id,
      displayName: profile.displayName,
      onSite,
      lastPunchAt: last?.createdAt,
      lastPunchKind: last?.kind,
      storeName: last?.storeName ?? last?.storeId,
      workedTodayMs: totalWorkedMsIncludingOpen(todayAsc, now),
      firstInToday: firstIn?.createdAt,
      late: firstIn
        ? isLateFirstIn(firstIn.createdAt, expectedStartMinutes)
        : false,
      punchedToday: todayAsc.length > 0,
    }
  })
}

export type ProfilePeriodSummary = {
  profileId: string
  displayName: string
  totalMs: number
  daysWithPunches: number
}

export type DaySummaryRow = {
  ymd: string
  profileId: string
  displayName: string
  workedMs: number
  firstIn?: number
  lastOut?: number
  late: boolean
}

function filterPunchesWindow(
  punches: TimePunch[],
  sinceMs: number,
  storeId?: string,
  profileId?: string,
): TimePunch[] {
  return punches.filter((p) => {
    if (p.createdAt < sinceMs) return false
    if (storeId && p.storeId !== storeId) return false
    if (profileId && p.profileId !== profileId) return false
    return true
  })
}

export function summarizeByProfile(
  punches: TimePunch[],
  sinceMs: number,
  profiles: { id: string; displayName: string }[],
  storeId?: string,
): ProfilePeriodSummary[] {
  const filtered = filterPunchesWindow(punches, sinceMs, storeId)
  const daysByProfile = new Map<string, Set<string>>()

  for (const p of filtered) {
    const days = daysByProfile.get(p.profileId) ?? new Set<string>()
    days.add(saleLocalYmd(p.createdAt))
    daysByProfile.set(p.profileId, days)
  }

  return profiles
    .map((profile) => {
      const mine = filtered.filter((p) => p.profileId === profile.id)
      const byDay = new Map<string, TimePunch[]>()
      for (const p of mine) {
        const ymd = saleLocalYmd(p.createdAt)
        const arr = byDay.get(ymd) ?? []
        arr.push(p)
        byDay.set(ymd, arr)
      }
      let totalMs = 0
      for (const dayPunches of byDay.values()) {
        totalMs += totalWorkedMs(sortPunchesAsc(dayPunches))
      }
      return {
        profileId: profile.id,
        displayName: profile.displayName,
        totalMs,
        daysWithPunches: daysByProfile.get(profile.id)?.size ?? 0,
      }
    })
    .filter((row) => row.totalMs > 0 || row.daysWithPunches > 0)
    .sort((a, b) => b.totalMs - a.totalMs)
}

export function summarizeByDay(
  punches: TimePunch[],
  sinceMs: number,
  expectedStartMinutes: number,
  profileId?: string,
  storeId?: string,
): DaySummaryRow[] {
  const filtered = filterPunchesWindow(punches, sinceMs, storeId, profileId)
  const byKey = new Map<string, TimePunch[]>()
  for (const p of filtered) {
    const ymd = saleLocalYmd(p.createdAt)
    const key = `${ymd}:${p.profileId}`
    const arr = byKey.get(key) ?? []
    arr.push(p)
    byKey.set(key, arr)
  }

  const rows: DaySummaryRow[] = []
  for (const [key, dayPunches] of byKey.entries()) {
    const [ymd, pid] = key.split(':')
    const asc = sortPunchesAsc(dayPunches)
    const firstIn = asc.find((p) => p.kind === 'in')
    let lastOut: TimePunch | undefined
    for (let i = asc.length - 1; i >= 0; i--) {
      if (asc[i].kind === 'out') {
        lastOut = asc[i]
        break
      }
    }
    rows.push({
      ymd,
      profileId: pid,
      displayName: asc[0]?.profileDisplayName ?? pid,
      workedMs: totalWorkedMs(asc),
      firstIn: firstIn?.createdAt,
      lastOut: lastOut?.createdAt,
      late: firstIn
        ? isLateFirstIn(firstIn.createdAt, expectedStartMinutes)
        : false,
    })
  }

  return rows.sort((a, b) => b.ymd.localeCompare(a.ymd))
}

export function periodStartMs(days: PointagePeriodDays, now: number): number {
  return now - days * 24 * 60 * 60 * 1000
}

export function combineDateAndTimeToTs(dateYmd: string, timeHm: string): number {
  const [y, mo, d] = dateYmd.split('-').map(Number)
  const [h, mi] = timeHm.split(':').map(Number)
  if (!y || !mo || !d || !Number.isFinite(h) || !Number.isFinite(mi)) {
    throw new Error('Date ou heure invalide.')
  }
  const ts = new Date(y, mo - 1, d, h, mi, 0, 0).getTime()
  if (!Number.isFinite(ts)) throw new Error('Date ou heure invalide.')
  return ts
}
