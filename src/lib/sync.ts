import type { DashboardData } from '@/data/types'

const ENDPOINT = '/api/data'

declare global {
  interface Window {
    /** Set by the boot script in index.html; consumed once by `fetchRemote`. */
    __dashboardBoot?: Promise<Response>
  }
}

/**
 * `local`    — no store configured; localStorage only, no cross-device sync.
 * `synced`   — last read/write against the remote store succeeded.
 * `saving`   — a write is in flight.
 * `conflict` — another device wrote first; this device reloaded and lost its
 *              unsynced edit. Whole-document merging is out of scope.
 * `error`    — the store is configured but unreachable; local writes still land.
 */
export type SyncStatus = 'unknown' | 'local' | 'synced' | 'saving' | 'error' | 'conflict'

export interface RemoteResult {
  configured: boolean
  data: DashboardData | null
  /** Content hash of the stored document, or null when the store is empty. */
  rev: string | null
}

export type PushResult =
  | { status: 'ok'; rev: string | null }
  | { status: 'unconfigured' }
  | { status: 'conflict' }

function authHeaders(): Record<string, string> {
  const key = import.meta.env.VITE_DASHBOARD_KEY
  return key ? { 'x-dashboard-key': key } : {}
}

/** A 501 means the deployment has no store wired up — offline-first, not a failure. */
async function readRemote(response: Response): Promise<RemoteResult> {
  if (response.status === 501) return { configured: false, data: null, rev: null }
  if (!response.ok) throw new Error(`GET ${ENDPOINT} failed: ${response.status}`)

  const body = (await response.json()) as { data: DashboardData | null; rev?: string | null }
  return { configured: true, data: body.data, rev: body.rev ?? null }
}

export async function fetchRemote(signal?: AbortSignal): Promise<RemoteResult> {
  // The boot script in index.html starts this request before the bundle has
  // even parsed. Consume it once, then fall through to real fetches so a
  // focus-refetch never replays a stale response.
  const boot = typeof window === 'undefined' ? undefined : window.__dashboardBoot
  if (boot) {
    window.__dashboardBoot = undefined
    try {
      return await readRemote(await boot)
    } catch {
      // The early request failed — fall through and try again properly.
    }
  }

  return readRemote(await fetch(ENDPOINT, { headers: authHeaders(), signal }))
}

export async function pushRemote(
  data: DashboardData,
  rev: string | null,
): Promise<PushResult> {
  const response = await fetch(ENDPOINT, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      // Omitted when we have never seen a revision, which writes unconditionally.
      ...(rev ? { 'if-match': rev } : {}),
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  })

  if (response.status === 501) return { status: 'unconfigured' }
  if (response.status === 412) return { status: 'conflict' }
  if (!response.ok) throw new Error(`PUT ${ENDPOINT} failed: ${response.status}`)

  const body = (await response.json()) as { rev?: string | null }
  return { status: 'ok', rev: body.rev ?? null }
}
