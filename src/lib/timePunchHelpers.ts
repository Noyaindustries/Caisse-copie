import type { TimePunch } from '../db/types'

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

export function formatDurationMs(ms: number): string {
  if (ms <= 0) return '—'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
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
