/// <reference types="node" />
// The report is built from a whole scripted review (same fold as the app), the real ACME files and the smoke study.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildEvidence } from '@/data/evidence'
import { detectEvents, sensorStats, type FrameSeries, type SensorLog } from '@/data/acme'
import { apollo1, stageRuns } from '@/demo/apollo1'
import { parseCabin, parseMaterials, parseModel, toPackage } from '@/intake/parse'
import { smokeStudy } from '@/lab/smokeStudy'
import { fold } from '@/live/model'
import type { Entry } from '@/live/types'
import { SECTIONS, buildReport, scripted } from './build'

const pub = (f: string) => readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8')
const cabin = parseModel(pub('examples/apollo-cm012/cabin.model.json'))
const pkg = toPackage(parseCabin(pub('examples/apollo-cm012/cabin.yaml')), parseMaterials(pub('examples/apollo-cm012/materials.csv')))
const frames = JSON.parse(pub('data/acme/21256C2.json')) as FrameSeries
const sensors = sensorStats(JSON.parse(pub('data/acme/19175A4.json')) as SensorLog)
const evidence = buildEvidence(JSON.parse(pub('data/acme/testpoints.json')))
const events = detectEvents(frames)

describe('report', () => {
  it('builds every section from the run and answers with pull-up tags', { timeout: 60_000 }, () => {
    const study = smokeStudy({ model: cabin, pkg })
    const beats = apollo1({ pkg, model: cabin, request: 'r', acme: { events, sensors, evidence: evidence.length }, smoke: study, pr2: true })
    const model = fold(beats.map((b, i) => ({ ...b.e, seq: i + 1, at: Math.round(b.t * 1000) }) as unknown as Entry))
    const input = { model, pkg, runs: stageRuns(pkg, cabin), study, events, sensors, evidence, pins: ['21102-A'] }
    const r = buildReport(input)

    for (const s of SECTIONS) expect(r.brief[s.id].length, s.id).toBeGreaterThan(0)
    expect(r.fails.length).toBe(model.matrix.length)
    expect(r.designedNever.length).toBe(3)
    expect(r.pinned.map((e) => e.id)).toEqual(['21102-A'])
    // people's answers at the gates are injected live by the store, so a fold of the script alone has none
    expect(r.brief.decisions.some((l) => l.startsWith('PR-1'))).toBe(true)
    const ctx = JSON.parse(r.context)
    expect(ctx.sections).toHaveLength(SECTIONS.length)

    // demo answers carry the same tags the live model is told to use
    expect(scripted(r, input, 'Where should the smoke sensors go?')).toContain('[[chart:smoke]]')
    expect(scripted(r, input, 'What did the ACME data show?')).toMatch(/\[\[evidence:[^\]]+\]\]/)
    expect(scripted(r, input, 'Why does this cabin fail?')).toContain('[[chart:pressure]]')
    expect(scripted(r, input, "What's still open?")).toContain('[[section:open]]')
  })
})
