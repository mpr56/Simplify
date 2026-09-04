/**
 * Vercel Function backing the dashboard's single JSON document.
 *
 * Storage is a Redis-compatible REST store (Vercel Marketplace Upstash, or any
 * Upstash database). The whole dashboard is one JSON blob under one key —
 * a personal dashboard has no concurrent writers, so document-level
 * read/replace is the right granularity and keeps the data hand-inspectable.
 *
 * With no store configured every route answers 501, and the client falls back
 * to localStorage instead of erroring.
 */

/**
 * Edge, not Node: a Node cold start is the largest cost on the open path, and
 * this function only needs fetch, Request/Response, process.env and WebCrypto.
 *
 * `config.runtime` is the form Vercel documents for functions in `api/`. If a
 * future Vercel version stops honouring it, the failure is benign — the
 * function falls back to the Node runtime and behaves exactly as it did
 * before, just with a cold start. Confirm on the first deploy.
 */
export const config = { runtime: 'edge' }

const KEY = 'dashboard:document:v1'

/**
 * A revision is a content hash, not a stored field — so the document shape
 * never changes and there is no envelope to migrate.
 */
async function revisionOf(payload: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function storeConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url: url.replace(/\/$/, ''), token }
}

/** Optional shared secret. Obscurity, not real auth — see README. */
function authorized(request: Request): boolean {
  const expected = process.env.DASHBOARD_SECRET
  if (!expected) return true
  return request.headers.get('x-dashboard-key') === expected
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

const NOT_CONFIGURED = () =>
  json({ configured: false, error: 'No data store configured' }, 501)

/** Upstash REST accepts a command array as the JSON body. */
async function command<T>(
  config: { url: string; token: string },
  args: (string | number)[],
): Promise<T> {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  })

  if (!response.ok) {
    throw new Error(`Store command failed: ${response.status} ${await response.text()}`)
  }

  const body = (await response.json()) as { result: T }
  return body.result
}

export async function GET(request: Request): Promise<Response> {
  const config = storeConfig()
  if (!config) return NOT_CONFIGURED()
  if (!authorized(request)) return json({ error: 'Unauthorized' }, 401)

  try {
    const raw = await command<string | null>(config, ['GET', KEY])
    return json({
      configured: true,
      data: raw ? JSON.parse(raw) : null,
      rev: raw ? await revisionOf(raw) : null,
    })
  } catch (error) {
    return json({ error: (error as Error).message }, 502)
  }
}

export async function PUT(request: Request): Promise<Response> {
  const config = storeConfig()
  if (!config) return NOT_CONFIGURED()
  if (!authorized(request)) return json({ error: 'Unauthorized' }, 401)

  try {
    const payload = await request.text()
    // Reject junk before it overwrites a good document.
    JSON.parse(payload)

    // A client that sends no If-Match writes unconditionally: that is the
    // first-ever write and the seed-an-empty-store path. The read-compare-write
    // is not atomic; for a single user that is fine, and Upstash REST supports
    // EVAL if it ever needs to be a Lua compare-and-set.
    const expected = request.headers.get('if-match')
    if (expected) {
      const current = await command<string | null>(config, ['GET', KEY])
      const currentRev = current ? await revisionOf(current) : null
      if (currentRev !== expected) {
        return json({ error: 'Stale document', rev: currentRev }, 412)
      }
    }

    await command(config, ['SET', KEY, payload])
    return json({ configured: true, ok: true, rev: await revisionOf(payload) })
  } catch (error) {
    return json({ error: (error as Error).message }, 400)
  }
}
