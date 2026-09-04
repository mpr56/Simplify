/**
 * Local file store behind `/api/data` — the same GET/PUT contract the deployed
 * Vercel Function serves from Redis ([`api/data.ts`](../api/data.ts)), backed by
 * a JSON file inside the project instead.
 *
 * Without it `vite dev` has no `/api/data` at all, so every edit lived in the
 * browser's localStorage: gone with a cleared cache, invisible to a second
 * browser, and never part of the project. With it, goals and everything else in
 * the document land in `data/dashboard.json` and survive a server restart.
 *
 * Serve and preview only — `vite build` emits nothing from here, and a
 * deployment still talks to the real function.
 */
import type { ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { loadEnv, type Connect, type Plugin } from 'vite'

const ENDPOINT = '/api/data'
const DEFAULT_FILE = 'data/dashboard.json'

/** A whole dashboard document is tens of KB. Past this, the body is not ours. */
const MAX_BODY_BYTES = 8 * 1024 * 1024

function json(response: ServerResponse, body: unknown, status = 200): void {
  response.statusCode = status
  response.setHeader('content-type', 'application/json')
  response.setHeader('cache-control', 'no-store')
  response.end(JSON.stringify(body))
}

function readBody(request: Connect.IncomingMessage): Promise<string> {
  return new Promise((fulfil, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => fulfil(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

/**
 * Same construction as `revisionOf` in api/data.ts: the first 8 bytes of
 * SHA-256, as hex. The two stores produce different revisions for the same
 * document — which is fine, because a revision never crosses stores.
 */
function revisionOf(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16)
}

async function writeDocument(file: string, document: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  // Pretty-printed and newline-terminated: the file is meant to be opened,
  // read, and hand-edited like the seed files next to it.
  await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  // Rename is atomic within a filesystem, so a crash mid-write can never leave
  // a truncated document where a good one was.
  await rename(temporary, file)
}

function createHandler(
  getFile: () => string,
  warn: (message: string) => void,
): Connect.NextHandleFunction {
  // Writes replace the whole document. Queueing them keeps two edits landing
  // together from interleaving into one file.
  let queue: Promise<void> = Promise.resolve()

  return (request, response, next) => {
    const [path] = (request.url ?? '').split('?')
    if (path !== ENDPOINT) {
      next()
      return
    }

    const file = getFile()

    if (request.method === 'GET') {
      readFile(file, 'utf8')
        .then((raw) =>
          json(response, { configured: true, data: JSON.parse(raw), rev: revisionOf(raw) }),
        )
        .catch((error: NodeJS.ErrnoException) => {
          // Nothing written yet — an empty store, which the client seeds.
          if (error.code === 'ENOENT') {
            json(response, { configured: true, data: null, rev: null })
            return
          }
          // Unreadable or malformed is a hand-edit gone wrong. Reporting it as
          // empty would invite the client to "fix" it by overwriting with seed
          // data, so fail loudly and let the client fall back to its cache.
          warn(`could not read ${file}: ${error.message}`)
          json(response, { error: `Could not read ${file}: ${error.message}` }, 500)
        })
      return
    }

    if (request.method === 'PUT') {
      queue = queue
        .then(async () => {
          const payload = await readBody(request)

          let document: unknown
          try {
            document = JSON.parse(payload)
          } catch {
            json(response, { error: 'Body is not valid JSON' }, 400)
            return
          }

          // No If-Match writes unconditionally — the first-ever write and the
          // seed-an-empty-store path both arrive without one.
          const expected = request.headers['if-match']
          if (typeof expected === 'string') {
            const current = await readFile(file, 'utf8').catch(() => null)
            const currentRev = current === null ? null : revisionOf(current)
            if (currentRev !== expected) {
              json(response, { error: 'Stale document', rev: currentRev }, 412)
              return
            }
          }

          try {
            await writeDocument(file, document)
          } catch (error) {
            warn(`could not write ${file}: ${(error as Error).message}`)
            json(response, { error: (error as Error).message }, 500)
            return
          }

          // Read back rather than hashing the payload: writeDocument
          // pretty-prints, so only the file's own bytes match a later GET.
          const written = await readFile(file, 'utf8')
          json(response, { configured: true, ok: true, rev: revisionOf(written) })
        })
        .catch((error: Error) => {
          json(response, { error: error.message }, 400)
        })
      return
    }

    json(response, { error: `${request.method ?? 'Request'} not supported` }, 405)
  }
}

export interface FileStoreOptions {
  /** Document path, relative to the Vite root. Overridden by `DASHBOARD_DATA_FILE`. */
  file?: string
}

export function dashboardFileStore(options: FileStoreOptions = {}): Plugin {
  let file = ''
  const getFile = () => file

  /** Plugin option first, then `DASHBOARD_DATA_FILE` from the shell or `.env`. */
  const locate = (
    root: string | undefined,
    envDir: string | false | undefined,
    mode: string,
  ) => {
    const base = resolve(root ?? process.cwd())
    // `envDir: false` turns off .env files; the shell still gets a say.
    const fromEnv =
      envDir === false
        ? process.env.DASHBOARD_DATA_FILE
        : loadEnv(mode, envDir ?? base, 'DASHBOARD_').DASHBOARD_DATA_FILE
    return resolve(base, options.file ?? fromEnv ?? DEFAULT_FILE)
  }

  return {
    name: 'dashboard-file-store',

    config(userConfig, env) {
      file = locate(userConfig.root, userConfig.envDir, env.mode)
      // Our own writes must not trip the dev watcher into a page reload —
      // the client already holds the state it just saved.
      return { server: { watch: { ignored: [`${dirname(file)}/**`] } } }
    },

    configResolved(resolved) {
      file = locate(resolved.root, resolved.envDir, resolved.mode)
    },

    configureServer(server) {
      server.middlewares.use(
        createHandler(getFile, (message) => server.config.logger.warn(`[data] ${message}`)),
      )
      server.httpServer?.once('listening', () => {
        server.config.logger.info(`  ➜  Data:    ${relative(process.cwd(), file)}`)
      })
    },

    configurePreviewServer(server) {
      server.middlewares.use(
        createHandler(getFile, (message) => server.config.logger.warn(`[data] ${message}`)),
      )
    },
  }
}
