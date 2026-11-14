// Write the Apollo CM-012 FDS cases (1 g on the pad, and µg for comparison) from the intake files.
//   node --import ./scripts/register.mjs scripts/gen-fds.ts <outDir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCabin, parseMaterials, parseModel } from '@/intake/parse'
import { toFds } from '@/fds/toFds'

const ex = 'public/examples/apollo-cm012'
const out = process.argv[2] ?? 'public/data/fds/apollo-cm012'
const spec = parseCabin(readFileSync(join(ex, 'cabin.yaml'), 'utf8'))
const rows = parseMaterials(readFileSync(join(ex, 'materials.csv'), 'utf8'))
const model = parseModel(readFileSync(join(ex, 'cabin.model.json'), 'utf8'))
const tEnd = Number(process.env.T_END ?? 30)

for (const [sub, g] of [['1g', 1], ['ug', 0]] as const) {
  const c = toFds(spec, rows, model, { chid: `apollo_cm012_${sub}`, g, tEnd })
  const dir = join(out, sub)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${c.chid}.fds`), c.text)
  const { text: _t, ...meta } = c
  writeFileSync(join(dir, 'case.json'), JSON.stringify({ ...meta, g }, null, 2))
  console.log(`${dir}/${c.chid}.fds  cells=${c.cells} ijk=${c.ijk.join('x')} obst=${c.obstCount}`)
}
