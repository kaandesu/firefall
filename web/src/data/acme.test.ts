/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { burnSeconds, detectEvents, sensorStats, type FrameSeries, type SensorLog } from './acme'
import { buildEvidence, match, maxAmbientO2, nearest } from './evidence'
import { STUDY, fit, targetOf } from './library'

const read = <T,>(f: string) => JSON.parse(readFileSync(new URL(`../../public/data/acme/${f}`, import.meta.url), 'utf8')) as T
const frames = read<FrameSeries>('21256C2.json')
const sensors = read<SensorLog>('19175A4.json')
const tp = read<{ columns: string[]; rows: (string | number)[][] }>('testpoints.json')

describe('ACME 21256C2 camera', () => {
  const ev = detectEvents(frames)
  it('finds the five phases in order', () => {
    expect(ev.map((e) => e.id)).toEqual(['ignition', 'flash', 'steady', 'transient', 'glow'])
    for (let i = 1; i < ev.length; i++) expect(ev[i].t).toBeGreaterThan(ev[i - 1].t)
  })
  it('lands near the events NASA logged by eye', () => {
    const t = Object.fromEntries(ev.map((e) => [e.id, e.t]))
    expect(t.ignition).toBeGreaterThan(40.5)
    expect(t.ignition).toBeLessThan(42)
    expect(t.steady).toBeGreaterThan(42.5)
    expect(t.steady).toBeLessThan(44)
    expect(t.transient).toBeGreaterThan(47.5)
    expect(t.transient).toBeLessThan(49.5)
    expect(t.glow).toBeGreaterThan(49.5)
    expect(t.glow).toBeLessThan(51.5)
    expect(burnSeconds(ev)).toBeGreaterThan(5)
  })
})

describe('ACME 19175A4 sensors', () => {
  it('reads fuel on, ignition and fuel off from the channels', () => {
    const s = sensorStats(sensors)
    expect(s.fuelOn).toBeGreaterThan(23)
    expect(s.fuelOn).toBeLessThan(26)
    expect(s.ignition!).toBeGreaterThanOrEqual(s.fuelOn!)
    expect(s.fuelOff).toBeGreaterThan(70)
    expect(s.channels).toBe(10)
  })
})

describe('evidence', () => {
  const rows = buildEvidence(tp)
  it('has 143 real test points and 39 CFI-G days', () => {
    expect(rows.filter((r) => r.src === 'Flame Design')).toHaveLength(143)
    expect(rows.filter((r) => r.src === 'CFI-G')).toHaveLength(39)
  })
  it('Apollo 1 sits beyond every real ambient test', () => {
    const apollo = targetOf(1, 16.7)
    expect(maxAmbientO2(rows)).toBeLessThan(0.5)
    const best = nearest(rows, apollo, 1)[0]
    expect(best.m).toBeLessThan(0.05)
    const moon = targetOf(0.3, 10.2)
    expect(match(nearest(rows, moon, 1)[0].e, moon)).toBeGreaterThan(0.5)
  })
  it('ranks ingested data above nominal for a Moon base', () => {
    expect(fit(STUDY['flame-design'], targetOf(0.3, 10.2)).total).toBeGreaterThan(fit(STUDY['daft'], targetOf(0.3, 10.2)).total)
  })
})
