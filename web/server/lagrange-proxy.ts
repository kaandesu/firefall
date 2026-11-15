// The /api/lagrange routes, shared by the dev server (server/lagrange.ts) and the production server (server/prod.ts).
//   GET  /_config          → { configured, url, user?, workspace?, role?, error? }
//   POST /_config {url,key} → checks them against GET <url>/api/me, then saves them through the store
//   *    /<path>           → forwarded to <url>/<path> with the API key (JSON and SSE)
// The key (lgk_…) stays on the server side; it never reaches the browser bundle.
// No vite imports here: production runs this file with plain node.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'

export type Who = { user?: string; handle?: string; workspace?: string; role?: string }
export type Saved = { url: string; key: string }

export type Store = {
  /** The server and key for this request ('' when none). */
  get(req: IncomingMessage): Saved
  save(req: IncomingMessage, res: ServerResponse, saved: Saved): void
  /** Refuse a server URL before contacting it (an error message), or allow it (undefined). */
  check?(url: string): string | undefined
  /** The address this process reaches a server URL at (e.g. the Docker-internal one). */
  route?(url: string): string
}

export const read = (req: IncomingMessage) =>
  new Promise<Buffer>((res, rej) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => res(Buffer.concat(chunks)))
    req.on('error', rej)
  })

export const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

/** Set or replace KEY=value lines in a dotenv file's text, keeping everything else. */
export function upsertEnv(text: string, values: Record<string, string>): string {
  const lines = text.split('\n')
  for (const [k, v] of Object.entries(values)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}=`))
    if (i >= 0) lines[i] = `${k}=${v}`
    else {
      if (lines.length && lines[lines.length - 1] === '') lines.pop()
      lines.push(`${k}=${v}`, '')
    }
  }
  return lines.join('\n')
}

async function whoami(base: string, key: string): Promise<Who> {
  const res = await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${key}` } })
  if (res.status === 401 || res.status === 403) throw new Error('The server rejected the API key.')
  if (!res.ok) throw new Error(`The server answered ${res.status} to /api/me.`)
  const me = (await res.json()) as { user?: { name?: string; handle?: string }; key?: { workspace?: string; role?: string } }
  return { user: me.user?.name, handle: me.user?.handle, workspace: me.key?.workspace, role: me.key?.role }
}

/** Handle one request under /api/lagrange; `req.url` is the path below it. */
export async function handleLagrange(req: IncomingMessage, res: ServerResponse, store: Store): Promise<void> {
  const path = req.url || '/'
  const route = store.route ?? ((u: string) => u)
  const { url, key } = store.get(req)
  try {
    if (path.startsWith('/_config')) {
      if (req.method === 'GET') {
        if (!url || !key) return json(res, 200, { configured: false, url })
        try {
          return json(res, 200, { configured: true, url, ...(await whoami(route(url), key)) })
        } catch (e) {
          return json(res, 200, { configured: false, url, error: (e as Error).message })
        }
      }
      if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' })
      // A JSON body keeps other sites from posting here with a plain form.
      if (!(req.headers['content-type'] ?? '').includes('application/json')) return json(res, 415, { error: 'send JSON' })
      const body = JSON.parse((await read(req)).toString() || '{}') as { url?: string; key?: string }
      const nextUrl = (body.url ?? '').trim().replace(/\/+$/, '')
      const nextKey = (body.key ?? '').trim() || (nextUrl === url ? key : '')
      if (!/^https?:\/\//.test(nextUrl)) return json(res, 400, { error: 'The server URL must start with http:// or https://.' })
      const refused = store.check?.(nextUrl)
      if (refused) return json(res, 400, { error: refused })
      if (!nextKey) return json(res, 400, { error: 'Paste an API key (lgk_…).' })
      let who: Who
      try {
        who = await whoami(route(nextUrl), nextKey)
      } catch (e) {
        const msg = (e as Error).message
        return json(res, 400, { error: /fetch failed/i.test(msg) ? `Could not reach ${nextUrl}. Is the server running?` : msg })
      }
      store.save(req, res, { url: nextUrl, key: nextKey })
      return json(res, 200, { configured: true, url: nextUrl, ...who })
    }

    if (!url || !key) return json(res, 503, { error: 'No Lagrange server is connected.' })
    const abort = new AbortController()
    res.on('close', () => abort.abort())
    const headers: Record<string, string> = { authorization: `Bearer ${key}` }
    for (const h of ['content-type', 'accept', 'last-event-id']) {
      const v = req.headers[h]
      if (typeof v === 'string') headers[h] = v
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const up = await fetch(route(url) + path, { method: req.method, headers, body: hasBody ? new Uint8Array(await read(req)) : undefined, signal: abort.signal })
    const type = up.headers.get('content-type') ?? 'application/json'
    const sse = type.includes('event-stream')
    // x-accel-buffering: proxies in front of us (nginx, Traefik) must not hold back server-sent events.
    res.writeHead(up.status, { 'content-type': type, 'cache-control': 'no-cache', ...(sse ? { connection: 'keep-alive', 'x-accel-buffering': 'no' } : {}) })
    if (!up.body) return void res.end()
    Readable.fromWeb(up.body as Parameters<typeof Readable.fromWeb>[0]).on('error', () => res.end()).pipe(res)
  } catch (e) {
    if (res.headersSent) return void res.end()
    json(res, 502, { error: `Lagrange proxy: ${(e as Error).message}` })
  }
}
