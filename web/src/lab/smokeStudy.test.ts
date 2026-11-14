/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCabin, parseMaterials, parseModel, toPackage } from '@/intake/parse'
import { smokeStudy } from './smokeStudy'

const ex = (f: string) => readFileSync(new URL(`../../public/examples/apollo-cm012/${f}`, import.meta.url), 'utf8')
const model = parseModel(ex('cabin.model.json'))
const pkg = toPackage(parseCabin(ex('cabin.yaml')), parseMaterials(ex('materials.csv')))

describe('detection study on CM-012', () => {
  it('checks the designed layout and proposes a better one', { timeout: 60_000 }, () => {
    const t0 = performance.now()
    const s = smokeStudy({ model, pkg })
    console.log('study', Math.round(performance.now() - t0), 'ms', s.runs, 'runs; smokeD', s.smokeD)
    for (const c of s.cases) console.log('designed', c.source, c.gLabel, JSON.stringify(c.alarms))
    for (const c of s.proposedCases) console.log('proposed', c.source, c.gLabel, JSON.stringify(c.alarms))
    console.log('proposed at', s.proposed.map((p) => `${p.id} ${p.type} (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(' · '), 'worst', s.worstDesigned, '→', s.worstProposed)
    expect(s.sources.map((x) => x.zone)).toContain('wiring')
    expect(s.designed).toHaveLength(2)
    expect(s.frames).toHaveLength(3)
    const firsts = (cs: typeof s.cases) => cs.filter((c) => c.firstAlarm !== null).length
    expect(firsts(s.proposedCases)).toBeGreaterThanOrEqual(firsts(s.cases))
    // 1 g carries smoke to the ceiling sensor; µg does not within the minute
    const at = (g: number) => s.cases.find((c) => c.source === 'wiring' && c.g === g)!
    expect(at(1).alarms.D1).not.toBeNull()
    expect(at(0).alarms.D1).toBeNull()
    // the designed layout misses cases; the proposed one catches every case within the minute
    expect(s.worstDesigned).toBeNull()
    expect(s.worstProposed).not.toBeNull()
    expect(s.worstProposed!).toBeLessThan(40)
  })
})
