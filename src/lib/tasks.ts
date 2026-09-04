import type { ISODateTime, Task } from '@/data/types'

/**
 * Task urgency, derived from the due date rather than stored. Storing it would
 * mean a value that silently goes stale the moment the clock moves past it.
 */
export type TaskUrgency = 'overdue' | 'soon' | 'upcoming' | 'none'

/** "Due in the next couple of hours." */
export const SOON_MS = 2 * 60 * 60 * 1000

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** NaN-safe parse: an unparseable date is treated as no date at all. */
function parse(value: ISODateTime | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

export function urgencyOf(task: Task, now: number): TaskUrgency {
  if (task.done) return 'none'

  const due = parse(task.dueAt)
  if (due === null) return 'none'

  const delta = due - now
  if (delta < 0) return 'overdue'
  if (delta <= SOON_MS) return 'soon'
  return 'upcoming'
}

/**
 * One fixed order, deliberately not user-configurable: the due date *is* the
 * ordering, which is why there is no manual reorder affordance. Ascending
 * `dueAt` puts overdue work first without needing to know the current time.
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1

    if (a.done) {
      const aDone = parse(a.completedAt) ?? parse(a.createdAt) ?? 0
      const bDone = parse(b.completedAt) ?? parse(b.createdAt) ?? 0
      return bDone - aDone
    }

    const aDue = parse(a.dueAt)
    const bDue = parse(b.dueAt)
    if (aDue !== null && bDue !== null) return aDue - bDue
    if (aDue !== null) return -1
    if (bDue !== null) return 1

    return (parse(b.createdAt) ?? 0) - (parse(a.createdAt) ?? 0)
  })
}

export function overdueCount(tasks: Task[], now: number): number {
  return tasks.filter((task) => urgencyOf(task, now) === 'overdue').length
}

/** Calendar days between two dates, ignoring the time of day. */
function dayDelta(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.round((b - a) / DAY)
}

/** Zero-padded 24-hour local time. Built by hand so tests are locale-proof. */
function clockTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Relative text near the due time, absolute further out — "in 40m" is what you
 * need when it is imminent, "12 Oct" when it is not.
 */
export function formatDueLabel(dueAt: ISODateTime, now: number): string {
  const due = parse(dueAt)
  if (due === null) return ''

  const delta = due - now
  const magnitude = Math.abs(delta)
  const overdue = delta < 0

  if (magnitude < MINUTE) return overdue ? 'just overdue' : 'due now'

  if (magnitude < HOUR) {
    const minutes = Math.round(magnitude / MINUTE)
    return overdue ? `${minutes}m overdue` : `in ${minutes}m`
  }

  if (magnitude < 12 * HOUR) {
    const hours = Math.round(magnitude / HOUR)
    return overdue ? `${hours}h overdue` : `in ${hours}h`
  }

  const date = new Date(due)
  const days = dayDelta(new Date(now), date)

  if (days === 0) return `today ${clockTime(date)}`
  if (days === 1) return `tomorrow ${clockTime(date)}`
  if (days === -1) return `yesterday ${clockTime(date)}`
  if (days > 1 && days < 7) {
    return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${clockTime(date)}`
  }

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
