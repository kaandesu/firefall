// Dev-server routes for a real Lagrange server.
//   GET  /api/lagrange/_config          → { configured, url, user?, workspace?, role?, error? }
//   POST /api/lagrange/_config {url,key} → checks them against GET <url>/api/me, then saves them to web/.env.local
//   *    /api/lagrange/<path>           → forwarded to <url>/<path> with the API key (JSON and SSE)
// The key (lgk_…) is read and kept on this server; it never reaches the browser bundle.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'

type Who = { user?: string; handle?: string; workspace?: string; role?: string }

const read = (req: IncomingMessage) =>
  new Promise<Buffer>((res, rej) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => res(Buffer.concat(chunks)))
    req.on('error', rej)
  })

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' })
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

async function whoami(url: string, key: string): Promise<Who> {
  const res = await fetch(`${url}/api/me`, { headers: { authorization: `Bearer ${key}` } })
  if (res.status === 401 || res.status === 403) throw new Error('The server rejected the API key.')
  if (!res.ok) throw new Error(`The server answered ${res.status} to /api/me.`)
  const me = (await res.json()) as { user?: { name?: string; handle?: string }; key?: { workspace?: string; role?: string } }
  return { user: me.user?.name, handle: me.user?.handle, workspace: me.key?.workspace, role: me.key?.role }
}

export function lagrangePlugin(): Plugin {
  let url = ''
  let key = ''
  let envFile = ''
  return {
    name: 'firefall-lagrange',
    configResolved(cfg) {
      const env = loadEnv(cfg.mode, cfg.root, '')
      url = (env.LAGRANGE_URL ?? '').replace(/\/+$/, '')
      key = env.LAGRANGE_KEY ?? ''
      envFile = resolve(cfg.root, '.env.local')
    },
    configureServer(server) {
      server.middlewares.use('/api/lagrange', async (req: IncomingMessage, res: ServerResponse) => {
        const path = req.url ?? '/'
        try {
          if (path.startsWith('/_config')) {
            if (req.method === 'GET') {
              if (!url || !key) return json(res, 200, { configured: false, url })
              try {
                return json(res, 200, { configured: true, url, ...(await whoami(url, key)) })
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
            if (!nextKey) return json(res, 400, { error: 'Paste an API key (lgk_…).' })
            let who: Who
            try {
              who = await whoami(nextUrl, nextKey)
            } catch (e) {
              const msg = (e as Error).message
              return json(res, 400, { error: /fetch failed/i.test(msg) ? `Could not reach ${nextUrl}. Is the server running?` : msg })
            }
            url = nextUrl
            key = nextKey
            writeFileSync(envFile, upsertEnv(existsSync(envFile) ? readFileSync(envFile, 'utf8') : '', { LAGRANGE_URL: url, LAGRANGE_KEY: key }))
            return json(res, 200, { configured: true, url, ...who })
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
          const up = await fetch(url + path, { method: req.method, headers, body: hasBody ? new Uint8Array(await read(req)) : undefined, signal: abort.signal })
          const type = up.headers.get('content-type') ?? 'application/json'
          res.writeHead(up.status, { 'content-type': type, 'cache-control': 'no-cache', ...(type.includes('event-stream') ? { connection: 'keep-alive' } : {}) })
          if (!up.body) return res.end()
          Readable.fromWeb(up.body as Parameters<typeof Readable.fromWeb>[0]).on('error', () => res.end()).pipe(res)
        } catch (e) {
          if (res.headersSent) return res.end()
          json(res, 502, { error: `Lagrange proxy: ${(e as Error).message}` })
        }
      })
    },
  }
}
