// Dev-server routes for a real Lagrange server (the routes themselves are in server/lagrange-proxy.ts).
// The server URL and key live in web/.env.local (LAGRANGE_URL, LAGRANGE_KEY); Connect writes them there.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import { handleLagrange, upsertEnv } from './lagrange-proxy.ts'

export { upsertEnv }

export function lagrangePlugin(): Plugin {
  let saved = { url: '', key: '' }
  let envFile = ''
  return {
    name: 'firefall-lagrange',
    configResolved(cfg) {
      const env = loadEnv(cfg.mode, cfg.root, '')
      saved = { url: (env.LAGRANGE_URL ?? '').replace(/\/+$/, ''), key: env.LAGRANGE_KEY ?? '' }
      envFile = resolve(cfg.root, '.env.local')
    },
    configureServer(server) {
      server.middlewares.use('/api/lagrange', (req, res) =>
        handleLagrange(req, res, {
          get: () => saved,
          save: (_req, _res, next) => {
            saved = next
            writeFileSync(envFile, upsertEnv(existsSync(envFile) ? readFileSync(envFile, 'utf8') : '', { LAGRANGE_URL: next.url, LAGRANGE_KEY: next.key }))
          },
        }),
      )
    },
  }
}
