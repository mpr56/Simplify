import type { DashboardData } from '@/data/types'
import { normalizeData } from '@/data/normalize'

/**
 * Export and import of the whole dashboard document — the safety net under a
 * store that is otherwise one browser and one remote key away from gone.
 */

/** Matches the file the remote store keeps, so the two are interchangeable. */
export const BACKUP_FILENAME = 'dashboard.json'

/**
 * Whether importing is gated on the deployment key. A deployment with no key
 * configured has no secret to check, so the import falls back to the typed
 * confirmation phrase the reset dialog already uses.
 */
export function requiresKey(): boolean {
  return Boolean(import.meta.env.VITE_DASHBOARD_KEY)
}

/**
 * Case- and whitespace-sensitive beyond a trim: a key is copied and pasted,
 * never typed from memory, so there is no muscle memory to forgive.
 */
export function matchesKey(input: string): boolean {
  const key = import.meta.env.VITE_DASHBOARD_KEY
  return Boolean(key) && input.trim() === key
}

/**
 * Hands the document to the browser as a download. The object URL is revoked
 * on the next frame rather than immediately — Safari cancels a download whose
 * URL is released in the same tick.
 */
export function downloadBackup(data: DashboardData, filename = BACKUP_FILENAME): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** A dated name, so successive exports do not overwrite each other in Downloads. */
export function backupFilename(today: Date): string {
  const stamp = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
  return `dashboard-${stamp}.json`
}

export type ParseResult =
  | { ok: true; data: DashboardData }
  | { ok: false; error: string }

/**
 * Parses an exported file back into a document. Everything goes through
 * `normalizeData`, so an old export, a hand-edited file, or a truncated one
 * lands as a valid document rather than crashing a panel three renders later.
 */
export function parseBackup(raw: string, today: Date): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'That file does not hold a dashboard document.' }
  }

  // The export is the document itself, but a file pulled straight from the
  // remote store is wrapped as `{ data, rev }` — accept both rather than
  // making the user unwrap it by hand.
  const candidate =
    'data' in parsed && parsed.data && typeof parsed.data === 'object'
      ? (parsed as { data: unknown }).data
      : parsed

  const shape = candidate as Record<string, unknown>
  const looksLikeDocument =
    Array.isArray(shape.goals) || Array.isArray(shape.habits) || Array.isArray(shape.epics)

  if (!looksLikeDocument) {
    return { ok: false, error: 'That file does not hold a dashboard document.' }
  }

  return { ok: true, data: normalizeData(candidate, today) }
}

/** What an import would bring in, so the confirm step can say what it costs. */
export function summarize(data: DashboardData): string {
  const counts: Array<[number, string, string]> = [
    [data.goals.length, 'goal', 'goals'],
    [data.tasks.length, 'task', 'tasks'],
    [data.epics.length, 'long-term goal', 'long-term goals'],
    [data.habits.length, 'habit', 'habits'],
    [Object.keys(data.macros).length, 'logged macro day', 'logged macro days'],
    [data.bookmarks.length, 'bookmark', 'bookmarks'],
  ]

  const parts = counts
    .filter(([count]) => count > 0)
    .map(([count, singular, plural]) => `${count} ${count === 1 ? singular : plural}`)

  return parts.length ? parts.join(', ') : 'an empty document'
}
