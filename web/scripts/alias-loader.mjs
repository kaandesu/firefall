// Node module hooks so scripts can import the app's TypeScript (`@/…` alias, extensionless imports).
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), '../src')

export async function resolve(specifier, context, next) {
  let spec = specifier
  if (spec.startsWith('@/')) spec = pathToFileURL(resolvePath(SRC, spec.slice(2))).href
  if (spec.startsWith('file:') || spec.startsWith('.')) {
    const base = spec.startsWith('file:') ? fileURLToPath(spec) : resolvePath(dirname(fileURLToPath(context.parentURL)), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
      if (existsSync(base + ext) && !(ext === '' && !/\.[cm]?[jt]sx?$|\.json$/.test(base))) return next(pathToFileURL(base + ext).href, context)
    }
  }
  return next(specifier, context)
}
