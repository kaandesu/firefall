// After scripts/fds/run.sh: summarise both runs into public/data/fds/apollo-cm012/manifest.json.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readFdsCsv } from '@/fds/csv'
import { readSmv } from '@/fds/smv'
import { summarize } from '@/fds/summary'
import { parseCabin } from '@/intake/parse'

const out = process.argv[2] ?? 'public/data/fds/apollo-cm012'
const spec = parseCabin(readFileSync('public/examples/apollo-cm012/cabin.yaml', 'utf8'))
const cases = []
for (const [id, label] of [['1g', 'On the pad · 1 g'], ['ug', 'In orbit · µg']] as const) {
  const dir = join(out, id)
  const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'))
  const chid = c.chid as string
  if (!existsSync(join(dir, `${chid}_hrr.csv`))) throw new Error(`${dir}: no FDS output, run scripts/fds/run.sh`)
  const outText = readFileSync(join(dir, `${chid}.out`), 'utf8')
  if (!/STOP: FDS completed successfully/.test(outText)) throw new Error(`${dir}: FDS did not complete`)
  const smv = readSmv(readFileSync(join(dir, `${chid}.smv`), 'utf8'))
  // Last row of _steps.csv starts with the final time-step number.
  const steps = Number(readFileSync(join(dir, `${chid}_steps.csv`), 'utf8').trim().split('\n').at(-1)!.split(',')[0])
  const summary = summarize(readFdsCsv(readFileSync(join(dir, `${chid}_hrr.csv`), 'utf8')), readFdsCsv(readFileSync(join(dir, `${chid}_devc.csv`), 'utf8')), {
    burnerKw: c.burner.kw,
    burstPsia: spec.hull.burstPsia,
    detectors: spec.sensors.map((s) => s.id),
  })
  cases.push({
    id,
    label,
    g: c.g,
    chid,
    runtime_s: Number(readFileSync(join(dir, 'runtime_s.txt'), 'utf8')),
    cells: c.cells,
    ijk: c.ijk,
    dx: c.dx,
    t_end: summary.tEnd,
    steps,
    burner: c.burner,
    surfs: c.surfs,
    summary,
  })
  if (!smv.version) throw new Error('no FDS version in .smv')
  ;(globalThis as { fdsVersion?: string }).fdsVersion = smv.version
}
const manifest = {
  fds: (globalThis as { fdsVersion?: string }).fdsVersion,
  generated: new Date().toISOString().slice(0, 10),
  machine: 'Apple M1 (8 cores, 16 GB), FDS 6.11.1 macOS x86_64 build under Rosetta, OpenMP 4 threads',
  cases,
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify(cases.map((c) => ({ id: c.id, runtime: c.runtime_s, ...c.summary })), null, 1))
