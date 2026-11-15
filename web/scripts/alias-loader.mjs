// Node module hooks so scripts can import the app's TypeScript (`@/…` alias, extensionless imports).
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), '../src')
const DATA = resolvePath(dirname(fileURLToPath(import.meta.url)), '../../data')

export async function resolve(specifier, context, next) {
  let spec = specifier
  if (spec.startsWith('@/')) spec = pathToFileURL(resolvePath(SRC, spec.slice(2))).href
  if (spec.startsWith('@data/')) spec = pathToFileURL(resolvePath(DATA, spec.slice(6))).href
  if (spec.startsWith('file:') || spec.startsWith('.')) {
    const base = spec.startsWith('file:') ? fileURLToPath(spec) : resolvePath(dirname(fileURLToPath(context.parentURL)), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
      if (existsSync(base + ext) && !(ext === '' && !/\.[cm]?[jt]sx?$|\.json$/.test(base))) {
        // The app imports JSON the bundler's way; Node wants the import attribute.
        const out = await next(pathToFileURL(base + ext).href, context)
        return base.endsWith('.json') ? { ...out, importAttributes: { ...out.importAttributes, type: 'json' } } : out
      }
    }
  }
  return next(specifier, context)
}
