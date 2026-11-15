// The production server: serves the built app (dist/) and the /api/lagrange routes, so a deployed FIREFALL can
// connect to a Lagrange server. Plain node, no dependencies:  node server/prod.ts
//
// Each visitor connects with their own API key. It is kept in an HttpOnly cookie that only /api/lagrange receives,
// so the page's scripts never see it and one visitor's key is never used for another.
//
//   PORT                   default 80
//   LAGRANGE_URL           the Lagrange server's public URL: prefilled on the start screen, and the only server
//                          visitors can connect to (unset: any server)
//   LAGRANGE_INTERNAL_URL  where this container reaches that server (in docker-compose: http://lagrange:8080)
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { createGzip } from 'node:zlib'
import { handleLagrange, json } from './lagrange-proxy.ts'
import type { Saved } from './lagrange-proxy.ts'

const ROOT = resolve(process.env.DIST ?? join(import.meta.dirname, '..', 'dist'))
const PORT = Number(process.env.PORT ?? 80)
const trim = (u: string) => u.trim().replace(/\/+$/, '')
const PUBLIC = trim(process.env.LAGRANGE_URL ?? '')
const INTERNAL = trim(process.env.LAGRANGE_INTERNAL_URL ?? '')
const COOKIE = 'ff_lagrange'

function readCookie(req: IncomingMessage): Saved {
  const raw = (req.headers.cookie ?? '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))
  if (raw) {
    try {
      const s = JSON.parse(Buffer.from(raw.slice(COOKIE.length + 1), 'base64url').toString()) as Partial<Saved>
      if (typeof s.url === 'string' && typeof s.key === 'string' && (!PUBLIC || s.url === PUBLIC)) return { url: s.url, key: s.key }
    } catch {
      /* a broken cookie is the same as none */
    }
  }
  return { url: PUBLIC, key: '' }
}

function writeCookie(req: IncomingMessage, res: ServerResponse, saved: Saved) {
  const https = req.headers['x-forwarded-proto'] === 'https' || (req.socket as { encrypted?: boolean }).encrypted
  const value = Buffer.from(JSON.stringify(saved)).toString('base64url')
  res.setHeader('set-cookie', `${COOKIE}=${value}; Path=/api/lagrange; HttpOnly; SameSite=Strict; Max-Age=2592000${https ? '; Secure' : ''}`)
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
}
const COMPRESS = /^(text\/|application\/(json|javascript|octet-stream)|image\/svg)/

function serveFile(req: IncomingMessage, res: ServerResponse, file: string, cache: string) {
  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
  const size = statSync(file).size
  const gzip = size > 1024 && COMPRESS.test(type) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))
  res.writeHead(200, { 'content-type': type, 'cache-control': cache, vary: 'accept-encoding', ...(gzip ? { 'content-encoding': 'gzip' } : { 'content-length': size }) })
  if (req.method === 'HEAD') return void res.end()
  const stream = createReadStream(file).on('error', () => res.destroy())
  ;(gzip ? stream.pipe(createGzip({ level: 5 })) : stream).pipe(res)
}

function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string) {
  const file = normalize(join(ROOT, decodeURIComponent(pathname)))
  const inside = file === ROOT || file.startsWith(ROOT + sep)
  const isFile = inside && existsSync(file) && statSync(file).isFile()
  if (isFile) {
    const cache = pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : pathname.startsWith('/data/') ? 'public, max-age=3600' : 'no-cache'
    return serveFile(req, res, file, cache)
  }
  // Missing assets and data are 404s; every other path is a page of the app.
  if (pathname.startsWith('/assets/') || pathname.startsWith('/data/')) return json(res, 404, { error: 'not found' })
  serveFile(req, res, join(ROOT, 'index.html'), 'no-cache')
}

createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://x').pathname
  if (pathname === '/api/lagrange' || pathname.startsWith('/api/lagrange/')) {
    req.url = (req.url ?? '').slice('/api/lagrange'.length) || '/'
    return void handleLagrange(req, res, {
      get: readCookie,
      save: writeCookie,
      check: (url) => (PUBLIC && url !== PUBLIC ? `This FIREFALL connects to ${PUBLIC} only.` : undefined),
      route: (url) => (INTERNAL && url === PUBLIC ? INTERNAL : url),
    })
  }
  // Nothing else is served under /api: the report chat sees the 404 and runs in demo mode.
  if (pathname.startsWith('/api/')) return json(res, 404, { error: 'not found' })
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'GET only' })
  try {
    serveStatic(req, res, pathname)
  } catch {
    json(res, 400, { error: 'bad path' })
  }
}).listen(PORT, () => console.log(`FIREFALL on :${PORT}${PUBLIC ? `, Lagrange ${PUBLIC}${INTERNAL ? ` via ${INTERNAL}` : ''}` : ''}`))
