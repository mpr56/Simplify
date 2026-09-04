import type { ISODate, Period } from '@/data/types'

/** Local-time ISO date. `toISOString()` is UTC and silently shifts the day. */
export function toISO(date: Date): ISODate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Monday-based week start. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date)
  const day = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - day)
  start.setHours(0, 0, 0, 0)
  return start
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/**
 * The inclusive date span a period covers, anchored on `anchor`.
 * Every view reads its data through this, so adding a period type
 * (e.g. quarterly) is a change in one place.
 */
export function rangeFor(period: Period, anchor: Date): { start: Date; end: Date } {
  switch (period) {
    case 'daily':
      return { start: anchor, end: anchor }
    case 'weekly': {
      const start = startOfWeek(anchor)
      return { start, end: addDays(start, 6) }
    }
    case 'monthly':
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
  }
}

export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = []
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push(new Date(d))
  return days
}

export function formatRange(period: Period, anchor: Date): string {
  const { start, end } = rangeFor(period, anchor)
  if (period === 'daily') {
    return start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  }
  if (period === 'monthly') {
    return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }
  const sameMonth = start.getMonth() === end.getMonth()
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

export const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function greeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
